# Contextual actions example: Castle of the Two Keys

The bundled project demonstrates contextual actions whose availability depends
on flags, objects, containers, and the current scene.

## OPEN CHEST and TAKE BRASS

At Forest Shrine, OPEN CHEST:

- requires `CHEST_OPEN` clear;
- requires Chest here;
- SETs `CHEST_OPEN`;
- stays in the current room.

The room variant now displays the open chest and makes the contained Brass Key
available. TAKE BRASS then:

- requires Brass Key here;
- SETs `BRASS_TAKEN`;
- takes Brass Key into Inventory.

The action is impossible while the chest is closed because an item inside a
closed container does not satisfy **Must be here**.

## USE BRASS at Castle Gate

USE BRASS:

- requires `CASTLE_OPEN` clear;
- requires Brass Key carried;
- SETs `CASTLE_OPEN`;
- removes Brass Key;
- stays in the current room.

The gate's room variant immediately changes to Castle Gate - Open. Its scene
override provides the new NORTH exit into Great Hall. Returning later still
shows the open gate because `CASTLE_OPEN` remains set.

## MOVE STATUE and TAKE SILVER

In Statue Gallery, MOVE STATUE SETs `STATUE_MOVED`. The room then resolves to
a scene revealing the Silver Key. TAKE SILVER requires that key here, SETs
`SILVER_TAKEN`, and takes it into Inventory. A more-specific room variant
then displays the empty hiding place.

This demonstrates why variant order matters: the rule requiring both
`STATUE_MOVED` and `SILVER_TAKEN` must appear before the rule requiring only
`STATUE_MOVED`.

## USE SILVER with a destination

At Tower Door, USE SILVER:

- requires `TOWER_OPEN` clear;
- requires Silver Key carried;
- SETs `TOWER_OPEN`;
- removes Silver Key;
- uses **After action: Enter room - Tower Stairs**.

The effects run before the destination. The player therefore reaches Tower
Stairs with the door already open and the key already consumed. Returning to
Tower Door displays its open variant.

## Failure and victory actions

TOUCH SKULL in Low Dungeon SETs `SKULL_TOUCHED`. Its room variant selects an
ending scene, so only Restart remains available.

TAKE CROWN in Crown Room SETs `CURSE_BROKEN`. The victory variant is also an
ending scene. Restart restores every flag and object to its initial state and
returns to Ashen Moor.

## Choosing the After action destination

- **Stay in current room** resolves that room again after the effects. Use this
  for OPEN CHEST, MOVE STATUE, and actions that reveal a variant.
- **Enter room** moves to the destination room's primary or matching
  conditional scene. USE SILVER demonstrates this.
- **Show specific scene** goes directly to one chosen scene. It is useful for
  READ NOTE, CLIMB ROPE, traps, conversations, and direct endings.

## Testing the complete route

1. Reach Forest Shrine, OPEN CHEST, and TAKE BRASS.
2. Return to Castle Gate and USE BRASS.
3. Enter Great Hall and move WEST to Statue Gallery.
4. MOVE STATUE and TAKE SILVER.
5. Return through Great Hall and Old Library to Tower Door.
6. USE SILVER and confirm that Tower Stairs appears immediately.
7. Continue to Crown Room and TAKE CROWN to test victory and Restart.

Only matching contextual actions are offered, so actions requiring unavailable
objects or incorrect flag states do not appear in the cartridge action list.
