; Physical bank 0 of the 32K F4 image: splash or immediate boot handoff.
BANK_ID equ 0
        include "data\splash_config.inc"
        if SPLASH_ENABLED = 1
          include "splash.asm"
        else
          include "boot.asm"
        endif
