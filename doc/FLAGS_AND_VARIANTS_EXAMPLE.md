# Working flag example: Dock lamp

The checked-in editor project contains a complete Phase 2 example using the
first room.

## Records in the project

- Flag: `DOCK_LAMP_OFF`, initially clear.
- Primary scene: `room_1_dock`.
- Conditional scene: `room_1_dock_dark`.
- Room variant: when `DOCK_LAMP_OFF` is set, show `room_1_dock_dark`.
- Primary-scene `NEXT` effect: set `DOCK_LAMP_OFF` and show the dark scene.
- Dark-scene `NEXT` effect: clear `DOCK_LAMP_OFF` and return to the primary
  scene.

## Testing in the browser or cartridge

1. Start in Room 1 - Dock.
2. Press Fire to enter action mode.
3. Move once to select `NEXT`, release the controls, and press Fire.
4. The lamp-dark description appears and the flag remains set.
5. Move out of the dock and return. The dark description is selected again.
6. Use `NEXT` on the dark scene to clear the flag and restore the original
   description.

The Playtest tab also exposes `DOCK_LAMP_OFF` in its Flag debugger. Changing
that checkbox lets an author inspect either room state immediately.

## Room exits versus scene overrides

Room exits are the normal NORTH/EAST/SOUTH/WEST connections shared by every
scene in a room. Scene movement overrides are not a second required set of
exits. Leave the **Optional movement overrides** section closed and inherited
unless one particular scene needs to block or redirect a room exit.
