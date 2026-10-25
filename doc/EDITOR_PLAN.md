# Web editor plan

## Keep cartridge details in Debug

The normal workflow should remain story-oriented. Physical bank assignment,
page indexes, encoded destinations, and ROM addresses belong in the Debug tab.
Automatic packing should continue whenever rooms or scenes are reordered.

## Room editor

Phase 1 implemented the flat-page replacement as this hierarchy:

```text
Dock
  Primary description
  Continuation 2
Store
  Closed-crate description
  Open-crate description
```

The world graph now contains only room boxes. Selecting a scene beneath a room
opens the room and scene controls. Implemented Phase 1 controls include:

- exits;
- scene list;
- primary scene and start-room selection;
- per-scene exit overrides.

Objects initially present in a room remain later-phase work. Conditional
variants and contextual interactions are implemented.

## Scene editor

The scene editor now provides:

- scene name and role: primary or continuation;
- `NEXT` scene selector limited to the same room;
- inherited room exits with explicit redirect/disable overrides;
- exact ROM cost;
- warnings for cyclic continuation scenes.

Variant/result roles and unreachable-scene analysis remain later-phase work.

## Flags panel

Implemented in Phase 2.

Provide a project-wide list of named flags. The editor assigns bit indexes and
shows usage such as:

```text
TORCH_LIT          used by Shaft variant, USE TORCH
STORE_CRATE_OPEN   used by Store variant, OPEN/CLOSE BOX
```

Deleting a referenced flag must be blocked or require explicit confirmation.

The current editor blocks deletion while a variant or action effect still
references the flag. It also provides ordered room rules, SET/CLEAR/TOGGLE
effects for every existing action, and live flag controls in browser playtest.

## Objects panel (implemented)

For every object, the current editor provides:

- ID and short cartridge name;
- an initial room, carried state, or removed state;
- contextual requirements for carried or present objects;
- take and consume/remove effects.

The editor reports object count and RAM cost. The current single-page inventory
profile supports eight objects.

## Interaction editor

Use a structured rule form:

- room;
- cartridge label, previewed at twelve characters;
- required carried object;
- flags required set or clear;
- flags to set or clear;
- object movement or consumption;
- result scene or destination room.

The editor should automatically hide impossible combinations and identify
rules shadowed by an earlier rule.

## Playtest improvements

The browser playtest should simulate:

- game flags;
- object locations;
- contextual action availability;
- room variant resolution;
- inventory;
- reset to the configured start room and initial object state.

Add a Debug drawer that allows flags and object locations to be changed while
testing. This makes puzzle states testable without repeatedly playing from the
beginning.

## Generator validation

Saving or building should reject:

- more objects or flags than the configured RAM budget;
- action labels wider than twelve characters;
- references to missing rooms, scenes, flags, or objects;
- a start room without an entry scene;
- scene chains that cannot terminate unless explicitly marked as loops;
- physical bank overflow after automatic packing;
- text records at timing-unsafe offsets.
