# Development plans

This folder records design notes for the 32K F4 text-adventure
engine. The plans deliberately work within the Atari 2600's 128 bytes of RAM,
one joystick button, fixed 12-character rows, and cycle-sensitive display.

## Documents

- [ROADMAP.md](ROADMAP.md) — recommended implementation order and milestones.
- [ROOMS_AND_TEXT.md](ROOMS_AND_TEXT.md) — logical rooms, multiple scenes, and
  `NEXT` pages belonging to the same room.
- [CONDITIONS_AND_VARIANTS.md](CONDITIONS_AND_VARIANTS.md) — flags and
  conditional descriptions such as a dark room changing when a torch is lit.
- [FLAGS_AND_VARIANTS_EXAMPLE.md](FLAGS_AND_VARIANTS_EXAMPLE.md) — walkthrough
  of the working dock-lamp example saved in the editor project.
- [CONTEXTUAL_ACTIONS_EXAMPLE.md](CONTEXTUAL_ACTIONS_EXAMPLE.md) — walkthrough
  of the saved TAKE FUSE / USE FUSE example and its flag requirements.
- [OBJECTS_AND_INVENTORY.md](OBJECTS_AND_INVENTORY.md) — portable objects,
  contextual verbs, containers, and a compact inventory.
- [EDITOR_PLAN.md](EDITOR_PLAN.md) — corresponding additions to the web editor.
- [RAM_AND_ROM_BUDGET.md](RAM_AND_ROM_BUDGET.md) — concrete memory budgets and
  limits that should be checked after every milestone.
- [RELEASE_AND_LICENSING.md](RELEASE_AND_LICENSING.md) — commercial/free
  release requirements, third-party notices, and possible licensing for the
  editor and generated games.
- [WINDOWS_PORTABLE_APP_PLAN.md](WINDOWS_PORTABLE_APP_PLAN.md) — proposed
  Tauri-based portable Windows ZIP, including architecture, source-exposure
  limits, licensing gates, packaging, and staged implementation.

## Guiding decisions

1. Keep movement immediate on the joystick.
2. Offer only actions that make sense in the current room. `TAKE FUSE` is much
   easier to use than a general verb/object parser with one button.
3. Store descriptions, rules, names, and maps in ROM. Reserve RAM for only the
   facts that can change during play.
4. Treat a room and a displayed text page as different concepts. One room may
   have several descriptions and continuation pages.
5. Keep the display kernel unchanged while gameplay is added in VBLANK or
   overscan. Stable scanline timing remains a release requirement.
6. Keep executable code at matching addresses in all eight banks. A bankswitch
   may occur only from common code.
7. Retain the stable 12-character renderer. The separately published
   13-character demo is not part of this project.

These are plans, not promises that every feature must be implemented. Each
roadmap phase produces a useful, testable cartridge on its own.
