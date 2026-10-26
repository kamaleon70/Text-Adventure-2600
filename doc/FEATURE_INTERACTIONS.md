# How the gameplay features work together

Text Adventure 2600 separates the visible story from the small amount of state
that the Atari must remember. Most puzzles follow the same sequence:

1. a room or scene supplies the current text and location;
2. flags and object locations record what has happened;
3. a contextual action checks those facts;
4. the action changes flags or objects;
5. the action stays in the room, enters another room, or shows a specific
   scene;
6. room variants and appearance settings display the result.

## Complete example: chest, key, and castle gate

### 1. Create the state flags

Create these flags under **Flags & variants**:

- `CHEST_OPEN`, initially clear;
- `CASTLE_OPEN`, initially clear.

Each flag stores one fact. The first remembers whether the chest is open. The
second remembers whether the castle gate has been unlocked.

### 2. Create the objects

Under **Objects**, create:

- a container named `Chest`, located in Forest Shrine, using `CHEST_OPEN` as
  its open-state flag;
- a portable item named `Brass Key`, initially located **Inside: Chest**.

The key remains inside the chest while it is closed. It satisfies **Must be
here** only when the chest is in the current room and `CHEST_OPEN` is set.

### 3. Open the chest

On the shrine's closed scene, add `OPEN CHEST`:

- Require clear: `CHEST_OPEN`;
- Must be here: Chest;
- SET flags: `CHEST_OPEN`;
- After action: Stay in current room.

Add a room variant that displays an open-chest scene when `CHEST_OPEN` is set.
Executing OPEN CHEST changes the flag and then resolves the room again, so the
new description appears immediately.

### 4. Take the key

On the open-chest scene, add `TAKE KEY`:

- Must be here: Brass Key;
- Take object: Brass Key;
- After action: Stay in current room.

The action is unavailable while the chest is closed. After it runs, the key's
location becomes carried and it appears in Inventory.

### 5. Unlock and enter the castle

At Castle Gate, add `USE KEY`:

- Require clear: `CASTLE_OPEN`;
- Must be carried: Brass Key;
- SET flags: `CASTLE_OPEN`;
- Remove object: Brass Key, if the lock consumes it;
- After action: Enter room - Castle Hall.

Effects run before the destination is followed. The player therefore enters
Castle Hall with `CASTLE_OPEN` already set and the key already removed.

### 6. Show the lasting result

Add a Castle Gate variant requiring `CASTLE_OPEN` and select an open-gate
scene. If the player later returns, the gate remains open because the flag is
persistent. The open scene may also select a brighter appearance preset.

## When to use each feature

- Use a **room** for a navigable location with shared exits.
- Use a **scene** for one ten-line display, a continuation page, a conditional
  description, or an ending.
- Use **NEXT** only to read another scene in the same room. NEXT is initially
  selected when the link exists.
- Use **LOOK** to return to the room's primary or first matching conditional
  scene.
- Use a **flag** for a persistent yes/no fact such as a powered generator,
  opened door, or discovered secret.
- Use an **object** for a portable item or container whose location matters.
- Use a **room variant** when the room description depends on flags.
- Use a **contextual action** when a command should appear only under specific
  flag or object requirements.
- Use **After action: Enter room** when the action itself moves the player.
- Use **After action: Show specific scene** for notes, traps, conversations,
  victory, or failure text that should not use ordinary movement.
- Use an **ending scene** when only Restart should remain available.
- Use an **appearance preset** to give an area or state a reusable colour
  scheme.

## Additional interaction examples

### Turn on the lights

`USE SWITCH` SETs `POWER_ON` and stays in the room. A variant requiring
`POWER_ON` displays the lit scene, which selects a brighter appearance preset.

### Read a note

`READ NOTE` requires the note to be here and uses **Show specific scene** to
display its message. LOOK returns to the room's resolved description.

### Trigger a trap

`OPEN DOOR` can require `TRAP_DISABLED` clear and go directly to an ending
scene. If `TRAP_DISABLED` is set, a higher-priority safe variant or a different
contextual action can lead into the next room instead.

### Use a key without consuming it

Omit **Remove object** when the same key should open several locks. Each lock
can set a different flag while all actions require the same carried key.

## Testing interactions

Use Playtest to check both sides of every condition:

1. confirm an action is unavailable before its requirements are met;
2. use the flag and object debuggers to create the required state;
3. confirm the action appears;
4. execute it and inspect flags, object locations, destination, text, and
   appearance;
5. leave and return to verify persistent state;
6. use **Reset to start room** and confirm all initial values are restored.

Finally, repeat the important route in the compiled ROM using Javatari, Stella,
or compatible hardware.
