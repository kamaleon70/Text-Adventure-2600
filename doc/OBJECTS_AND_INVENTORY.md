# Objects, contextual actions, and inventory

## Avoid a parser

Typing or constructing arbitrary commands is a poor fit for one joystick
button. The engine should expose contextual actions already containing their
object:

```text
TAKE: FUSE
USE: FUSE
OPEN: BOX
CLOSE: BOX
INVENTORY
```

Contextual rows can omit the current `ACT:` prefix to use all twelve columns.
Labels must still fit the twelve-character action row. The editor can show the
exact padded cartridge rendering and reject labels that are too long.

Movement remains direct. Fire enters action mode, a direction cycles through
the currently valid actions, and Fire confirms. Only valid actions are shown.

## Object ROM definition

The implemented object definition stores:

- ID and short display name;
- initial location;
- its initial room, `carried`, or `removed` state.

Example:

```json
{
  "id": "fuse",
  "name": "FUSE",
  "initial_location": "room_2_store"
}
```

## Object locations in RAM

Use one byte per portable or movable object:

```text
$00-$E9  generated packed bank/page room-entry values
$FE      carried by player
$FF      removed/consumed
```

With this scheme, a separate inventory bitset is unnecessary. An object is in
inventory when its location equals `$FE`.

The current engine supports eight objects. This keeps every inventory item
visible on one screen and reserves exactly eight RAM bytes regardless of how
many definitions are currently used.

## Contextual interaction records

The editor should define interactions rather than arbitrary object pairs:

```json
{
  "room": "shaft",
  "label": "USE FUSE",
  "requires_carried": "fuse",
  "requires_clear": ["FUSE_INSTALLED"],
  "effects": {
    "set": ["FUSE_INSTALLED"],
    "remove_object": "fuse"
  },
  "result_scene": "shaft_powered"
}
```

Generated ROM records can be searched only when entering action mode, not on
every frame. Small games can use a linear search; indexing by room can be added
if profiling shows it is necessary.

## Inventory screen

Do not build a 120-byte inventory page in RAM; that would consume almost the
entire console memory. Instead, make the display choose each inventory row
from fixed object-name strings in ROM:

1. scan object locations for `$FE`;
2. choose up to eight object-name pointers;
3. display those names using the existing line builder;
4. show `FIRE: RETURN` on the final row.

The engine prepares eleven ROM pointers during VBLANK (22 RAM bytes), then the
visible kernel performs one constant-time pointer lookup per row. This avoids a
120-byte text buffer and, importantly, prevents object scanning from overrunning
the 192-line visible timer.

## Containers and boxes

A container uses:

- a ROM definition (`openable`, optionally `lockable`);
- one or two persistent flag bits (`OPEN`, optionally `UNLOCKED`);
- object-location codes `$E0-$EF` for its contents.

Rules:

- `OPEN BOX` appears only while it is closed and accessible.
- `CLOSE BOX` appears only while it is open.
- contained objects can be seen or taken only while open.
- closing a box does not move or destroy its contents.
- taking an object changes its location from the container code to `$FE`.

The room resolver can use the same `BOX_OPEN` flag to select an alternate room
description, so opening the box visibly changes the scene.
