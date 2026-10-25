; Text Adventure 2600 scanline timer helpers.

; Start a 64-clock RIOT timer for the requested number of scanlines. The first
; WSYNC aligns the calculation to a complete scanline.
    MAC TIMER_SETUP
.lines  SET {1}
.cycles SET ((.lines * 76) - 13)
        IF (.cycles % 64) < 12
            lda #(.cycles / 64) - 1
            sta WSYNC
        ELSE
            lda #(.cycles / 64)
            sta WSYNC
        ENDIF
        sta TIM64T
    ENDM

; Wait for the RIOT timer and finish on a scanline boundary.
    MAC TIMER_WAIT
.waittimer
        lda INTIM
        bne .waittimer
        sta WSYNC
    ENDM
