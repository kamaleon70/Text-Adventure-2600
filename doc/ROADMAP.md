# Gameplay roadmap

## Phase 1 — Multiple pages per room (implemented)

Goal: allow a long description or story sequence without creating a fake room
for every screen of text.

- Add a logical room ID to every editor page.
- Designate one page as the room's primary page.
- Allow `NEXT` to point to another page in the same room.
- Visually nest continuation pages beneath their room in the editor.
- Have continuation pages inherit the room's exits unless explicitly changed.
- Keep the current runtime page format initially; most of this phase can be a
  generator/editor improvement.

Acceptance test: Room 1 has three screens. `NEXT` advances through them, and
movement from the last screen still uses Room 1's exits.

Implementation status:

- project format version 2 stores logical rooms with nested scenes;
- every room designates a primary/entry scene and owns its movement exits;
- `NEXT` is restricted to scenes in the same room;
- scenes inherit room exits and may explicitly redirect or disable an exit;
- the world graph contains room boxes only, while the editor sidebar nests
  scenes beneath each room;
- the generator flattens scenes into the existing banked runtime page format,
  so this phase consumes no additional Atari RAM;
- version-1 projects are migrated without changing their existing navigation.

## Phase 2 — Persistent flags and room variants (implemented)

Goal: descriptions can change after an event.

- Reserve eight RAM bytes for 64 boolean game flags.
- Add named flags to the project, such as `TORCH_LIT`, `BOX_OPEN`, and
  `LAB_POWERED`.
- Add conditional room variants to the editor.
- Resolve a room's displayed page when entering it and when performing `LOOK`.
- Add simple effects: set flag, clear flag, and toggle flag.

Acceptance test: the shaft is dark initially. Using the torch sets
`TORCH_LIT`; the shaft immediately shows its lit description and continues to
do so when the player returns.

Implementation status:

- eight bytes of RAM store 64 persistent flags;
- the editor manages named flags and their initial values;
- rooms have ordered variants with flags required set or clear;
- scene actions can SET, CLEAR, or TOGGLE flags before following their link;
- entering a room or performing `LOOK` resolves the first matching variant;
- the browser playtest simulates effects and includes a live flag debugger;
- the Phase 2 engine reduced safe packing from 18 to 16 scenes per story bank;
  Phase 3 reserved additional ROM and advertised 12 scenes per bank; Phase 4
  now advertises 10 scenes per bank.

## Phase 3 — Contextual actions (implemented)

Goal: add useful verbs without a parser or a large menu.

- Expand action mode beyond `LOOK` and `NEXT`.
- Generate only actions valid in the current state, such as `TAKE FUSE`,
  `USE FUSE`, or `OPEN BOX`.
- Cycle actions with the joystick and confirm with Fire.
- Keep all action labels to twelve characters.
- Define requirements and effects in ROM records rather than hard-coded room
  branches.

Acceptance test: `TAKE FUSE` appears only beside the open crate and disappears
after the fuse is taken. `USE FUSE` appears at the powerless lift only while
the player carries it.

Implementation status:

- each scene may define up to six twelve-character contextual actions;
- flag requirements decide which actions appear in action mode;
- actions apply SET, CLEAR, and TOGGLE effects from compact bank-local records;
- joystick directions cycle only currently valid choices and Fire confirms;
- movement remains immediate outside action mode;
- the saved project demonstrates `TAKE FUSE` in the store and `USE FUSE` at
  the shaft, including persistent room-description changes;
- labels occupy a page-aligned ROM area so switching actions does not introduce
  a display-kernel page-cross timing variation.

## Phase 4 — Objects and inventory (implemented)

Goal: portable objects persist as the player moves.

- Support up to eight portable objects.
- Store one location byte per object in RAM.
- Derive inventory membership from the location byte; do not keep a redundant
  inventory bitset.
- Add a read-only inventory screen generated from ROM object names.
- Support `TAKE`, contextual `USE`, and optionally `DROP` after the core flow
  is stable.

Acceptance test: the fuse can be taken in the store, appears in inventory,
can power the lift, and cannot be taken twice.

Implementation status:

- eight RAM bytes at `$B4-$BB` hold one location per object;
- `$FE` means carried and `$FF` means removed or consumed;
- contextual actions can require an object here or carried, and can take or
  remove an object;
- `INVENTORY` is a built-in action, with object names read directly from ROM;
- Fire returns from the inventory screen without changing rooms;
- the editor has an Objects tab, object-aware interaction controls, and an
  object-location debugger in browser playtest;
- the fuse example is a real object initially located in the Store, carried
  after `TAKE FUSE`, and removed after `USE FUSE` powers the Shaft.

## Phase 5 — Containers

Goal: support boxes, crates, lockers, doors, and similar stateful objects.

- Mark objects as portable or container-like in ROM.
- Store open/closed and locked/unlocked states as game flags.
- Allow object locations to represent “inside container N.”
- Show `OPEN`, `CLOSE`, and possibly `UNLOCK` only when valid.
- Reveal contained objects only while their container is open.

Acceptance test: opening a crate changes the room description and reveals the
fuse; closing it hides the fuse again without losing its location.

## Phase 6 — Game-specific polish

- Sound cues for taking, using, opening, failure, and success.
- A compact status or inventory view.
- Win/lose scenes and restart behavior.
- Rule validation in the editor: unreachable rooms, impossible requirements,
  missing object names, and continuation loops.
- PAL palette/timing review if a PAL build is desired.

## Features to postpone

The following would consume disproportionate RAM or UI complexity and should
wait until the basic game works:

- free-form text parsing;
- arbitrary `USE object ON object` combinations;
- large numeric statistics or RPG combat;
- save-game support without additional cartridge hardware;
- per-room RAM state for every room.
