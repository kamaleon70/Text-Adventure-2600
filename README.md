# Text Adventure 2600 (32K F4)

Text Adventure 2600 is a browser-based editor and cartridge engine for creating
Atari 2600 text adventures. Its renderer began with Steven E. Hugg's CC0
`tinyfonts2.a` example. Release and licensing details are in `LICENSING.md`,
`ROM_OUTPUT_EXCEPTION.md`, and `NOTICE.md`.

Current editor version: **0.6 beta**.

Each scene has ten rows of 12 characters. The engine owns the eleventh row for
movement, LOOK/NEXT, inventory, and contextual actions.

## Visual editor

Start the local editor from the project root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start_editor.ps1
```

It normally opens `http://127.0.0.1:8765/`. If that port is unavailable, the
launcher automatically uses the next available port and opens the correct URL.
The PowerShell window always displays the address in use. To request a different
starting port, add—for example—`-Port 9000`. The editor provides:

- a draggable logical-room map with primary and continuation scenes;
- room exits, per-scene overrides, and same-room NEXT links;
- 64 persistent flags, eight portable items or containers, conditional descriptions, and contextual actions with optional room or scene destinations;
- configurable Atari background, border, text, and action-row colours, with reusable room presets and per-scene overrides;
- an optional colour splash-screen importer;
- browser-local draft recovery plus portable Save/Load config files;
- browser-only DASM assembly, ROM download, and embedded Javatari playtesting;
- an in-app manual for people using the hosted editor on itch.io.

The launcher is a PowerShell-only, loopback static server. It does not require
Python, Node.js, DASM, an installation step, or administrator privileges. Keep
the PowerShell window open while using the editor and press Ctrl+C to stop it.
The browser compiler and Javatari are bundled locally, so the editor does not
depend on an external compiler or CDN.

## 32K cartridge layout and capacity

The ROM uses standard F4 bankswitching and contains eight 4K banks:

- bank 0: optional splash screen, or immediate startup when disabled;
- bank 1: shared navigation, flags, objects, variants, and action logic;
- banks 2-7: the timed renderer, font, and local scene text.

Each of the six story banks holds 17 scenes. The editor therefore supports up
to **102 scenes** and **12,240 fixed story characters**. Enabling the splash
does not reduce story capacity. Scenes are assigned automatically in room and
scene order; authors do not select banks.

The split design keeps global logic in bank 1 while each story bank contains
only the cycle-sensitive renderer and its local text. Cross-bank entry points
are fixed so the engine can safely alternate between the selected story bank
and the shared logic bank every frame.

## Build and run

The editor's **Build & download** button assembles the current editor contents
and downloads `textadventure2600.bin`. **Build & run Javatari** assembles the
same 32K image and inserts it into the bundled emulator as an F4 cartridge.

For a native build, DASM is expected at
`C:\Projects\atari\utilities\dasm\dasm.exe`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

The result is `bin\text_adventure_f4.bin`, exactly 32,768 bytes, plus separate
bank binaries, listings, and symbol files under `bin\`.

## Optional colour splash

The **Splash screen** tab accepts the asymmetric colour ASM exported by
[Atari Background Builder](https://alienbill.com/2600/atari-background-builder/)
with these settings:

- Render Type: `ASM Asymmetrical (Mirrored) color`
- Kernel: `2 Scanline Kernel`
- Height: 1-90 rows
- Background: `$00` (black)

The importer reads only `PF0DataA` through `PF2DataB` and `PFColors`; uploaded
instructions are never compiled into the game. The picture is shown for the
configured delay and then waits for a released and newly pressed Fire button.

## Controls

- Joystick directions attempt NORTH, EAST, SOUTH, or WEST directly.
- Fire enters action mode, initially selecting NEXT when the scene has a continuation link and LOOK otherwise.
- In action mode, move to select LOOK, NEXT, inventory, or a contextual action, then press Fire to execute it.
- Release the joystick and Fire between inputs; held controls do not repeat.

## Project data

`editor/project.json` is the authoritative project. The local editor's Save
project action writes it and regenerates the assembly data. Direct edits to
generated `.inc` files are overwritten.

Text is stored as ten fixed 12-byte rows per scene. Spaces become the font's
`[` blank glyph. The generator aligns pairs of scenes at offsets `$00` and
`$78` inside 256-byte pages, preserving constant-time indexed reads in the
display kernel.

The destination byte uses its upper three bits for the F4 bank and lower five
bits for the local page. A separate global scene index lets bank 1 resolve
flags, variants, objects, and contextual actions for any of the 102 scenes.

## RAM use

The engine statically uses RIOT RAM `$80-$DE`. This includes the 30-byte font
buffer, eight bytes for 64 flags, eight item/container locations, prepared inventory
rows, and a 12-byte action-line buffer. `$DF-$FF` remains available for the
6507 stack, giving 33 bytes of stack headroom.

## Main files

- `src/engine.asm` — shared logic and timed text renderer roles
- `src/boot.asm` — immediate bank-0 startup when no splash is enabled
- `src/splash.asm` — optional splash kernel and bank-1 handoff
- `src/text_adventure_font.inc` — 4×5 font lookup tables
- `src/bank0.asm` through `src/bank7.asm` — physical F4 banks
- `src/data/logic_story.inc` — generated global story tables
- `src/data/bank2_text.inc` through `bank7_text.inc` — generated scene text
- `tools/story_model.py` — validation and native assembly generation
- `editor/story_compiler.js` — matching browser-side generator
- `build.ps1` — validates, assembles, and joins the eight banks

## License and generated games

The editor source is released under AGPL-3.0. A separate ROM output exception
allows generated games to be freeware, commercial, open-source, or
closed-source without publishing their project files.

**Text Adventure 2600** may be used free of charge to create and distribute
Atari 2600 text-adventure ROMs, including free and commercial games.

Games created with the engine must include the following credit in their
documentation, download page, or other accompanying material:

> *Created with Text Adventure 2600 by kamaleon70*<br>
> [*https://kamaleon70.itch.io/text-adventures-2600*](https://kamaleon70.itch.io/text-adventures-2600)

See `LICENSING.md` and `ROM_OUTPUT_EXCEPTION.md` for the exact terms.
