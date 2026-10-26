"""Validated room/scene model and DASM generator for the text adventure."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROJECT_FILE = PROJECT_ROOT / "editor" / "project.json"
BANK_COUNT = 8
BANKS = tuple(range(BANK_COUNT))
STORY_BANKS = tuple(range(2, BANK_COUNT))
BANK_FILES = {bank: PROJECT_ROOT / "src" / "data" / f"bank{bank}_story.inc" for bank in BANKS}
BANK_TEXT_FILES = {bank: PROJECT_ROOT / "src" / "data" / f"bank{bank}_text.inc" for bank in STORY_BANKS}
CONTEXT_LABEL_FILES = {bank: PROJECT_ROOT / "src" / "data" / f"bank{bank}_context_labels.inc" for bank in BANKS}
LOGIC_STORY_FILE = PROJECT_ROOT / "src" / "data" / "logic_story.inc"
SPLASH_CONFIG_FILE = PROJECT_ROOT / "src" / "data" / "splash_config.inc"
SPLASH_ART_FILE = PROJECT_ROOT / "src" / "data" / "splash_art.inc"
MOVEMENTS = ("north", "east", "south", "west")
ACTIONS = ("look", *MOVEMENTS, "next")
FLAG_EFFECTS = ("set", "clear", "toggle")
MAX_FLAGS = 64
MAX_PAGES_PER_BANK = 17
MAX_CONTEXT_ACTIONS_PER_SCENE = 6
MAX_CONTEXT_ACTIONS_PER_BANK = 8
MAX_CONTEXT_CONDITIONS = 4
MAX_CONTEXT_EFFECTS = 4
MAX_OBJECTS = 8
APPEARANCE_DEFAULTS = {
    "background_color": 0x82,
    "border_color": 0x84,
    "text_color": 0x0E,
    "action_text_color": 0x0E,
    "action_background_enabled": False,
    "action_background_color": 0x24,
    "border_style": "striped",
}
BORDER_STYLES = {"striped": 0, "solid": 1}
PAGE_ROWS = 10
ROW_WIDTH = 12
ID_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
ALLOWED_CHARACTERS = set(" )*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ")
SPLASH_TABLES = ("PF0DataA", "PF1DataA", "PF2DataA", "PF0DataB", "PF1DataB", "PF2DataB", "PFColors")
MAX_SPLASH_SOURCE_BYTES = 128 * 1024


class StoryError(ValueError):
    """Raised when editor data cannot be represented by the cartridge."""


def load_project(path: Path = PROJECT_FILE) -> dict[str, Any]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise StoryError(f"Project file does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise StoryError(f"Invalid JSON in {path}: {error}") from error
    return validate_project(raw)


def _migrate_v1(raw: dict[str, Any]) -> dict[str, Any]:
    """Convert the original one-page-per-room format without changing play."""
    pages = raw.get("pages")
    if not isinstance(pages, list):
        return raw
    rooms: list[dict[str, Any]] = []
    for page in pages:
        if not isinstance(page, dict):
            rooms.append(page)
            continue
        actions = page.get("actions") if isinstance(page.get("actions"), dict) else {}
        page_id = page.get("id")
        rooms.append({
            "id": page_id,
            "name": page.get("name", page_id),
            "position": page.get("position", {}),
            "entry_scene": page_id,
            "exits": {direction: actions.get(direction) for direction in MOVEMENTS},
            "scenes": [{
                "id": page_id,
                "name": page.get("name", page_id),
                "text": page.get("text"),
                "next": actions.get("next"),
                "exit_overrides": {},
            }],
        })
    return {
        "version": 2,
        "title": raw.get("title", "Text Adventure 2600"),
        "start_room": raw.get("start_page"),
        "rooms": rooms,
    }


def _clean_target(value: Any, label: str) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise StoryError(f"{label} must be an ID or empty")
    return value


def _flag_list(value: Any, label: str, flag_ids: set[str]) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise StoryError(f"{label} must be a list of flag IDs")
    if len(value) != len(set(value)):
        raise StoryError(f"{label} contains a duplicate flag")
    missing = [item for item in value if item not in flag_ids]
    if missing:
        raise StoryError(f"{label} references missing flag '{missing[0]}'")
    return list(value)


def parse_splash_asm(source: str) -> dict[str, Any]:
    """Extract the constrained playfield data emitted by the image exporter."""
    if not isinstance(source, str) or not source.strip():
        raise StoryError("Select a splash-screen ASM file")
    if len(source.encode("utf-8")) > MAX_SPLASH_SOURCE_BYTES:
        raise StoryError("Splash-screen ASM must be no larger than 128 KB")

    def constant(name: str) -> int:
        match = re.search(rf"(?im)^\s*{re.escape(name)}\s*=\s*#?(\d+)\s*(?:;.*)?$", source)
        if not match:
            raise StoryError(f"Splash ASM is missing {name}")
        return int(match.group(1))

    kernel_lines = constant("kernel_lines")
    line_count = constant("playfield_lines")
    line_height = constant("playfield_line_height")
    if kernel_lines != 192:
        raise StoryError("Splash ASM must use a 192-scanline kernel")
    if line_height != 2:
        raise StoryError("Splash ASM must use the 2 Scanline Kernel setting")
    if not 1 <= line_count <= 90:
        raise StoryError("Splash image height must be between 1 and 90 rows")
    if not re.search(r"(?im)^\s*sta\s+CTRLPF\b", source):
        raise StoryError("Splash ASM is not a mirrored playfield export")

    label_pattern = "|".join(map(re.escape, SPLASH_TABLES))
    tables: dict[str, list[int]] = {}
    for table in SPLASH_TABLES:
        match = re.search(
            rf"(?ims)^\s*{re.escape(table)}\s*:?[ \t]*(?:;[^\r\n]*)?\r?\n(.*?)(?=^\s*(?:{label_pattern})\s*:?[ \t]*(?:;[^\r\n]*)?\r?$|^\s*(?:ORG|SEG|END)\b|\Z)",
            source,
        )
        if not match:
            raise StoryError(f"Splash ASM is missing {table}")
        values: list[int] = []
        for data_line in re.findall(r"(?im)^\s*\.?(?:byte|dc\.b)\s+([^;\r\n]+)", match.group(1)):
            for token in data_line.split(","):
                token = token.strip()
                if re.fullmatch(r"%[01]{8}", token):
                    values.append(int(token[1:], 2))
                elif re.fullmatch(r"\$[0-9A-Fa-f]{1,2}", token):
                    values.append(int(token[1:], 16))
                elif re.fullmatch(r"\d{1,3}", token) and int(token) <= 255:
                    values.append(int(token))
                else:
                    raise StoryError(f"{table} contains unsupported byte value '{token}'")
        if len(values) != line_count:
            raise StoryError(f"{table} must contain {line_count} bytes; found {len(values)}")
        tables[table] = values
    return {"kernel_lines": kernel_lines, "line_count": line_count, "line_height": line_height, "tables": tables}


def _validate_splash(raw: Any) -> dict[str, Any]:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise StoryError("splash must be an object")
    enabled = raw.get("enabled", False)
    if not isinstance(enabled, bool):
        raise StoryError("splash.enabled must be true or false")
    filename = raw.get("filename", "")
    source = raw.get("source", "")
    if not isinstance(filename, str) or len(filename) > 128:
        raise StoryError("Splash filename is invalid")
    if not isinstance(source, str):
        raise StoryError("Splash source must be text")
    delay_frames = raw.get("delay_frames", 120)
    if isinstance(delay_frames, bool) or not isinstance(delay_frames, int) or not 0 <= delay_frames <= 255:
        raise StoryError("Splash delay must be between 0 and 255 frames")
    background_color = raw.get("background_color", 0)
    if isinstance(background_color, bool) or not isinstance(background_color, int) or not 0 <= background_color <= 255:
        raise StoryError("Splash background colour must be an Atari byte from 00 to FF")
    if background_color != 0:
        raise StoryError("Splash background must currently be $00 black")
    metadata = None
    if source.strip():
        parsed = parse_splash_asm(source)
        metadata = {key: parsed[key] for key in ("kernel_lines", "line_count", "line_height")}
    if enabled and metadata is None:
        raise StoryError("Enable splash requires a compatible ASM file")
    return {
        "enabled": enabled, "filename": Path(filename).name if filename else "",
        "source": source, "delay_frames": delay_frames,
        "background_color": 0, "metadata": metadata,
    }


def _validate_appearance(raw: Any) -> dict[str, Any]:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise StoryError("appearance must be an object")
    unknown = set(raw) - set(APPEARANCE_DEFAULTS)
    if unknown:
        raise StoryError(f"appearance has unknown field '{sorted(unknown)[0]}'")
    appearance = {**APPEARANCE_DEFAULTS, **raw}
    for field in ("background_color", "border_color", "text_color", "action_text_color", "action_background_color"):
        value = appearance[field]
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 0xFE or value & 1:
            raise StoryError(f"appearance.{field} must be an even Atari colour byte from 00 to FE")
    if not isinstance(appearance["action_background_enabled"], bool):
        raise StoryError("appearance.action_background_enabled must be true or false")
    if appearance["border_style"] not in BORDER_STYLES:
        raise StoryError("appearance.border_style must be striped or solid")
    return appearance


def _validate_appearance_overrides(raw: Any, label: str) -> dict[str, Any]:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise StoryError(f"{label}: appearance_overrides must be an object")
    unknown = set(raw) - set(APPEARANCE_DEFAULTS)
    if unknown:
        raise StoryError(f"{label}: appearance_overrides has unknown field '{sorted(unknown)[0]}'")
    overrides: dict[str, Any] = {}
    for field, value in raw.items():
        if field in ("background_color", "border_color", "text_color", "action_text_color", "action_background_color"):
            if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 0xFE or value & 1:
                raise StoryError(f"{label}: {field} must be an even Atari colour byte from 00 to FE")
        elif field == "action_background_enabled" and not isinstance(value, bool):
            raise StoryError(f"{label}: action_background_enabled must be true or false")
        elif field == "border_style" and value not in BORDER_STYLES:
            raise StoryError(f"{label}: border_style must be striped or solid")
        overrides[field] = value
    return overrides


def validate_project(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise StoryError("Project must be a JSON object")
    if raw.get("version", 1) == 1 or "rooms" not in raw:
        raw = _migrate_v1(raw)

    title = raw.get("title", "Text Adventure 2600")
    if not isinstance(title, str) or not title.strip() or len(title) > 80:
        raise StoryError("Project title must contain 1-80 characters")
    rooms = raw.get("rooms")
    if not isinstance(rooms, list) or not rooms:
        raise StoryError("The project needs at least one room")

    splash = _validate_splash(raw.get("splash"))
    appearance = _validate_appearance(raw.get("appearance"))
    raw_presets = raw.get("appearance_presets", [])
    if not isinstance(raw_presets, list) or len(raw_presets) > 32:
        raise StoryError("appearance_presets must contain at most 32 entries")
    appearance_presets: list[dict[str, Any]] = []
    preset_ids: set[str] = set()
    for index, raw_preset in enumerate(raw_presets):
        if not isinstance(raw_preset, dict):
            raise StoryError(f"appearance preset {index + 1} must be an object")
        preset_id = raw_preset.get("id")
        if not isinstance(preset_id, str) or not ID_PATTERN.fullmatch(preset_id):
            raise StoryError(f"appearance preset {index + 1} has an invalid ID")
        if preset_id in preset_ids:
            raise StoryError(f"Duplicate appearance preset ID: {preset_id}")
        name = raw_preset.get("name", "")
        if not isinstance(name, str) or not name.strip() or len(name) > 48:
            raise StoryError(f"{preset_id}: preset name must contain 1-48 characters")
        preset_ids.add(preset_id)
        appearance_presets.append({"id": preset_id, "name": name.strip(), "appearance": _validate_appearance(raw_preset.get("appearance"))})
    raw_flags = raw.get("flags", [])
    if not isinstance(raw_flags, list) or len(raw_flags) > MAX_FLAGS:
        raise StoryError(f"Project flags must be a list containing at most {MAX_FLAGS} entries")
    clean_flags: list[dict[str, Any]] = []
    flag_ids: set[str] = set()
    for index, raw_flag in enumerate(raw_flags):
        if not isinstance(raw_flag, dict):
            raise StoryError(f"flag {index + 1} must be an object")
        flag_id = raw_flag.get("id")
        if not isinstance(flag_id, str) or not ID_PATTERN.fullmatch(flag_id):
            raise StoryError(f"flag {index + 1} has an invalid ID")
        if flag_id in flag_ids:
            raise StoryError(f"Duplicate flag ID: {flag_id}")
        initial = raw_flag.get("initial", False)
        if not isinstance(initial, bool):
            raise StoryError(f"{flag_id}: initial must be true or false")
        flag_ids.add(flag_id)
        clean_flags.append({"id": flag_id, "initial": initial})
    raw_objects = raw.get("objects", [])
    if not isinstance(raw_objects, list) or len(raw_objects) > MAX_OBJECTS:
        raise StoryError(f"Project objects must be a list containing at most {MAX_OBJECTS} entries")
    clean_objects: list[dict[str, Any]] = []
    object_ids: set[str] = set()
    for index, raw_object in enumerate(raw_objects):
        if not isinstance(raw_object, dict) or set(raw_object) - {"id", "name", "initial_location"}:
            raise StoryError(f"object {index + 1} is invalid")
        object_id = raw_object.get("id")
        if not isinstance(object_id, str) or not ID_PATTERN.fullmatch(object_id):
            raise StoryError(f"object {index + 1} has an invalid ID")
        if object_id in object_ids:
            raise StoryError(f"Duplicate object ID: {object_id}")
        object_name = raw_object.get("name", "")
        if not isinstance(object_name, str) or not object_name.strip() or len(object_name) > ROW_WIDTH:
            raise StoryError(f"{object_id}: name must contain 1-{ROW_WIDTH} characters")
        object_name = object_name.upper()
        invalid = sorted(set(object_name) - ALLOWED_CHARACTERS)
        if invalid:
            raise StoryError(f"{object_id}: name has unsupported character(s): {''.join(invalid)}")
        initial_location = raw_object.get("initial_location")
        if not isinstance(initial_location, str) or not initial_location:
            raise StoryError(f"{object_id}: initial_location must name a room, carried, or removed")
        object_ids.add(object_id)
        clean_objects.append({"id": object_id, "name": object_name, "initial_location": initial_location})
    first_story_bank = STORY_BANKS[0]
    usable_bank_count = len(STORY_BANKS)
    clean_rooms: list[dict[str, Any]] = []
    room_ids: set[str] = set()
    scene_ids: set[str] = set()
    scene_count = 0

    for room_index, raw_room in enumerate(rooms):
        label = f"room {room_index + 1}"
        if not isinstance(raw_room, dict):
            raise StoryError(f"{label} must be an object")
        room_id = raw_room.get("id")
        if not isinstance(room_id, str) or not ID_PATTERN.fullmatch(room_id):
            raise StoryError(f"{label} has an invalid ID")
        if room_id in room_ids:
            raise StoryError(f"Duplicate room ID: {room_id}")
        room_ids.add(room_id)

        name = raw_room.get("name", room_id)
        if not isinstance(name, str) or not name.strip() or len(name) > 48:
            raise StoryError(f"{room_id}: name must contain 1-48 characters")
        position = raw_room.get("position", {})
        if not isinstance(position, dict):
            raise StoryError(f"{room_id}: position must be an object")
        try:
            x = max(20, int(position.get("x", 80 + (room_index % 4) * 240)))
            y = max(20, int(position.get("y", 80 + (room_index // 4) * 125)))
        except (TypeError, ValueError) as error:
            raise StoryError(f"{room_id}: map position must be numeric") from error

        raw_exits = raw_room.get("exits", {})
        if not isinstance(raw_exits, dict):
            raise StoryError(f"{room_id}: exits must be an object")
        unknown_exits = set(raw_exits) - set(MOVEMENTS)
        if unknown_exits:
            raise StoryError(f"{room_id}: unknown exit(s): {', '.join(sorted(unknown_exits))}")
        exits = {
            direction: _clean_target(raw_exits.get(direction), f"{room_id}: {direction} exit")
            for direction in MOVEMENTS
        }

        raw_scenes = raw_room.get("scenes")
        if not isinstance(raw_scenes, list) or not raw_scenes:
            raise StoryError(f"{room_id}: room needs at least one scene")
        clean_scenes: list[dict[str, Any]] = []
        local_scene_ids: set[str] = set()
        for scene_index, raw_scene in enumerate(raw_scenes):
            scene_label = f"{room_id} scene {scene_index + 1}"
            if not isinstance(raw_scene, dict):
                raise StoryError(f"{scene_label} must be an object")
            scene_id = raw_scene.get("id")
            if not isinstance(scene_id, str) or not ID_PATTERN.fullmatch(scene_id):
                raise StoryError(f"{scene_label} has an invalid ID")
            if scene_id in scene_ids:
                raise StoryError(f"Duplicate scene ID: {scene_id}")
            scene_ids.add(scene_id)
            local_scene_ids.add(scene_id)

            scene_name = raw_scene.get("name", scene_id)
            if not isinstance(scene_name, str) or not scene_name.strip() or len(scene_name) > 48:
                raise StoryError(f"{scene_id}: name must contain 1-48 characters")
            text = raw_scene.get("text")
            if not isinstance(text, list) or len(text) != PAGE_ROWS:
                raise StoryError(f"{scene_id}: text must contain exactly {PAGE_ROWS} rows")
            clean_text: list[str] = []
            for row_index, row in enumerate(text):
                if not isinstance(row, str):
                    raise StoryError(f"{scene_id} row {row_index + 1}: text must be a string")
                row = row.upper()
                if len(row) > ROW_WIDTH:
                    raise StoryError(f"{scene_id} row {row_index + 1}: maximum width is {ROW_WIDTH}")
                invalid = sorted(set(row) - ALLOWED_CHARACTERS)
                if invalid:
                    raise StoryError(
                        f"{scene_id} row {row_index + 1}: unsupported character(s): {''.join(invalid)}"
                    )
                clean_text.append(row)

            overrides = raw_scene.get("exit_overrides", {})
            if not isinstance(overrides, dict):
                raise StoryError(f"{scene_id}: exit_overrides must be an object")
            unknown_overrides = set(overrides) - set(MOVEMENTS)
            if unknown_overrides:
                raise StoryError(f"{scene_id}: unknown exit override(s): {', '.join(sorted(unknown_overrides))}")
            clean_overrides = {
                direction: _clean_target(value, f"{scene_id}: {direction} override")
                for direction, value in overrides.items()
            }
            clean_scenes.append({
                "id": scene_id,
                "name": scene_name.strip(),
                "bank": first_story_bank + scene_count // MAX_PAGES_PER_BANK,
                "text": clean_text,
                "next": _clean_target(raw_scene.get("next"), f"{scene_id}: NEXT target"),
                "exit_overrides": clean_overrides,
                "ending": bool(raw_scene.get("ending", False)),
                "appearance_preset": _clean_target(raw_scene.get("appearance_preset"), f"{scene_id}: appearance_preset"),
                "appearance_overrides": _validate_appearance_overrides(raw_scene.get("appearance_overrides"), scene_id),
                "effects": {},
                "context_actions": [],
            })
            raw_effects = raw_scene.get("effects", {})
            if not isinstance(raw_effects, dict) or set(raw_effects) - set(ACTIONS):
                raise StoryError(f"{scene_id}: effects must use valid action names")
            for action, raw_effect in raw_effects.items():
                if not isinstance(raw_effect, dict) or set(raw_effect) - set(FLAG_EFFECTS):
                    raise StoryError(f"{scene_id}: {action} effect is invalid")
                effect = {
                    operation: _flag_list(raw_effect.get(operation), f"{scene_id}: {action} {operation}", flag_ids)
                    for operation in FLAG_EFFECTS
                }
                used = [flag for operation in FLAG_EFFECTS for flag in effect[operation]]
                if len(used) != len(set(used)):
                    raise StoryError(f"{scene_id}: {action} cannot apply two effects to the same flag")
                if used:
                    clean_scenes[-1]["effects"][action] = effect
            raw_context_actions = raw_scene.get("context_actions", [])
            if not isinstance(raw_context_actions, list) or len(raw_context_actions) > MAX_CONTEXT_ACTIONS_PER_SCENE:
                raise StoryError(
                    f"{scene_id}: context_actions must contain at most {MAX_CONTEXT_ACTIONS_PER_SCENE} actions"
                )
            for action_index, raw_action in enumerate(raw_context_actions):
                action_label = f"{scene_id}: contextual action {action_index + 1}"
                if not isinstance(raw_action, dict) or set(raw_action) - {"label", "when_all", "when_clear", "requires_carried", "requires_here", "effects"}:
                    raise StoryError(f"{action_label} is invalid")
                label_text = raw_action.get("label", "")
                if not isinstance(label_text, str) or not label_text.strip() or len(label_text) > ROW_WIDTH:
                    raise StoryError(f"{action_label} label must contain 1-{ROW_WIDTH} characters")
                label_text = label_text.upper()
                invalid = sorted(set(label_text) - ALLOWED_CHARACTERS)
                if invalid:
                    raise StoryError(f"{action_label} has unsupported character(s): {''.join(invalid)}")
                when_all = _flag_list(raw_action.get("when_all"), f"{action_label} when_all", flag_ids)
                when_clear = _flag_list(raw_action.get("when_clear"), f"{action_label} when_clear", flag_ids)
                if set(when_all) & set(when_clear):
                    raise StoryError(f"{action_label} tests the same flag both set and clear")
                if len(when_all) + len(when_clear) > MAX_CONTEXT_CONDITIONS:
                    raise StoryError(f"{action_label} may test at most {MAX_CONTEXT_CONDITIONS} flags")
                raw_action_effects = raw_action.get("effects", {})
                if not isinstance(raw_action_effects, dict) or set(raw_action_effects) - (set(FLAG_EFFECTS) | {"take_object", "remove_object"}):
                    raise StoryError(f"{action_label} effects are invalid")
                action_effects = {
                    operation: _flag_list(raw_action_effects.get(operation), f"{action_label} {operation}", flag_ids)
                    for operation in FLAG_EFFECTS
                }
                used = [flag for operation in FLAG_EFFECTS for flag in action_effects[operation]]
                if len(used) != len(set(used)):
                    raise StoryError(f"{action_label} cannot apply two effects to the same flag")
                if len(used) > MAX_CONTEXT_EFFECTS:
                    raise StoryError(f"{action_label} may change at most {MAX_CONTEXT_EFFECTS} flags")
                requires_carried = _clean_target(raw_action.get("requires_carried"), f"{action_label} requires_carried")
                requires_here = _clean_target(raw_action.get("requires_here"), f"{action_label} requires_here")
                take_object = _clean_target(raw_action_effects.get("take_object"), f"{action_label} take_object")
                remove_object = _clean_target(raw_action_effects.get("remove_object"), f"{action_label} remove_object")
                for field, object_id in (("requires_carried", requires_carried), ("requires_here", requires_here), ("take_object", take_object), ("remove_object", remove_object)):
                    if object_id is not None and object_id not in object_ids:
                        raise StoryError(f"{action_label} {field} references missing object '{object_id}'")
                if take_object is not None and take_object == remove_object:
                    raise StoryError(f"{action_label} cannot take and remove the same object")
                clean_scenes[-1]["context_actions"].append({
                    "label": label_text, "when_all": when_all, "when_clear": when_clear,
                    "requires_carried": requires_carried, "requires_here": requires_here,
                    "effects": {**action_effects, "take_object": take_object, "remove_object": remove_object},
                })
            scene_count += 1

        entry_scene = raw_room.get("entry_scene", clean_scenes[0]["id"])
        if not isinstance(entry_scene, str) or entry_scene not in local_scene_ids:
            raise StoryError(f"{room_id}: entry_scene must name a scene in this room")
        raw_variants = raw_room.get("variants", [])
        if not isinstance(raw_variants, list):
            raise StoryError(f"{room_id}: variants must be a list")
        variants: list[dict[str, Any]] = []
        for variant_index, raw_variant in enumerate(raw_variants):
            if not isinstance(raw_variant, dict):
                raise StoryError(f"{room_id}: variant {variant_index + 1} must be an object")
            if set(raw_variant) - {"scene", "when_all", "when_clear"}:
                raise StoryError(f"{room_id}: variant {variant_index + 1} has unknown fields")
            variant_scene = raw_variant.get("scene")
            if not isinstance(variant_scene, str) or variant_scene not in local_scene_ids:
                raise StoryError(f"{room_id}: variant {variant_index + 1} scene must belong to this room")
            when_all = _flag_list(raw_variant.get("when_all"), f"{room_id}: variant {variant_index + 1} when_all", flag_ids)
            when_clear = _flag_list(raw_variant.get("when_clear"), f"{room_id}: variant {variant_index + 1} when_clear", flag_ids)
            if set(when_all) & set(when_clear):
                raise StoryError(f"{room_id}: variant {variant_index + 1} tests the same flag both set and clear")
            if not when_all and not when_clear:
                raise StoryError(f"{room_id}: variant {variant_index + 1} needs at least one condition")
            variants.append({"scene": variant_scene, "when_all": when_all, "when_clear": when_clear})
        clean_rooms.append({
            "id": room_id,
            "name": name.strip(),
            "position": {"x": x, "y": y},
            "appearance_preset": _clean_target(raw_room.get("appearance_preset"), f"{room_id}: appearance_preset"),
            "appearance_overrides": _validate_appearance_overrides(raw_room.get("appearance_overrides"), room_id),
            "entry_scene": entry_scene,
            "exits": exits,
            "scenes": clean_scenes,
            "variants": variants,
        })

    for room in clean_rooms:
        if room["appearance_preset"] is not None and room["appearance_preset"] not in preset_ids:
            raise StoryError(f"{room['id']}: appearance_preset references missing preset '{room['appearance_preset']}'")
        for scene in room["scenes"]:
            if scene["appearance_preset"] is not None and scene["appearance_preset"] not in preset_ids:
                raise StoryError(f"{scene['id']}: appearance_preset references missing preset '{scene['appearance_preset']}'")

    if scene_count > MAX_PAGES_PER_BANK * usable_bank_count:
        raise StoryError(
            f"The 32K cartridge supports at most {MAX_PAGES_PER_BANK * usable_bank_count} scenes"
        )
    start_room = raw.get("start_room", clean_rooms[0]["id"])
    if not isinstance(start_room, str) or start_room not in room_ids:
        raise StoryError("start_room must name an existing room")
    for object_record in clean_objects:
        location = object_record["initial_location"]
        if location not in room_ids and location not in {"carried", "removed"}:
            raise StoryError(f"{object_record['id']}: initial_location references missing room '{location}'")

    scene_room = {scene["id"]: room["id"] for room in clean_rooms for scene in room["scenes"]}
    for room in clean_rooms:
        for direction, target in room["exits"].items():
            if target is not None and target not in room_ids:
                raise StoryError(f"{room['id']}: {direction} points to missing room '{target}'")
        for scene in room["scenes"]:
            target = scene["next"]
            if target is not None:
                if target not in scene_room:
                    raise StoryError(f"{scene['id']}: NEXT points to missing scene '{target}'")
                if scene_room[target] != room["id"]:
                    raise StoryError(f"{scene['id']}: NEXT must point to a scene in the same room")
            for direction, target_room in scene["exit_overrides"].items():
                if target_room is not None and target_room not in room_ids:
                    raise StoryError(f"{scene['id']}: {direction} override points to missing room '{target_room}'")

    return {"version": 2, "title": title.strip(), "start_room": start_room, "appearance": appearance, "appearance_presets": appearance_presets, "splash": splash, "flags": clean_flags, "objects": clean_objects, "rooms": clean_rooms}


def scene_records(project: dict[str, Any]) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    return [(room, scene) for room in project["rooms"] for scene in room["scenes"]]


def bank_scenes(project: dict[str, Any], bank: int) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    return [(room, scene) for room, scene in scene_records(project) if scene["bank"] == bank]


def _effective_exit(room: dict[str, Any], scene: dict[str, Any], direction: str) -> str | None:
    return scene["exit_overrides"].get(direction, room["exits"][direction])


def generate_bank_source(project: dict[str, Any], bank: int) -> str:
    pages = bank_scenes(project, bank)
    locations: dict[str, tuple[int, int]] = {}
    for target_bank in BANKS:
        for index, (_, scene) in enumerate(bank_scenes(project, target_bank)):
            locations[scene["id"]] = (target_bank, index)
    rooms = {room["id"]: room for room in project["rooms"]}
    start_scene = rooms[project["start_room"]]["entry_scene"]
    start_bank, start_index = locations[start_scene]
    flag_indexes = {flag["id"]: index for index, flag in enumerate(project["flags"])}
    object_indexes = {record["id"]: index for index, record in enumerate(project["objects"])}

    def encoded_scene(scene_id: str) -> str:
        target_bank, target_index = locations[scene_id]
        return f"BANK_{target_bank}|{target_index}"

    initial_object_locations: list[str] = []
    for record in project["objects"]:
        location = record["initial_location"]
        if location == "carried":
            initial_object_locations.append("$FE")
        elif location == "removed":
            initial_object_locations.append("$FF")
        else:
            initial_object_locations.append(encoded_scene(rooms[location]["entry_scene"]))
    context_actions = [
        (page_index, action_index, action)
        for page_index, (_, scene) in enumerate(pages)
        for action_index, action in enumerate(scene["context_actions"])
    ]
    if len(context_actions) > MAX_CONTEXT_ACTIONS_PER_BANK:
        raise StoryError(f"Bank {bank} has more than {MAX_CONTEXT_ACTIONS_PER_BANK} contextual actions")
    initial_masks = [0] * 8
    for flag_id, flag_index in flag_indexes.items():
        if project["flags"][flag_index]["initial"]:
            initial_masks[flag_index // 8] |= 1 << (flag_index & 7)

    lines = [
        f"; GENERATED from editor/project.json - BANK {bank}",
        "; Rooms are flattened to runtime pages; do not edit this file directly.",
        "", f"START_BANK     equ {start_bank}", f"START_PAGE     equ {start_index}",
        "InitialFlags", "        dc.b " + ",".join(f"${value:02X}" for value in initial_masks),
        f"OBJECT_COUNT    equ {len(project['objects'])}",
        "InitialObjectLocations", "        dc.b " + (",".join(initial_object_locations) or "$FF"),
        "ObjectNameLo", "        dc.b " + (",".join(f"<ObjectName{index}" for index in range(len(project["objects"]))) or "<BlankLine"),
        "ObjectNameHi", "        dc.b " + (",".join(f">ObjectName{index}" for index in range(len(project["objects"]))) or ">BlankLine"), "",
        "PageTextLo",
        "        dc.b " + (",".join(f"<Page{index}Text" for index in range(len(pages))) or "0"),
        "PageTextHi",
        "        dc.b " + (",".join(f">Page{index}Text" for index in range(len(pages))) or "0"),
        "", "; LOOK, NORTH, EAST, SOUTH, WEST, NEXT", "PageActions",
    ]
    for room, scene in pages:
        targets: dict[str, str | None] = {"look": room["entry_scene"], "next": scene["next"]}
        for direction in MOVEMENTS:
            target_room = _effective_exit(room, scene, direction)
            targets[direction] = rooms[target_room]["entry_scene"] if target_room is not None else None
        encoded: list[str] = []
        for action in ACTIONS:
            target = targets[action]
            if target is None:
                encoded.append("NO_EXIT")
            else:
                target_bank, target_index = locations[target]
                encoded.append(f"BANK_{target_bank}|{target_index}")
        lines.append(f"        dc.b {','.join(encoded)} ; {room['id']} / {scene['id']}")
    if not pages:
        lines.append("        dc.b NO_EXIT ; bank intentionally empty")
    lines.extend(["", "; Logical room location for every physical scene page.", "PageRoomLocations"])
    if pages:
        lines.append("        dc.b " + ",".join(encoded_scene(room["entry_scene"]) for room, _ in pages))
    else:
        lines.append("        dc.b $FF")

    variant_labels: list[str] = []
    for index, (room, scene) in enumerate(pages):
        has_variants = scene["id"] == room["entry_scene"] and bool(room["variants"])
        variant_labels.append(f"Page{index}Variants" if has_variants else "NoVariants")
    lines.extend([
        "", "; Ordered conditional descriptions for each destination entry page.",
        "PageVariantLo", "        dc.b " + (",".join(f"<{label}" for label in variant_labels) or "<NoVariants"),
        "PageVariantHi", "        dc.b " + (",".join(f">{label}" for label in variant_labels) or ">NoVariants"),
        "NoVariants", "        dc.b $FE",
    ])
    for index, (room, scene) in enumerate(pages):
        if variant_labels[index] == "NoVariants":
            continue
        record_size = sum(len(rule["when_all"]) + len(rule["when_clear"]) + 2 for rule in room["variants"]) + 1
        if record_size > 250:
            raise StoryError(f"{room['id']}: variant rules are too large for the runtime resolver")
        lines.extend(["", f"Page{index}Variants"])
        for rule in room["variants"]:
            conditions = [f"${flag_indexes[flag]:02X}" for flag in rule["when_all"]]
            conditions += [f"${0x80 | flag_indexes[flag]:02X}" for flag in rule["when_clear"]]
            target_bank, target_index = locations[rule["scene"]]
            lines.append(f"        dc.b {','.join(conditions + ['$FF', f'BANK_{target_bank}|{target_index}'])}")
        lines.append("        dc.b $FE")

    effect_lines: list[str] = []
    for page_index, (_, scene) in enumerate(pages):
        for action_index, action in enumerate(ACTIONS):
            effect = scene["effects"].get(action)
            if not effect:
                continue
            operations: list[str] = []
            for operation_index, operation in enumerate(FLAG_EFFECTS):
                operations.extend(f"${operation_index * 0x40 | flag_indexes[flag]:02X}" for flag in effect[operation])
            effect_lines.append(f"        dc.b {page_index},{action_index},{','.join(operations)},$FF ; {scene['id']} {action}")
    effect_size = sum(len(line.split("dc.b ", 1)[1].split(" ;", 1)[0].split(",")) for line in effect_lines) + 1
    if effect_size > 250:
        raise StoryError(f"Bank {bank} has too many flag effects for the runtime table")
    lines.extend(["", "; page, action, encoded flag operations, $FF; table ends with $FE", "PageEffects"])
    lines.extend(effect_lines)
    lines.append("        dc.b $FE")

    context_labels: dict[tuple[int, int], str] = {
        (page_index, action_index): f"ContextLabel{page_index}_{action_index}"
        for page_index, action_index, _ in context_actions
    }
    context_pages = [f"Page{index}Context" if scene["context_actions"] else "NoContext" for index, (_, scene) in enumerate(pages)]
    lines.extend([
        "", "; Per-page contextual actions: label pointer, requirements, effects.",
        "PageContextLo", "        dc.b " + (",".join(f"<{label}" for label in context_pages) or "<NoContext"),
        "PageContextHi", "        dc.b " + (",".join(f">{label}" for label in context_pages) or ">NoContext"),
        "NoContext", "        dc.b 0",
    ])
    for page_index, (_, scene) in enumerate(pages):
        if not scene["context_actions"]:
            continue
        lines.extend(["", f"Page{page_index}Context", f"        dc.b {len(scene['context_actions'])}"])
        for action_index, action in enumerate(scene["context_actions"]):
            requirements = [f"${flag_indexes[flag]:02X}" for flag in action["when_all"]]
            requirements += [f"${0x80 | flag_indexes[flag]:02X}" for flag in action["when_clear"]]
            object_requirements: list[str] = []
            if action["requires_carried"] is not None:
                object_requirements.append(f"${object_indexes[action['requires_carried']]:02X}")
            if action["requires_here"] is not None:
                object_requirements.append(f"${0x40 | object_indexes[action['requires_here']]:02X}")
            operations: list[str] = []
            for operation_index, operation in enumerate(FLAG_EFFECTS):
                operations.extend(f"${operation_index * 0x40 | flag_indexes[flag]:02X}" for flag in action["effects"][operation])
            object_operations: list[str] = []
            if action["effects"]["take_object"] is not None:
                object_operations.append(f"${object_indexes[action['effects']['take_object']]:02X}")
            if action["effects"]["remove_object"] is not None:
                object_operations.append(f"${0x40 | object_indexes[action['effects']['remove_object']]:02X}")
            lines.append(f"        dc.w {context_labels[(page_index, action_index)]}")
            lines.append(f"        dc.b {','.join(requirements + ['$FF'])}")
            lines.append(f"        dc.b {','.join(object_requirements + ['$FF'])}")
            lines.append(f"        dc.b {','.join(operations + ['$FF'])}")
            lines.append(f"        dc.b {','.join(object_operations + ['$FF'])}")

    for index, (room, scene) in enumerate(pages):
        lines.append("")
        if index % 2 == 0:
            lines.append("        align $100")
        lines.extend([f"; {room['id']} / {scene['id']} - {scene['name']}", f"Page{index}Text"])
        for row in scene["text"]:
            encoded_row = row.ljust(ROW_WIDTH).replace(" ", "[")
            lines.append(f'        dc.b "{encoded_row}"')
    lines.append("")
    return "\n".join(lines)


def generate_context_labels(project: dict[str, Any], bank: int) -> str:
    pages = bank_scenes(project, bank)
    actions = [
        (page_index, action_index, action)
        for page_index, (_, scene) in enumerate(pages)
        for action_index, action in enumerate(scene["context_actions"])
    ]
    if len(actions) > MAX_CONTEXT_ACTIONS_PER_BANK:
        raise StoryError(f"Bank {bank} has more than {MAX_CONTEXT_ACTIONS_PER_BANK} contextual actions")
    if len(actions) + len(project["objects"]) > 18:
        raise StoryError(f"Bank {bank} contextual labels plus object names exceed the stable label page")
    lines = [f"; GENERATED contextual labels and object names for BANK {bank}", "        align $100"]
    for page_index, action_index, action in actions:
        encoded = action["label"].ljust(ROW_WIDTH).replace(" ", "[")
        lines.append(f'ContextLabel{page_index}_{action_index} dc.b "{encoded}"')
    for index, record in enumerate(project["objects"]):
        encoded = record["name"].ljust(ROW_WIDTH).replace(" ", "[")
        lines.append(f'ObjectName{index} dc.b "{encoded}"')
    lines.append("")
    return "\n".join(lines)


def _f4_layout(project: dict[str, Any]) -> tuple[list[tuple[dict[str, Any], dict[str, Any]]], dict[str, tuple[int, int]], dict[str, int]]:
    pages = scene_records(project)
    locations: dict[str, tuple[int, int]] = {}
    indexes: dict[str, int] = {}
    for global_index, (_, scene) in enumerate(pages):
        bank = STORY_BANKS[global_index // MAX_PAGES_PER_BANK]
        local_page = global_index % MAX_PAGES_PER_BANK
        locations[scene["id"]] = (bank, local_page)
        indexes[scene["id"]] = global_index
    return pages, locations, indexes


def _encoded_f4_scene(locations: dict[str, tuple[int, int]], scene_id: str) -> str:
    bank, page = locations[scene_id]
    return f"BANK_{bank}|{page}"


def generate_bank_source(project: dict[str, Any], bank: int) -> str:
    """Generate the small renderer-local pointer block for an F4 story bank."""
    pages = bank_scenes(project, bank)
    lines = [f"; GENERATED renderer metadata - F4 BANK {bank}", f"OBJECT_COUNT equ {len(project['objects'])}"]
    lines.extend([
        "ObjectNameLo", "        dc.b " + (",".join(f"<ObjectName{i}" for i in range(len(project["objects"]))) or "<BlankLine"),
        "ObjectNameHi", "        dc.b " + (",".join(f">ObjectName{i}" for i in range(len(project["objects"]))) or ">BlankLine"),
        "PageTextLo", "        dc.b " + (",".join(f"<Page{i}Text" for i in range(len(pages))) or "0"),
        "PageTextHi", "        dc.b " + (",".join(f">Page{i}Text" for i in range(len(pages))) or "0"), "",
    ])
    return "\n".join(lines)


def generate_bank_text(project: dict[str, Any], bank: int) -> str:
    pages = bank_scenes(project, bank)
    lines = [f"; GENERATED text records - F4 BANK {bank}", "        org $F700"]
    for index, (room, scene) in enumerate(pages):
        if index % 2 == 0:
            lines.append("        align $100")
        lines.extend([f"; {room['id']} / {scene['id']} - {scene['name']}", f"Page{index}Text"])
        lines.extend(f'        dc.b "{row.ljust(ROW_WIDTH).replace(" ", "[")}"' for row in scene["text"])
    presets = {preset["id"]: preset["appearance"] for preset in project["appearance_presets"]}
    effective = [
        {
            **project["appearance"],
            **presets.get(room["appearance_preset"], {}),
            **room["appearance_overrides"],
            **presets.get(scene["appearance_preset"], {}),
            **scene["appearance_overrides"],
        }
        for room, scene in pages
    ]
    effective.extend(project["appearance"] for _ in range(MAX_PAGES_PER_BANK - len(effective)))
    lines.extend(["", "; Six bytes per scene; 17 scenes occupy $FF78-$FFDD.", "        org $FF78"])

    def emit(label: str, values: list[str]) -> None:
        lines.append(label)
        for offset in range(0, len(values), 16):
            lines.append("        dc.b " + ",".join(values[offset:offset + 16]))

    emit("SceneBackgroundColors", [f"${item['background_color']:02X}" for item in effective])
    emit("SceneBorderColors", [f"${item['border_color']:02X}" for item in effective])
    emit("SceneTextColors", [f"${item['text_color']:02X}" for item in effective])
    emit("SceneActionTextColors", [f"${item['action_text_color']:02X}" for item in effective])
    emit("SceneActionBackgroundColors", [f"${(item['action_background_color'] if item['action_background_enabled'] else item['background_color']):02X}" for item in effective])
    ending_styles = [BORDER_STYLES[item["border_style"]] | (0x80 if scene["ending"] else 0) for item, (_, scene) in zip(effective[:len(pages)], pages)]
    ending_styles.extend(BORDER_STYLES[project["appearance"]["border_style"]] for _ in range(MAX_PAGES_PER_BANK - len(ending_styles)))
    emit("SceneBorderStyles", [f"${value:02X}" for value in ending_styles])
    lines.append("")
    return "\n".join(lines)


def generate_context_labels(project: dict[str, Any], bank: int) -> str:
    """Story banks only need inventory names; context labels live in logic bank 1."""
    lines = [f"; GENERATED renderer strings - F4 BANK {bank}", "        align $100"]
    for index, record in enumerate(project["objects"]):
        lines.append(f'ObjectName{index} dc.b "{record["name"].ljust(ROW_WIDTH).replace(" ", "[")}"')
    lines.append("")
    return "\n".join(lines)


def generate_logic_source(project: dict[str, Any]) -> str:
    pages, locations, indexes = _f4_layout(project)
    rooms = {room["id"]: room for room in project["rooms"]}
    flag_indexes = {flag["id"]: index for index, flag in enumerate(project["flags"])}
    object_indexes = {record["id"]: index for index, record in enumerate(project["objects"])}
    start_scene = rooms[project["start_room"]]["entry_scene"]
    start_bank, start_page = locations[start_scene]
    initial_masks = [0] * 8
    for index, flag in enumerate(project["flags"]):
        if flag["initial"]:
            initial_masks[index // 8] |= 1 << (index & 7)
    initial_objects: list[str] = []
    for record in project["objects"]:
        location = record["initial_location"]
        if location == "carried": initial_objects.append("$FE")
        elif location == "removed": initial_objects.append("$FF")
        else: initial_objects.append(_encoded_f4_scene(locations, rooms[location]["entry_scene"]))

    lines = [
        "; GENERATED global story logic for 32K F4 bank 1", "        org $F500",
        f"START_BANK equ {start_bank}", f"START_PAGE equ {start_page}", f"START_SCENE equ {indexes[start_scene]}",
        "InitialFlags", "        dc.b " + ",".join(f"${value:02X}" for value in initial_masks),
        f"OBJECT_COUNT equ {len(project['objects'])}", "InitialObjectLocations", "        dc.b " + (",".join(initial_objects) or "$FF"),
        "StoryBankOffsets", "        dc.b 0,0,0,17,34,51,68,85", "",
    ]
    def emit_table(label: str, values: list[str]) -> None:
        lines.append(label)
        for offset in range(0, len(values), 16):
            lines.append("        dc.b " + ",".join(values[offset:offset + 16]))

    action_columns: list[list[str]] = [[] for _ in ACTIONS]
    for room, scene in pages:
        targets: dict[str, str | None] = {"look": room["entry_scene"], "next": scene["next"]}
        for direction in MOVEMENTS:
            target_room = _effective_exit(room, scene, direction)
            targets[direction] = rooms[target_room]["entry_scene"] if target_room is not None else None
        for action_index, action in enumerate(ACTIONS):
            target = targets[action]
            action_columns[action_index].append("NO_EXIT" if target is None else _encoded_f4_scene(locations, target))
    for action, values in zip(ACTIONS, action_columns):
        emit_table("PageAction" + action.title(), values)
    lines.extend(["ActionTableLo", "        dc.b " + ",".join(f"<PageAction{a.title()}" for a in ACTIONS),
                  "ActionTableHi", "        dc.b " + ",".join(f">PageAction{a.title()}" for a in ACTIONS)])
    emit_table("PageRoomLocations", [_encoded_f4_scene(locations, room["entry_scene"]) for room, _ in pages])
    emit_table("PageEndings", ["1" if scene["ending"] else "0" for _, scene in pages])

    variant_labels: list[str] = []
    for global_index, (room, scene) in enumerate(pages):
        variant_labels.append(f"Scene{global_index}Variants" if scene["id"] == room["entry_scene"] and room["variants"] else "NoVariants")
    emit_table("PageVariantLo", [f"<{label}" for label in variant_labels])
    emit_table("PageVariantHi", [f">{label}" for label in variant_labels])
    lines.extend(["NoVariants", "        dc.b $FE"])
    for global_index, (room, _) in enumerate(pages):
        if variant_labels[global_index] == "NoVariants": continue
        lines.append(f"Scene{global_index}Variants")
        for rule in room["variants"]:
            conditions = [f"${flag_indexes[flag]:02X}" for flag in rule["when_all"]]
            conditions += [f"${0x80 | flag_indexes[flag]:02X}" for flag in rule["when_clear"]]
            lines.append("        dc.b " + ",".join(conditions + ["$FF", _encoded_f4_scene(locations, rule["scene"])]))
        lines.append("        dc.b $FE")

    effect_lines: list[str] = []
    for global_index, (_, scene) in enumerate(pages):
        for action_index, action in enumerate(ACTIONS):
            effect = scene["effects"].get(action)
            if not effect: continue
            operations: list[str] = []
            for operation_index, operation in enumerate(FLAG_EFFECTS):
                operations.extend(f"${operation_index * 0x40 | flag_indexes[flag]:02X}" for flag in effect[operation])
            effect_lines.append(f"        dc.b {global_index},{action_index},{','.join(operations)},$FF")
    lines.extend(["PageEffects", *effect_lines, "        dc.b $FE"])

    contexts: list[tuple[int, int, dict[str, Any]]] = []
    context_pages: list[str] = []
    for global_index, (_, scene) in enumerate(pages):
        context_pages.append(f"Scene{global_index}Context" if scene["context_actions"] else "NoContext")
        contexts.extend((global_index, action_index, action) for action_index, action in enumerate(scene["context_actions"]))
    emit_table("PageContextLo", [f"<{label}" for label in context_pages])
    emit_table("PageContextHi", [f">{label}" for label in context_pages])
    lines.extend(["NoContext", "        dc.b 0"])
    for global_index, (_, scene) in enumerate(pages):
        if not scene["context_actions"]: continue
        lines.extend([f"Scene{global_index}Context", f"        dc.b {len(scene['context_actions'])}"])
        for action_index, action in enumerate(scene["context_actions"]):
            requirements = [f"${flag_indexes[flag]:02X}" for flag in action["when_all"]]
            requirements += [f"${0x80 | flag_indexes[flag]:02X}" for flag in action["when_clear"]]
            object_requirements: list[str] = []
            if action["requires_carried"] is not None: object_requirements.append(f"${object_indexes[action['requires_carried']]:02X}")
            if action["requires_here"] is not None: object_requirements.append(f"${0x40 | object_indexes[action['requires_here']]:02X}")
            operations: list[str] = []
            for operation_index, operation in enumerate(FLAG_EFFECTS):
                operations.extend(f"${operation_index * 0x40 | flag_indexes[flag]:02X}" for flag in action["effects"][operation])
            object_operations: list[str] = []
            if action["effects"]["take_object"] is not None: object_operations.append(f"${object_indexes[action['effects']['take_object']]:02X}")
            if action["effects"]["remove_object"] is not None: object_operations.append(f"${0x40 | object_indexes[action['effects']['remove_object']]:02X}")
            lines.extend([f"        dc.w ContextLabel{global_index}_{action_index}",
                          "        dc.b " + ",".join(requirements + ["$FF"]),
                          "        dc.b " + ",".join(object_requirements + ["$FF"]),
                          "        dc.b " + ",".join(operations + ["$FF"]),
                          "        dc.b " + ",".join(object_operations + ["$FF"])])
    for global_index, action_index, action in contexts:
        lines.append(f'ContextLabel{global_index}_{action_index} dc.b "{action["label"].ljust(ROW_WIDTH).replace(" ", "[")}"')
    lines.append("")
    return "\n".join(lines)


def generated_sources(project: dict[str, Any]) -> dict[Path, str]:
    outputs = {BANK_FILES[bank]: generate_bank_source(project, bank) for bank in BANKS}
    outputs.update({BANK_TEXT_FILES[bank]: generate_bank_text(project, bank) for bank in STORY_BANKS})
    outputs.update({CONTEXT_LABEL_FILES[bank]: generate_context_labels(project, bank) for bank in BANKS})
    outputs[LOGIC_STORY_FILE] = generate_logic_source(project)
    splash = project["splash"]
    rooms = {room["id"]: room for room in project["rooms"]}
    start_scene = rooms[project["start_room"]]["entry_scene"]
    start_bank = next(scene["bank"] for _, scene in scene_records(project) if scene["id"] == start_scene)
    outputs[SPLASH_CONFIG_FILE] = "\n".join([
        "; GENERATED from editor/project.json - do not edit",
        f"SPLASH_ENABLED     equ {1 if splash['enabled'] else 0}",
        f"SPLASH_DELAY_FRAMES equ {splash['delay_frames']}",
        f"SPLASH_START_BANK  equ {start_bank}",
        f"SPLASH_BACKGROUND_COLOR equ ${splash['background_color']:02X}",
        f"GAME_BACKGROUND_COLOR equ ${project['appearance']['background_color']:02X}",
        f"GAME_BORDER_COLOR equ ${project['appearance']['border_color']:02X}",
        f"GAME_TEXT_COLOR equ ${project['appearance']['text_color']:02X}",
        f"GAME_ACTION_TEXT_COLOR equ ${project['appearance']['action_text_color']:02X}",
        f"GAME_ACTION_BACKGROUND_ENABLED equ {1 if project['appearance']['action_background_enabled'] else 0}",
        f"GAME_ACTION_BACKGROUND_COLOR equ ${project['appearance']['action_background_color']:02X}",
        f"GAME_BORDER_STYLE equ {BORDER_STYLES[project['appearance']['border_style']]}",
        "",
    ])
    art_lines = ["; GENERATED splash art - do not edit"]
    if splash["source"].strip():
        parsed = parse_splash_asm(splash["source"])
        art_lines.extend([
            f"SPLASH_PLAYFIELD_LINES equ {parsed['line_count']}",
            f"SPLASH_LINE_HEIGHT     equ {parsed['line_height']}",
            "SPLASH_PADDING_LINES   equ 1",
            # Two scanlines in the visible phase are consumed by kernel
            # alignment/transition outside these counted loops.  Unlike the
            # original ABB loop, our kernel also renders row zero, so it must
            # not retain ABB's +2 compensation for the omitted final row.
            "SPLASH_REMAINING_LINES equ 192-SPLASH_PLAYFIELD_LINES*SPLASH_LINE_HEIGHT-SPLASH_PADDING_LINES-2",
        ])
        for table in SPLASH_TABLES:
            art_lines.extend(["", "        align $100", f"Splash{table}"])
            values = parsed["tables"][table]
            for offset in range(0, len(values), 12):
                art_lines.append("        dc.b " + ",".join(f"${value:02X}" for value in values[offset:offset + 12]))
    else:
        art_lines.extend(["SPLASH_PLAYFIELD_LINES equ 1", "SPLASH_LINE_HEIGHT equ 2", "SPLASH_PADDING_LINES equ 1", "SPLASH_REMAINING_LINES equ 187"])
        for table in SPLASH_TABLES:
            art_lines.extend(["", f"Splash{table}", "        dc.b $00"])
    art_lines.append("")
    outputs[SPLASH_ART_FILE] = "\n".join(art_lines)
    return outputs


def _atomic_write(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(value)
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def save_project(raw: Any, path: Path = PROJECT_FILE) -> dict[str, Any]:
    project = validate_project(raw)
    outputs = generated_sources(project)
    outputs[path] = json.dumps(project, indent=2, ensure_ascii=False) + "\n"
    previous = {target: target.read_bytes() if target.exists() else None for target in outputs}
    try:
        for target, value in outputs.items():
            _atomic_write(target, value)
    except OSError:
        for target, value in previous.items():
            if value is None:
                try:
                    target.unlink()
                except FileNotFoundError:
                    pass
            else:
                target.write_bytes(value)
        raise
    return project


def generate(path: Path = PROJECT_FILE) -> dict[str, Any]:
    project = load_project(path)
    for target, value in generated_sources(project).items():
        _atomic_write(target, value)
    return project


def continuation_warnings(project: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    for room in project["rooms"]:
        next_by_id = {scene["id"]: scene["next"] for scene in room["scenes"]}
        for scene in room["scenes"]:
            seen: set[str] = set()
            current: str | None = scene["id"]
            while current is not None and current not in seen:
                seen.add(current)
                current = next_by_id.get(current)
            if current is not None:
                warning = f"{room['name']}: NEXT cycle includes {current}"
                if warning not in warnings:
                    warnings.append(warning)
                break
    return warnings


def project_summary(project: dict[str, Any]) -> dict[str, Any]:
    characters_per_page = PAGE_ROWS * ROW_WIDTH
    bank_summaries = {}
    for bank in BANKS:
        pages = bank_scenes(project, bank)
        authored = sum(len(row.rstrip()) for _, scene in pages for row in scene["text"])
        bank_summaries[str(bank)] = {
            "pages": len(pages), "capacity": MAX_PAGES_PER_BANK,
            "allocated_characters": len(pages) * characters_per_page,
            "authored_characters": authored,
            "available_characters": (MAX_PAGES_PER_BANK - len(pages)) * characters_per_page,
            "maximum_characters": MAX_PAGES_PER_BANK * characters_per_page,
        }
    page_count = len(scene_records(project))
    usable_banks = list(STORY_BANKS)
    return {
        "banks": bank_summaries, "rooms": len(project["rooms"]), "pages": page_count,
        "flags": len(project["flags"]), "flag_ram_bytes": 8,
        "objects": len(project["objects"]), "object_ram_bytes": len(project["objects"]),
        "context_actions": sum(len(scene["context_actions"]) for _, scene in scene_records(project)),
        "rows_per_page": PAGE_ROWS, "characters_per_row": ROW_WIDTH,
        "characters_per_page": characters_per_page,
        "maximum_characters": MAX_PAGES_PER_BANK * characters_per_page * len(usable_banks),
        "available_characters": sum(bank_summaries[str(bank)]["available_characters"] for bank in usable_banks),
        "story_banks": usable_banks, "splash": project["splash"],
        "actions": list(ACTIONS), "start_room": project["start_room"],
        "warnings": continuation_warnings(project),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=PROJECT_FILE)
    parser.add_argument("--check", action="store_true", help="validate without generating assembly")
    parser.add_argument("--migrate", action="store_true", help="save the validated project in the latest format")
    args = parser.parse_args()
    project = load_project(args.project)
    if args.migrate:
        project = save_project(project, args.project)
    elif not args.check:
        generate(args.project)
    summary = project_summary(project)
    print(
        f"Validated {summary['rooms']} rooms and {summary['pages']} scenes (" + ", ".join(
            f"bank {bank}: {summary['banks'][str(bank)]['pages']}" for bank in BANKS
        ) + ")."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
