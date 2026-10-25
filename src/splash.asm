; ---------------------------------------------------------------------------
; Optional colour splash bank.
; Artwork is extracted from the editor upload; uploaded code is never run.
; The frame layout and delayed, release-gated Fire handoff follow the proven
; Kosho splash approach so the transition cannot shorten or lengthen a frame.
; ---------------------------------------------------------------------------

        processor 6502
        include "..\lib\vcs.h"
        include "..\lib\macro.h"
        include "..\lib\xmacro.h"

        seg.u SplashVariables
        org $80
SplashTemp              ds 1
SplashHeightCounter     ds 1
SplashDelayCounter      ds 1
SplashFireArmed         ds 1

        seg SplashCode
        org $F000

SplashStart
        CLEAN_START
        lda #1
        sta CTRLPF
        lda #SPLASH_BACKGROUND_COLOR
        sta COLUBK
        lda #SPLASH_DELAY_FRAMES
        sta SplashDelayCounter
        lda #0
        sta SplashFireArmed

SplashNextFrame
        VERTICAL_SYNC
        lda #44
        sta TIM64T

SplashWaitVBlank
        lda INTIM
        bne SplashWaitVBlank
        sta WSYNC
        sta VBLANK

        ldx #SPLASH_PADDING_LINES
SplashPaddingLoop
        sta WSYNC
        dex
        bne SplashPaddingLoop

        ldx #SPLASH_PLAYFIELD_LINES-1
        lda #SPLASH_LINE_HEIGHT
        sta SplashHeightCounter

SplashPlayfieldLoop
        sta WSYNC
        lda SplashPFColors,x
        sta COLUPF
        lda SplashPF0DataA,x
        sta PF0
        lda SplashPF1DataA,x
        sta PF1
        lda SplashPF2DataA,x
        sta PF2
        lda SplashPF2DataB,x
        tay
        lda SplashPF1DataB,x
        sta PF1
        lda SplashPF0DataB,x
        sty PF2
        sta PF0
        dec SplashHeightCounter
        bne SplashSameRow
        lda #SPLASH_LINE_HEIGHT
        sta SplashHeightCounter
        dex
        cpx #$FF
        beq SplashDoneRows
SplashSameRow
        jmp SplashPlayfieldLoop

SplashDoneRows
        lda #0
        sta PF0
        sta PF1
        sta PF2
        ldx #SPLASH_REMAINING_LINES
SplashVisibleRemainder
        sta WSYNC
        dex
        bne SplashVisibleRemainder

        lda #36
        sta TIM64T
        lda #2
        sta WSYNC
        sta VBLANK

        lda SplashDelayCounter
        beq SplashCheckFire
        dec SplashDelayCounter
        jmp SplashWaitOverscan

SplashCheckFire
        lda SplashFireArmed
        bne SplashFireReady
        bit INPT4
        bpl SplashWaitOverscan
        lda #1
        sta SplashFireArmed
        bne SplashWaitOverscan
SplashFireReady
        bit INPT4
        bpl SplashStartGame

SplashWaitOverscan
        lda INTIM
        bne SplashWaitOverscan
        sta WSYNC
        jmp SplashNextFrame

SplashStartGame
        lda #0
        sta AUDV0
        sta AUDV1
        jmp SplashSelectLogicBank

; Select F4 bank 1. Logic execution continues at $F4F3.
        org $F4F0
SplashSelectLogicBank
        lda $1FF5
        jmp SplashStart              ; only used if an invalid bank was chosen

        include "data\splash_art.inc"

; Reset from every physical bank selects bank 0 before entering the splash.
        org $FFE0
SplashResetEntry
        bit $1FF4
        jmp $F000

        org $FFFC
        dc.w SplashResetEntry
        dc.w SplashResetEntry
