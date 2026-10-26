# Working flag example: Forest Shrine chest

The bundled **Castle of the Two Keys** project demonstrates flags, ordered room
variants, a container, and a portable object in Forest Shrine.

## Records in the project

- `CHEST_OPEN`, initially clear;
- `BRASS_TAKEN`, initially clear;
- primary scene: Shrine - Chest Closed;
- conditional scene: Shrine - Key Revealed;
- conditional scene: Shrine - Empty Chest;
- Chest container using `CHEST_OPEN`;
- Brass Key initially located inside Chest.

## Ordered room variants

Forest Shrine checks these rules from top to bottom:

1. when `CHEST_OPEN` and `BRASS_TAKEN` are set, show Shrine - Empty Chest;
2. when `CHEST_OPEN` is set and `BRASS_TAKEN` is clear, show Shrine - Key
   Revealed;
3. otherwise show the primary closed-chest scene.

The empty-chest rule must come first because it is more specific. If the
key-revealed rule were first, it could hide the empty scene.

## Actions and state changes

OPEN CHEST:

- requires `CHEST_OPEN` clear;
- requires Chest here;
- SETs `CHEST_OPEN`;
- stays in the current room.

The room is resolved again and displays Shrine - Key Revealed. The Brass Key
now satisfies **Must be here** because its container is open.

TAKE BRASS:

- requires Brass Key here;
- SETs `BRASS_TAKEN`;
- takes Brass Key into Inventory.

The room resolves again and displays Shrine - Empty Chest.

CLOSE CHEST clears `CHEST_OPEN`, returning the room to its primary closed
description without moving or deleting any remaining contents.

## Testing

1. Move EAST from Thorn Wood into Forest Shrine.
2. Enter action mode, select OPEN CHEST, and confirm the revealed-key scene.
3. Select TAKE BRASS and confirm the empty-chest scene.
4. Open Inventory and confirm BRASS KEY is carried.
5. Leave and return; the persistent flags select the same empty-chest state.
6. Use **Reset to start room** and verify the chest is closed and the key is
   inside it again.

The Playtest flag and object debuggers can force each state without replaying
the complete route.
