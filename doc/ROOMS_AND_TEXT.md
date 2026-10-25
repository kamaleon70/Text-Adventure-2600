# Rooms, scenes, and continuation text

## Why rooms and pages should be separate

The current engine treats every ten-row text page as a destination. That is
adequate for navigation, but it makes a second screen of description look like
a separate room. The next model should use:

- **Room** — a location with exits and interactions.
- **Scene** — one ten-row page displayed for that room.
- **Continuation** — another scene reached with `NEXT`, still belonging to the
  same room.
- **Variant** — an alternate scene selected because game state changed.

A room may therefore contain a primary scene, zero or more continuation
scenes, and optional conditional variants.

## Implemented editor model

```json
{
  "id": "shaft",
  "name": "Deep Shaft",
  "exits": {
    "north": "core",
    "south": "flood",
    "west": "lab"
  },
  "entry_scene": "shaft_dark_1",
  "scenes": [
    {
      "id": "shaft_dark_1",
      "text": ["ROOM 6 SHAFT", "..."],
      "next": "shaft_dark_2",
      "exit_overrides": {}
    },
    {
      "id": "shaft_dark_2",
      "text": ["COLD AIR", "RISES BELOW.", "..."],
      "next": null,
      "exit_overrides": {
        "south": null
      }
    }
  ]
}
```

Room exits are inherited by every scene. An `exit_overrides` entry can redirect
one movement for a particular scene or use `null` to disable it. Omitting that
direction from `exit_overrides` preserves inheritance.

## Runtime strategy

### Current implementation

The generator keeps the current page records. It copies the effective parent
room movement destinations into every scene and compiles `NEXT` as another
page destination. This delivers multi-page rooms with no additional runtime
RAM.

### Later implementation

Add one-byte `CurrentRoom` and keep `CurrentPage` as the selected scene. On a
movement action:

1. follow the room exit;
2. set `CurrentRoom`;
3. resolve its entry variant;
4. set `CurrentPage` to the selected scene.

On `NEXT`, change only `CurrentPage`. The player remains in `CurrentRoom`.

## Editor behavior

- The world graph should display rooms, not continuation pages.
- Double-clicking a room opens its scene list.
- Each scene editor keeps the existing ten 12-character rows.
- `NEXT` is selected from scenes in the same room.
- A warning should appear if a continuation points to itself or forms an
  accidental endless loop.
- Space calculations still count every scene because every one consumes a
  120-byte text record.

## Limits

- A scene always costs 120 bytes even when most rows are blank.
- Continuations reduce the number of distinct rooms that fit in the ROM.
- Two scenes still pack efficiently into one 256-byte aligned text block.
- The generator must keep enforcing `$00` and `$78` starting offsets to retain
  stable scanline timing.
