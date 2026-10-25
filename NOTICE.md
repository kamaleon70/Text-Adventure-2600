# Source and third-party notice

Text Adventure 2600 is copyright (c) 2026 kamaleon70. Project-owned portions
are licensed under AGPL-3.0 with the additional Generated ROM permission in
`ROM_OUTPUT_EXCEPTION.md`. See `LICENSING.md` for a plain-language overview.

## Text renderer

The display code began from Steven E. Hugg's `tinyfonts2.a` Atari 2600 example.
Samples in the 8bitworkshop `presets/` directory are released under CC0 unless
a sample states otherwise. Text Adventure 2600 adds its own positioning, rows,
page/action controller, story system, and 32K F4 bank structure.

Suggested acknowledgement:

> Text renderer adapted from Steven E. Hugg's CC0 Atari 2600
> `tinyfonts2.a` example, published by 8bitworkshop.

The separate Fellowship and Qotile demonstrations used during early research
are not part of this release and are not assembled into generated ROMs.

The two `reference/abb*.asm` files are example artwork exports created with
Alien Bill's Atari Background Builder and are retained only as splash-importer
test fixtures. No code from those exports is assembled by the editor.

## Javatari

The embedded emulator is Javatari 5.0.3, copyright Paulo Augusto Peccin,
licensed under AGPL-3.0. Its licence is at `editor/javatari.LICENSE.txt` and its
tagged corresponding source is at `third_party/javatari-5.0.3/`.

Upstream: https://github.com/ppeccin/javatari.js

## dasmjs and DASM

The browser assembler is dasmjs 6.0.1 by Zeh Fernando, based on DASM. It is
distributed under GPL-2.0 and GPL-2.0-or-later terms as identified in its
source. Its GPL-2.0 text is at `editor/dasm.LICENSE.txt`; tagged corresponding
source is at `third_party/dasmjs-6.0.1/`.

Upstream: https://github.com/zeh/dasmjs

Runtime SHA-256 values and exact upstream commits are recorded in
`third_party/README.md`.
