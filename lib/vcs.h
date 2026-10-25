; Text Adventure 2600 hardware-register definitions.
; This deliberately small include contains only the TIA and RIOT registers used
; by this project. The addresses come from the public Atari 2600 hardware map.

; TIA write registers
VSYNC   = $00
VBLANK  = $01
WSYNC   = $02
NUSIZ0  = $04
NUSIZ1  = $05
COLUP0  = $06
COLUP1  = $07
COLUPF  = $08
COLUBK  = $09
CTRLPF  = $0A
PF0     = $0D
PF1     = $0E
PF2     = $0F
RESP0   = $10
RESP1   = $11
AUDV0   = $19
AUDV1   = $1A
GRP0    = $1B
GRP1    = $1C
HMP1    = $21
VDELP0  = $25
VDELP1  = $26
HMOVE   = $2A

; TIA read registers
INPT4   = $0C

; RIOT I/O and timer registers
SWCHA   = $0280
INTIM   = $0284
TIM64T  = $0296
