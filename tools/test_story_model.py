"""Regression tests for the editor's constrained room/scene data model."""

from __future__ import annotations

import copy
import unittest
from pathlib import Path

from tools.story_model import (
    MAX_PAGES_PER_BANK,
    SPLASH_ART_FILE,
    SPLASH_CONFIG_FILE,
    StoryError,
    bank_scenes,
    continuation_warnings,
    generate_bank_source,
    generate_bank_text,
    generate_logic_source,
    generated_sources,
    load_project,
    project_summary,
    parse_splash_asm,
    scene_records,
    validate_project,
)


class StoryModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.project = load_project()

    def make_large_project(self, count: int | None = None) -> dict:
        count = count or MAX_PAGES_PER_BANK + 1
        rooms = []
        for index in range(count):
            room_id = f"room_{index}"
            scene_id = f"scene_{index}"
            rooms.append({
                "id": room_id,
                "name": f"Room {index}",
                "position": {"x": 20, "y": 20},
                "entry_scene": scene_id,
                "exits": {"north": None, "east": None, "south": None, "west": None},
                "scenes": [{
                    "id": scene_id,
                    "name": f"Scene {index}",
                    "text": [""] * 10,
                    "next": None,
                    "exit_overrides": {},
                }],
            })
        if count > MAX_PAGES_PER_BANK:
            rooms[MAX_PAGES_PER_BANK - 1]["exits"]["east"] = f"room_{MAX_PAGES_PER_BANK}"
        return {"version": 2, "title": "Large test", "start_room": f"room_{count - 1}", "rooms": rooms}

    def test_checked_in_project_is_valid_and_migrates_to_v2(self) -> None:
        self.assertEqual(self.project["version"], 2)
        self.assertGreaterEqual(len(self.project["rooms"]), 1)
        self.assertEqual(self.project["rooms"][0]["scenes"][0]["bank"], 2)
        self.assertEqual(self.project["title"], "Castle of the Two Keys")
        self.assertEqual(self.project["start_room"], "ashen_moor")

    def test_appearance_defaults_and_generated_constants(self) -> None:
        project = self.make_large_project(1)
        validated = validate_project(project)
        self.assertEqual(validated["appearance"]["border_style"], "striped")
        self.assertEqual(validated["appearance"]["background_color"], 0x82)
        validated["appearance"].update({
            "border_style": "solid", "action_background_enabled": True,
            "background_color": 0x02, "border_color": 0x46,
            "text_color": 0x0E, "action_text_color": 0x1E,
            "action_background_color": 0x84,
        })
        config = generated_sources(validate_project(validated))[SPLASH_CONFIG_FILE]
        self.assertIn("GAME_BORDER_STYLE equ 1", config)
        self.assertIn("GAME_ACTION_BACKGROUND_ENABLED equ 1", config)
        self.assertIn("GAME_ACTION_BACKGROUND_COLOR equ $84", config)

    def test_appearance_rejects_non_palette_colour(self) -> None:
        project = self.make_large_project(1)
        project["appearance"] = {"text_color": 0x0F}
        with self.assertRaisesRegex(StoryError, "even Atari colour byte"):
            validate_project(project)

    def test_scene_appearance_overrides_inherit_global_values(self) -> None:
        project = self.make_large_project(2)
        project["appearance"] = {
            "background_color": 0x02, "border_color": 0x46,
            "text_color": 0x0E, "action_text_color": 0x1E,
            "action_background_enabled": False,
            "action_background_color": 0x84, "border_style": "solid",
        }
        project["rooms"][0]["scenes"][0]["appearance_overrides"] = {
            "background_color": 0x22, "text_color": 0x3E,
            "action_background_enabled": True,
            "action_background_color": 0x66, "border_style": "striped",
        }
        validated = validate_project(project)
        first_scene = validated["rooms"][0]["scenes"][0]
        second_scene = validated["rooms"][1]["scenes"][0]
        self.assertEqual(first_scene["appearance_overrides"]["background_color"], 0x22)
        self.assertEqual(second_scene["appearance_overrides"], {})

        source = generate_bank_text(validated, 2)
        self.assertIn("SceneBackgroundColors\n        dc.b $22,$02", source)
        self.assertIn("SceneBorderColors\n        dc.b $46,$46", source)
        self.assertIn("SceneTextColors\n        dc.b $3E,$0E", source)
        self.assertIn("SceneActionTextColors\n        dc.b $1E,$1E", source)
        # Disabled action backgrounds render with the inherited story background.
        self.assertIn("SceneActionBackgroundColors\n        dc.b $66,$02", source)
        self.assertIn("SceneBorderStyles\n        dc.b $00,$01", source)

    def test_room_presets_are_optional_and_scene_overrides_win(self) -> None:
        project = self.make_large_project(2)
        project["appearance_presets"] = [{
            "id": "castle", "name": "Castle",
            "appearance": {
                "background_color": 0x04, "border_color": 0x06,
                "text_color": 0x0E, "action_text_color": 0x1E,
                "action_background_enabled": True,
                "action_background_color": 0x24, "border_style": "solid",
            },
        }]
        project["rooms"][0]["appearance_preset"] = "castle"
        project["rooms"][0]["appearance_overrides"] = {"border_color": 0x08}
        project["rooms"][0]["scenes"][0]["appearance_overrides"] = {"background_color": 0x0A}
        validated = validate_project(project)
        self.assertEqual(validated["rooms"][1]["appearance_preset"], None)
        self.assertEqual(validated["rooms"][1]["appearance_overrides"], {})
        source = generate_bank_text(validated, 2)
        self.assertIn("SceneBackgroundColors\n        dc.b $0A,$82", source)
        self.assertIn("SceneBorderColors\n        dc.b $08,$84", source)
        self.assertIn("SceneBorderStyles\n        dc.b $01,$00", source)

    def test_room_rejects_missing_appearance_preset(self) -> None:
        project = self.make_large_project(1)
        project["rooms"][0]["appearance_preset"] = "missing"
        with self.assertRaisesRegex(StoryError, "missing preset"):
            validate_project(project)

    def test_scene_preset_overrides_room_preset_without_using_ram(self) -> None:
        project = self.make_large_project(2)
        base = dict(self.project["appearance"])
        project["appearance_presets"] = [
            {"id": "dark", "name": "Dark", "appearance": {**base, "background_color": 0x02, "border_color": 0x04}},
            {"id": "danger", "name": "Danger", "appearance": {**base, "background_color": 0x42, "border_color": 0x46}},
        ]
        project["rooms"][0]["appearance_preset"] = "dark"
        project["rooms"][0]["scenes"][0]["appearance_preset"] = "danger"
        project["rooms"][0]["scenes"][0]["appearance_overrides"] = {"text_color": 0x3E}
        validated = validate_project(project)
        self.assertIsNone(validated["rooms"][1]["scenes"][0]["appearance_preset"])
        source = generate_bank_text(validated, 2)
        self.assertIn("SceneBackgroundColors\n        dc.b $42,$82", source)
        self.assertIn("SceneBorderColors\n        dc.b $46,$84", source)
        self.assertIn("SceneTextColors\n        dc.b $3E,$0E", source)

    def test_scene_rejects_missing_appearance_preset(self) -> None:
        project = self.make_large_project(1)
        project["rooms"][0]["scenes"][0]["appearance_preset"] = "missing"
        with self.assertRaisesRegex(StoryError, "missing preset"):
            validate_project(project)

    def test_ending_scene_generates_restart_markers(self) -> None:
        project = self.make_large_project(2)
        project["rooms"][0]["scenes"][0]["ending"] = True
        validated = validate_project(project)
        self.assertTrue(validated["rooms"][0]["scenes"][0]["ending"])
        self.assertFalse(validated["rooms"][1]["scenes"][0]["ending"])
        self.assertIn("PageEndings\n        dc.b 1,0", generate_logic_source(validated))
        self.assertIn("SceneBorderStyles\n        dc.b $80,$00", generate_bank_text(validated, 2))

    def test_scene_appearance_rejects_invalid_override(self) -> None:
        project = self.make_large_project(1)
        project["rooms"][0]["scenes"][0]["appearance_overrides"] = {"text_color": 0x0F}
        with self.assertRaisesRegex(StoryError, "even Atari colour byte"):
            validate_project(project)

    def test_map_positions_are_not_limited_to_the_initial_canvas(self) -> None:
        project = self.make_large_project(1)
        project["rooms"][0]["position"] = {"x": 2400, "y": 1600}
        validated = validate_project(project)
        self.assertEqual(validated["rooms"][0]["position"], {"x": 2400, "y": 1600})

    def test_generated_rows_are_twelve_bytes_and_pages_are_aligned(self) -> None:
        story_bank = self.project["rooms"][0]["scenes"][0]["bank"]
        source = generate_bank_text(self.project, story_bank)
        rows = [line.split('"')[1] for line in source.splitlines() if 'dc.b "' in line]
        self.assertTrue(rows)
        self.assertTrue(all(len(row) == 12 for row in rows))
        expected_pairs = (len(bank_scenes(self.project, story_bank)) + 1) // 2
        self.assertEqual(source.count("align $100"), expected_pairs)

    def test_room_exit_targets_the_destination_entry_scene(self) -> None:
        project = validate_project(self.make_large_project(2))
        project["rooms"][0]["exits"]["east"] = "room_1"
        source = generate_logic_source(project)
        self.assertIn("BANK_2|1", source)

    def test_text_budget_counts_scenes_not_rooms(self) -> None:
        summary = project_summary(self.project)
        page_count = len(scene_records(self.project))
        self.assertEqual(summary["banks"]["2"]["maximum_characters"], MAX_PAGES_PER_BANK * 120)
        expected_maximum = len(summary["story_banks"]) * MAX_PAGES_PER_BANK * 120
        self.assertEqual(summary["maximum_characters"], expected_maximum)
        self.assertEqual(summary["available_characters"], expected_maximum - page_count * 120)

    def test_unused_f4_story_bank_generates_an_assemblable_placeholder(self) -> None:
        source = generate_bank_source(self.project, 7)
        self.assertIn("dc.b 0", source)

    def test_start_room_can_live_in_another_bank(self) -> None:
        validated = validate_project(self.make_large_project())
        source = generate_logic_source(validated)
        self.assertIn("START_BANK equ 3", source)
        self.assertIn("START_PAGE equ 0", source)
        self.assertIn("BANK_3|0", source)

    def test_bank_fields_are_automatic_across_scenes(self) -> None:
        validated = validate_project(self.make_large_project())
        scenes = [scene for _, scene in scene_records(validated)]
        self.assertTrue(all(scene["bank"] == 2 for scene in scenes[:MAX_PAGES_PER_BANK]))
        self.assertEqual(scenes[MAX_PAGES_PER_BANK]["bank"], 3)

    def test_three_scene_room_inherits_movement_on_last_scene(self) -> None:
        project = validate_project(self.make_large_project(2))
        room = project["rooms"][0]
        room["exits"]["east"] = "room_1"
        room["scenes"] = [
            {"id": f"multi_{index}", "name": f"Part {index + 1}", "bank": 0,
             "text": [""] * 10, "next": f"multi_{index + 1}" if index < 2 else None,
             "exit_overrides": {}}
            for index in range(3)
        ]
        room["entry_scene"] = "multi_0"
        project = validate_project(project)
        source = generate_logic_source(project)
        self.assertIn("BANK_2|1", source)  # first NEXT
        self.assertIn("BANK_2|2", source)  # second NEXT
        self.assertIn("BANK_2|3", source)  # inherited EAST reaches room_1

    def test_scene_can_override_or_remove_an_inherited_exit(self) -> None:
        project = self.make_large_project(2)
        project["rooms"][0]["exits"]["east"] = "room_1"
        project["rooms"][0]["scenes"][0]["exit_overrides"] = {"east": None}
        source = generate_logic_source(validate_project(project))
        east = source.split("PageActionEast", 1)[1].splitlines()[1]
        self.assertEqual(east.split("dc.b ", 1)[1].split(",")[0], "NO_EXIT")

    def test_rejects_missing_start_room(self) -> None:
        invalid = copy.deepcopy(self.project)
        invalid["start_room"] = "missing"
        with self.assertRaisesRegex(StoryError, "start_room"):
            validate_project(invalid)

    def test_rejects_too_wide_text(self) -> None:
        invalid = copy.deepcopy(self.project)
        invalid["rooms"][0]["scenes"][0]["text"][0] = "THIRTEEN CHARS"
        with self.assertRaisesRegex(StoryError, "maximum width is 12"):
            validate_project(invalid)

    def test_rejects_cross_room_next(self) -> None:
        invalid = copy.deepcopy(self.project)
        invalid["rooms"][0]["scenes"][0]["next"] = invalid["rooms"][1]["entry_scene"]
        with self.assertRaisesRegex(StoryError, "same room"):
            validate_project(invalid)

    def test_continuation_cycle_is_reported(self) -> None:
        project = copy.deepcopy(self.project)
        room = project["rooms"][0]
        second = copy.deepcopy(room["scenes"][0])
        second["id"] = "cycle_second"
        second["next"] = room["scenes"][0]["id"]
        room["scenes"][0]["next"] = second["id"]
        room["scenes"].append(second)
        warnings = continuation_warnings(validate_project(project))
        self.assertTrue(any("NEXT cycle" in warning for warning in warnings))

    def test_reference_splash_export_is_accepted(self) -> None:
        source = (Path(__file__).resolve().parents[1] / "reference" / "abb.asm").read_text(encoding="utf-8")
        parsed = parse_splash_asm(source)
        self.assertEqual(parsed["line_count"], 80)
        self.assertEqual(parsed["line_height"], 2)
        self.assertTrue(all(len(table) == 80 for table in parsed["tables"].values()))

    def test_enabled_splash_keeps_fixed_story_banks(self) -> None:
        project = self.make_large_project(MAX_PAGES_PER_BANK + 1)
        source = (Path(__file__).resolve().parents[1] / "reference" / "abb.asm").read_text(encoding="utf-8")
        project["splash"] = {"enabled": True, "filename": "abb.asm", "source": source, "delay_frames": 120}
        validated = validate_project(project)
        scenes = [scene for _, scene in scene_records(validated)]
        self.assertEqual(scenes[0]["bank"], 2)
        self.assertEqual(scenes[MAX_PAGES_PER_BANK]["bank"], 3)
        self.assertEqual(project_summary(validated)["maximum_characters"], 6 * MAX_PAGES_PER_BANK * 120)

    def test_f4_layout_reaches_bank_seven_without_colliding_with_no_exit(self) -> None:
        project = self.make_large_project(6 * MAX_PAGES_PER_BANK)
        source = (Path(__file__).resolve().parents[1] / "reference" / "abb.asm").read_text(encoding="utf-8")
        project["splash"] = {"enabled": True, "filename": "abb.asm", "source": source, "delay_frames": 120}
        validated = validate_project(project)
        scenes = [scene for _, scene in scene_records(validated)]
        self.assertEqual((scenes[-1]["bank"], scenes[-1]["id"]), (7, "scene_101"))
        self.assertIn("BANK_7|16", generate_logic_source(validated))

    def test_ninety_row_background_builder_export_uses_black_background(self) -> None:
        source = (Path(__file__).resolve().parents[1] / "reference" / "abbAssymMirror.asm").read_text(encoding="utf-8")
        parsed = parse_splash_asm(source)
        self.assertEqual(parsed["line_count"], 90)
        project = self.make_large_project(1)
        project["splash"] = {
            "enabled": True, "filename": "abbAssymMirror.asm", "source": source,
            "delay_frames": 120, "background_color": 0,
        }
        validated = validate_project(project)
        self.assertEqual(validated["splash"]["background_color"], 0)
        splash_art = generated_sources(validated)[SPLASH_ART_FILE]
        self.assertIn(
            "SPLASH_REMAINING_LINES equ 192-SPLASH_PLAYFIELD_LINES*SPLASH_LINE_HEIGHT-SPLASH_PADDING_LINES-2",
            splash_art,
        )

        project["splash"]["background_color"] = 0x84
        with self.assertRaisesRegex(StoryError, "currently be \\$00 black"):
            validate_project(project)

    def test_flags_generate_initial_state_variants_and_action_effects(self) -> None:
        project = self.make_large_project(1)
        room = project["rooms"][0]
        alternate = copy.deepcopy(room["scenes"][0])
        alternate["id"] = "scene_lit"
        alternate["name"] = "Lit"
        room["scenes"].append(alternate)
        room["variants"] = [{"scene": "scene_lit", "when_all": ["TORCH_LIT"], "when_clear": []}]
        room["scenes"][0]["effects"] = {"look": {"set": ["TORCH_LIT"], "clear": [], "toggle": []}}
        project["flags"] = [{"id": "TORCH_LIT", "initial": False}]
        validated = validate_project(project)
        source = generate_logic_source(validated)
        self.assertIn("InitialFlags", source)
        self.assertIn("dc.b $00,$FF,BANK_2|1", source)
        self.assertIn("dc.b 0,0,$00,$FF", source)

    def test_missing_flag_reference_is_rejected(self) -> None:
        project = self.make_large_project(1)
        project["rooms"][0]["scenes"][0]["effects"] = {
            "next": {"set": ["MISSING"], "clear": [], "toggle": []}
        }
        with self.assertRaisesRegex(StoryError, "missing flag"):
            validate_project(project)

    def test_contextual_action_generates_requirements_effects_and_label(self) -> None:
        project = self.make_large_project(1)
        project["flags"] = [
            {"id": "HAS_FUSE", "initial": True},
            {"id": "LIFT_POWERED", "initial": False},
        ]
        project["rooms"][0]["scenes"][0]["context_actions"] = [{
            "label": "USE FUSE",
            "when_all": ["HAS_FUSE"],
            "when_clear": ["LIFT_POWERED"],
            "effects": {"set": ["LIFT_POWERED"], "clear": ["HAS_FUSE"], "toggle": []},
        }]
        validated = validate_project(project)
        source = generate_logic_source(validated)
        self.assertIn("Scene0Context", source)
        self.assertIn("dc.b $00,$81,$FF", source)
        self.assertIn("dc.b $01,$40,$FF", source)
        self.assertIn('ContextLabel0_0 dc.b "USE[FUSE[[[["', source)

    def test_contextual_action_label_cannot_exceed_twelve_characters(self) -> None:
        project = self.make_large_project(1)
        project["rooms"][0]["scenes"][0]["context_actions"] = [{
            "label": "THIRTEEN CHARS", "when_all": [], "when_clear": [],
            "effects": {"set": [], "clear": [], "toggle": []},
        }]
        with self.assertRaisesRegex(StoryError, "1-12 characters"):
            validate_project(project)

    def test_contextual_action_can_enter_room_or_specific_scene(self) -> None:
        project = self.make_large_project(2)
        action = {
            "label": "ENTER EAST", "when_all": [], "when_clear": [],
            "destination": "room:room_1",
            "effects": {"set": [], "clear": [], "toggle": []},
        }
        project["rooms"][0]["scenes"][0]["context_actions"] = [action]
        validated = validate_project(project)
        self.assertEqual(validated["rooms"][0]["scenes"][0]["context_actions"][0]["destination"], "room:room_1")
        source = generate_logic_source(validated)
        self.assertIn("Scene0Context", source)
        self.assertIn("dc.b BANK_2|1", source)

        action["destination"] = "scene:scene_1"
        validated = validate_project(project)
        self.assertEqual(validated["rooms"][0]["scenes"][0]["context_actions"][0]["destination"], "scene:scene_1")

    def test_contextual_action_rejects_missing_destination(self) -> None:
        project = self.make_large_project(1)
        project["rooms"][0]["scenes"][0]["context_actions"] = [{
            "label": "GO AWAY", "when_all": [], "when_clear": [],
            "destination": "room:missing",
            "effects": {"set": [], "clear": [], "toggle": []},
        }]
        with self.assertRaisesRegex(StoryError, "destination references missing room"):
            validate_project(project)

    def test_portable_object_generates_location_inventory_name_and_action_ops(self) -> None:
        project = self.make_large_project(1)
        project["objects"] = [{"id": "fuse", "name": "FUSE", "initial_location": "room_0"}]
        project["rooms"][0]["scenes"][0]["context_actions"] = [{
            "label": "TAKE FUSE", "when_all": [], "when_clear": [],
            "requires_carried": None, "requires_here": "fuse",
            "effects": {"set": [], "clear": [], "toggle": [], "take_object": "fuse", "remove_object": None},
        }]
        validated = validate_project(project)
        self.assertEqual(validated["objects"][0]["type"], "portable")
        source = generate_logic_source(validated)
        self.assertIn("OBJECT_COUNT equ 1", source)
        self.assertIn("InitialObjectLocations", source)
        self.assertIn("dc.b $40,$FF", source)  # object must be in this room
        self.assertIn("dc.b $00,$FF", source)  # move object to carried
        from tools.story_model import generate_context_labels
        self.assertIn('ObjectName0 dc.b "FUSE[[[[[[[["', generate_context_labels(validated, 2))

    def test_container_hides_contents_until_open_and_generates_rom_tables(self) -> None:
        project = self.make_large_project(1)
        project["flags"] = [
            {"id": "CHEST_OPEN", "initial": False},
            {"id": "CHEST_LOCKED", "initial": True},
        ]
        project["objects"] = [
            {"id": "chest", "name": "OLD CHEST", "type": "container", "initial_location": "room_0", "open_flag": "CHEST_OPEN", "locked_flag": "CHEST_LOCKED"},
            {"id": "key", "name": "SMALL KEY", "type": "portable", "initial_location": "container:chest"},
        ]
        project["rooms"][0]["scenes"][0]["context_actions"] = [{
            "label": "TAKE KEY", "when_all": [], "when_clear": [],
            "requires_carried": None, "requires_here": "key",
            "effects": {"set": [], "clear": [], "toggle": [], "take_object": "key", "remove_object": None},
        }]
        validated = validate_project(project)
        source = generate_logic_source(validated)
        self.assertIn("InitialObjectLocations\n        dc.b BANK_2|0,$F1", source)
        self.assertIn("ObjectContainerOpenFlags\n        dc.b $00,$FF", source)
        self.assertIn("ObjectContainerLockedFlags\n        dc.b $01,$FF", source)
        self.assertIn("dc.b $41,$FF", source)  # key must be here through its open container

    def test_container_requires_valid_flags_and_cannot_be_taken(self) -> None:
        project = self.make_large_project(1)
        project["objects"] = [{"id": "chest", "name": "CHEST", "type": "container", "initial_location": "room_0"}]
        with self.assertRaisesRegex(StoryError, "open_flag"):
            validate_project(project)

        project["flags"] = [{"id": "CHEST_OPEN", "initial": False}]
        project["objects"][0]["open_flag"] = "CHEST_OPEN"
        project["rooms"][0]["scenes"][0]["context_actions"] = [{
            "label": "TAKE CHEST", "when_all": [], "when_clear": [],
            "requires_here": "chest", "effects": {"set": [], "clear": [], "toggle": [], "take_object": "chest"},
        }]
        with self.assertRaisesRegex(StoryError, "cannot take a container"):
            validate_project(project)

    def test_missing_object_reference_is_rejected(self) -> None:
        project = self.make_large_project(1)
        project["rooms"][0]["scenes"][0]["context_actions"] = [{
            "label": "TAKE THING", "when_all": [], "when_clear": [], "requires_here": "missing",
            "effects": {"set": [], "clear": [], "toggle": []},
        }]
        with self.assertRaisesRegex(StoryError, "missing object"):
            validate_project(project)


if __name__ == "__main__":
    unittest.main()
