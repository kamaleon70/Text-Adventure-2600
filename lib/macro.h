; Text Adventure 2600 startup and display-timing macros.

; Insert an exact delay of two or more processor cycles. Odd delays use the
; legal three-cycle BIT instruction; the remaining delay is filled with NOPs.
    MAC SLEEP
.cycles SET {1}
        IF .cycles < 2
            ECHO "MACRO ERROR: SLEEP duration must be at least 2 cycles"
            ERR
        ENDIF
        IF .cycles & 1
            bit VSYNC
.cycles SET .cycles - 3
        ENDIF
        REPEAT .cycles / 2
            nop
        REPEND
    ENDM

; Clear TIA and zero-page RAM and leave A, X, Y and the stack in a known state.
    MAC CLEAN_START
        sei
        cld
        ldx #$FF
        txs
        inx
        txa
        tay
.clear
        sta $00,x
        inx
        bne .clear
    ENDM

; Align to a scanline, assert VSYNC for three complete scanlines, then clear it.
; A is zero on return.
    MAC VERTICAL_SYNC
        lda #2
        sta WSYNC
        sta VSYNC
        sta WSYNC
        sta WSYNC
        sta WSYNC
        lda #0
        sta VSYNC
    ENDM
