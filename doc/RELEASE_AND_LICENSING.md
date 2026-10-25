# Release and licensing guide

This file records the release arrangement selected for Text Adventure 2600.
It is a practical project guide, not legal advice.

## Editor and source

Project-owned editor, build-tool, and runtime source is released under the GNU
Affero General Public License version 3. The complete licence is in the root
`LICENSE.txt`. Redistributed or hosted copies of the editor must comply with
AGPL-3.0, including its corresponding-source requirements.

The browser package contains Javatari 5.0.3 (AGPL-3.0) and dasmjs 6.0.1
(GPL-2.0 / GPL-2.0-or-later components). Their tagged source trees, build
materials, licences, upstream commits, and runtime checksums are included under
`third_party/` and documented in `NOTICE.md`.

The old third-party `vcs.h`, `macro.h`, and `xmacro.h` files have been removed.
The active files under `lib/` are small project-owned definitions containing
only the registers and macros required by this engine.

## Generated games

`ROM_OUTPUT_EXCEPTION.md` is an additional permission for generated Atari 2600
ROMs. Game creators may distribute their ROMs for free or commercially, under
open or closed terms, without publishing the story, configuration, or source.

The only engine-specific requirement is a reasonable public credit:

> Created with Text Adventure 2600 by kamaleon70  
> https://kamaleon70.itch.io/text-adventures-2600

This may be placed on a store/download page, in documentation, on packaging,
or somewhere else players can reasonably find it. It need not consume ROM
space. The exact permission and limits are in `ROM_OUTPUT_EXCEPTION.md`.

## Steven E. Hugg example

The renderer began from Steven E. Hugg's `tinyfonts2.a` example. The official
8bitworkshop repository states that its `presets/` samples are CC0 unless a
sample says otherwise. Attribution is therefore not required by CC0, but this
project recommends:

> Text renderer adapted from Steven E. Hugg's CC0 Atari 2600
> `tinyfonts2.a` example, published by 8bitworkshop.

Sources:

- https://github.com/8bitworkshop/8bitworkshop#license
- https://creativecommons.org/publicdomain/zero/1.0/
- https://8bitworkshop.com/latest/?file=examples%2Ftinyfonts2.a&platform=vcs

## Release checklist

- Use only original or properly licensed game text, art, audio, screenshots,
  packaging, and trademarks.
- Include the required Text Adventure 2600 credit with every distributed game.
- Keep `LICENSE.txt`, `LICENSING.md`, `ROM_OUTPUT_EXCEPTION.md`, `NOTICE.md`, and
  all third-party notices when distributing or hosting the editor.
- Make the complete corresponding editor source available to hosted users as
  required by AGPL-3.0.
- Do not imply endorsement by Atari, Steven E. Hugg, 8bitworkshop, Javatari,
  DASM, or dasmjs.
- Test the exact release ROM in Stella and, when possible, on real hardware.
- Archive the exact project configuration and tool version used for a release.

For a consequential commercial publication, obtain independent legal advice.
