; Bank-0 boot path used when no splash artwork is enabled.
        processor 6502
        include "..\lib\vcs.h"
        include "..\lib\macro.h"

        seg BootCode
        org $F000
BootStart
        CLEAN_START
        jmp BootSelectLogicBank

; Select F4 bank 1. Instruction fetching resumes in logic bank 1 at $F4E3.
        org $F4E0
BootSelectLogicBank
        lda $1FF5
        jmp BootStart

; Reset from any bank first selects bank 0 and then executes the shared JMP.
        org $FFE0
BootResetEntry
        bit $1FF4
        jmp $F000

        org $FFFC
        dc.w BootResetEntry
        dc.w BootResetEntry
