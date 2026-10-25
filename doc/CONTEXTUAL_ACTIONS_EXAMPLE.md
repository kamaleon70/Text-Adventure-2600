# Contextual actions example

The checked-in editor project contains a complete two-room example using the
real portable-object system.

## Store: TAKE FUSE

The primary Store scene defines `TAKE FUSE` with:

- requirement clear: `FUSE_TAKEN`;
- object required here: `fuse`;
- effect set: `FUSE_TAKEN`;
- object effect: take `fuse`.

The action therefore appears only before the fuse has been taken. Selecting it
sets the persistent fact, moves the fuse to inventory, immediately resolves
the room again, and selects the
`Store - fuse taken` description. Returning later still shows the empty-crate
description and does not offer `TAKE FUSE` again.

## Shaft: USE FUSE

The primary Shaft scene defines `USE FUSE` with:

- object required carried: `fuse`;
- requirement clear: `FUSE_INSTALLED`;
- effect set: `FUSE_INSTALLED`;
- object effect: remove `fuse`.

Before taking the fuse, this action is absent. After taking it, the action is
available at the shaft. Selecting it consumes the carried object, sets the
permanent installed state, and changes the shaft to its powered variant.

## Test in the cartridge

1. Start at the Dock and move East to the Store.
2. Press and release Fire to enter action mode.
3. Tap any direction until `TAKE FUSE` is on the bottom row.
4. Release the joystick, then press Fire to select it.
5. Enter action mode again and select `INVENTORY`; `FUSE` is listed. Press
   Fire to return.
6. Move North to the Lab, then East to the Shaft.
7. Enter action mode and select `USE FUSE`.
8. The shaft description changes to show that the lift is powered, and the
   fuse is no longer in inventory.

The browser Playtest tab exposes the same actions as buttons and shows the
three flags in its debugger.

## Editor fields

Open **Flags & variants**, choose a scene under **Contextual actions**, and add
or edit actions there. A label may contain at most twelve supported Atari
characters. Each scene supports six actions; one physical bank supports eight.
One action may test up to four flags and change up to four flags; these limits
keep joystick handling safely inside overscan.
Only matching actions are offered by the cartridge, so the player never needs
to attempt an obviously invalid command.
