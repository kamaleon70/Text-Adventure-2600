# Objects, containers, actions, and inventory

## Object types and limits

The engine supports up to eight objects in total. Each object is either:

- a **portable item**, which may be in a room, inside a container, carried, or
  removed from play;
- a **container**, which remains in a room and uses flags for its open and
  optional locked states.

The eight records share eight Atari RAM bytes. Adding containers does not
consume extra scene capacity, but every container uses one of the eight object
slots.

## Portable-item example

Create an object with:

- Object ID: `silver_key`;
- Display name: `SILVER KEY`;
- Type: Portable item;
- Initial location: Statue Gallery.

On the gallery scene, create TAKE SILVER:

- Must be here: Silver Key;
- Take object: Silver Key;
- After action: Stay in current room.

The action appears only while the key is present. Taking it changes the key's
location to carried, so it disappears from the room and appears in Inventory.

## Inventory

Inventory lists every portable item whose current location is carried. Pressing
Fire returns to the game.

The object debugger in Playtest can move an item directly to a room, container,
Inventory, or Removed state. These debug changes are temporary and are reset by
**Reset to start room**.

## Containers

A container needs:

- an initial room;
- an open-state flag;
- optionally, a locked-state flag.

An item can use **Inside: Container name** as its initial location. It satisfies
**Must be here** only while that container is in the current room and its open
flag is set. Closing the container hides its remaining contents without moving
or deleting them.

### Example: chest containing a key

Create:

- `CHEST_OPEN`, initially clear;
- `CHEST_LOCKED`, initially set if the chest should begin locked;
- a Chest container using those flags;
- a Brass Key portable item initially Inside: Chest.

Typical actions are:

### OPEN CHEST

- Require clear: `CHEST_OPEN`;
- Require clear: `CHEST_LOCKED`, when the chest is lockable;
- Must be here: Chest;
- SET: `CHEST_OPEN`.

### CLOSE CHEST

- Require set: `CHEST_OPEN`;
- Must be here: Chest;
- CLEAR: `CHEST_OPEN`.

### UNLOCK

- Require set: `CHEST_LOCKED`;
- Must be carried: the required key;
- CLEAR: `CHEST_LOCKED`;
- optionally Remove object: the key.

### TAKE KEY

- Must be here: Brass Key;
- Take object: Brass Key.

TAKE KEY is automatically unavailable while the chest is closed because the
contained key does not count as present.

## Using and consuming objects

**Must be carried** makes an action available only when the player has the
selected portable item. **Remove object** moves an item to the permanent removed
state until Restart.

Example: USE FUSE requires Fuse carried and `FUSE_INSTALLED` clear. It SETs
`FUSE_INSTALLED`, removes Fuse, and stays in the room. A room variant requiring
that flag immediately displays the powered machinery.

Omit Remove object when the same item should remain reusable. A master key can
therefore unlock several doors while each door sets a different flag.

## Objects interacting with room variants

Room variants test flags rather than object locations directly. Let the action
that manipulates the object also change a meaningful flag:

- TAKE CROWN SETs `CROWN_TAKEN`;
- USE FUSE SETs `POWER_ON`;
- OPEN CHEST SETs `CHEST_OPEN`.

The room can then select text and appearance based on that lasting fact.

## Runtime location values

Generated ROM data encodes locations compactly:

```text
$00-$F0  generated packed room-entry locations
$F1-$F8  inside container object slots 0-7
$FE      carried by the player
$FF      removed or consumed
```

Authors do not need to enter these values; the editor and compiler generate
them from the selected object locations.
