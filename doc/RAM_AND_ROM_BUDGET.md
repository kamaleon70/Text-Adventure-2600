# RAM and ROM budget

## Current RAM use

The Atari 2600 has 128 bytes of RIOT RAM at `$80-$FF`. The stack uses a mirror
of this same physical memory.

Current fixed engine allocation:

| Use | Bytes |
|---|---:|
| Tiny-text `FontBuf` | 30 |
| Existing pointers, counters, page and controller state | 14 |
| Persistent flags | 8 |
| Portable object locations | 8 |
| Prepared inventory row pointers | 22 |
| **Fixed total** | **82** |

This leaves 46 addresses before stack use. The current deepest ordinary call
path uses about five stack bytes. For future code, reserve 16 bytes of stack
headroom, leaving a conservative gameplay budget of approximately 30 bytes.

## Remaining gameplay allocation

A conservative target for later container and polish work is:

| New state | Bytes |
|---|---:|
| Container state not represented by flags | 4 |
| Result/sound state | 4 |
| Additional UI or resolver scratch | 4 |
| **Proposed additional total** | **12** |

Combined with the current 82 bytes, this would use 94 static bytes. With 16
bytes reserved for stack, roughly 18 bytes would remain as expansion margin.
Do not allocate room-state arrays in RAM; represent exceptional mutable facts
as flags.

## Optional smaller profile

The engine currently reserves all eight flag bytes and all eight object bytes
even when a project defines fewer entries. A future compact build profile could
reduce those fixed reservations, but the current predictable layout is safer
while the engine is evolving.

## ROM considerations

The cartridge contains sixteen 4K F0 banks. The common engine and font are
duplicated in every bank so execution can continue at matching addresses after
a bankswitch.

At present:

- each scene consumes 120 text bytes;
- two scenes occupy one aligned 256-byte block;
- up to 10 scenes safely fit in each bank after the object/inventory engine;
- up to 160 scenes fit without a splash, or 150 with bank 0 reserved for it;
- a scene can define up to 6 contextual actions, with at most 8 in one bank.

New engine code is duplicated eight times. New story tables should therefore
be bank-local where possible. As code and data tables grow, the safe scene
limit may fall below 10 per bank; the generator must calculate and validate
actual assembled placement rather than relying only on a fixed advertised
limit.

## Build-time checks

After every gameplay milestone, record:

- highest statically allocated RAM address;
- deepest measured stack use;
- end address of common executable code;
- start/end address of every scene;
- free bytes before `$FFF0` and the vectors;
- confirmation that the F0 switch routine safely accesses hotspot `$FFF0`;
- full NTSC frame scanline count during movement and every new action.

RAM should be treated as a designed budget, not consumed opportunistically.
