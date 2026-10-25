; ---------------------------------------------------------------------------
; Tiny Text Adventure - split logic/renderer for a 32K F4 cartridge
;
; Built around the native string and display method in
; reference/tiny_text.asm. It does not use the former FOTR room/text engine.
; Bank 1 owns global game logic. Banks 2-7 clone only the timed renderer and
; carry seventeen local text scenes each.
; ---------------------------------------------------------------------------

        processor 6502
        include "..\lib\vcs.h"
        include "..\lib\macro.h"
        include "..\lib\xmacro.h"

LoChar          equ 41
THREE_COPIES    equ %011

ACTION_LOOK     equ 0
ACTION_NORTH    equ 1
ACTION_EAST     equ 2
ACTION_SOUTH    equ 3
ACTION_WEST     equ 4
ACTION_NEXT     equ 5
ACTION_INVENTORY equ 6
ACTION_COUNT    equ 7
ACTION_CONTEXT equ 7
ACTION_LAST     equ 12            ; six contextual choices per scene

NO_EXIT         equ $FF
PAGE_MASK       equ $1F
BANK_MASK       equ $E0
BANK_0          equ $00
BANK_1          equ $20
BANK_2          equ $40
BANK_3          equ $60
BANK_4          equ $80
BANK_5          equ $A0
BANK_6          equ $C0
BANK_7          equ $E0

; RAM: only $80-$E1 is used, leaving $E2-$FF for stack headroom.
        seg.u Variables
        org $80

Temp            ds 1
WriteOfs        ds 1
LoopCount       ds 1
StrPtr          ds 2
StrLen          ds 1
TempSP          ds 1
PagePtr         ds 2
CurrentPage     ds 1
CurrentScene    ds 1            ; global scene index 0-101, used in logic bank
SelectedAction  ds 1
InputArmed      ds 1
CurrentBank     ds 1
ControlMode     ds 1            ; 0=direct movement, 1=LOOK/NEXT selection
FontBuf         ds 30
GameFlags       ds 8            ; 64 persistent boolean story flags
ObjectLocations ds 8            ; up to eight portable object locations
InventoryLineLo ds 11           ; prepared during VBLANK, indexed by row X
InventoryLineHi ds 11
ActionLineBuffer ds 12          ; context label copied by logic for stable display
SceneBackgroundColor ds 1       ; effective colour loaded from the current story bank
SceneActionTextColor ds 1
SceneActionBackgroundColor ds 1

        seg Code
        org $F000

        if BANK_ROLE = 1
Start
        CLEAN_START

        jsr InitializeGame
        jmp LogicSelectStoryBank

; The splash has already established a clean TIA state, asserted VBLANK, and
; started its 30-line overscan timer.  Re-running CLEAN_START here would take
; roughly 34 scanlines by itself and lengthen the Fire handoff frame.  Clear
; only the 128 bytes of RIOT RAM, initialize the game inside the still-active
; splash overscan, and finish that exact timer before starting normal VSYNC.
StartFromSplash
        sei
        cld
        ldx #$FF
        txs
        lda #0
        ldx #$7F
.clearRam
        sta $80,x
        dex
        bpl .clearRam

        jsr InitializeGame
        TIMER_WAIT
        ; Splash VERTICAL_SYNC has one preliminary alignment WSYNC, whereas
        ; the game asserts VSYNC immediately. Reproduce that line so this
        ; transition frame remains 262 scanlines.
        sta WSYNC
        jmp LogicSelectStoryBank

InitializeGame subroutine
        lda #0
        sta SelectedAction
        sta ControlMode
        lda #START_PAGE
        sta CurrentPage
        lda #START_SCENE
        sta CurrentScene
        lda #START_BANK
        sta CurrentBank
        ldx #7
.initializeFlags
        lda InitialFlags,x
        sta GameFlags,x
        dex
        bpl .initializeFlags
        if OBJECT_COUNT > 0
        ldx #OBJECT_COUNT-1
.initializeObjects
        lda InitialObjectLocations,x
        sta ObjectLocations,x
        dex
        bpl .initializeObjects
        endif
        jsr ResolvePageVariant
        ; A released controller is required before the first game input. This
        ; also consumes the Fire press used to leave an optional splash.
        lda #0
        sta InputArmed
        rts
        endif

        if BANK_ROLE = 2
NextFrame
        lda #2
        sta VBLANK
        sta VSYNC
        TIMER_SETUP 3

        jsr SetupBackground
        TIMER_WAIT

        lda #0
        sta VSYNC
        ; Match the original tiny_text.asm NTSC frame: 37 lines of vertical
        ; blank after the three-line VSYNC interval.
        TIMER_SETUP 37

        jsr PrepareText
        jsr LoadPagePointer

        ; The first line is built during vertical blank. Remaining lines are
        ; built between DrawText calls, exactly as in tiny_text.asm.
        ldx #10
        lda ControlMode
        cmp #2
        beq .prepareInventory
        ; Resolve the variable action-label pointer outside the visible kernel.
        ; InventoryLine[0] is free in story/action mode and provides a two-byte
        ; cache without consuming additional console RAM.
        jsr PrepareActionPointer
        ldx #10                    ; ending lookup uses X; restore the top row
        jsr SelectLinePointer
        jmp .buildFirstLine
.prepareInventory
        jsr PrepareInventoryPointers
        ldx #10                    ; cache preparation uses X; restore top row
        jsr SelectInventoryLinePointer
.buildFirstLine
        jsr BuildText

        TIMER_WAIT
        lda #0
        sta VBLANK
        ; The original Tiny Text kernel uses a 192-line visible interval.
        ; Together with 3 VSYNC, 37 VBLANK and 30 overscan lines this keeps the
        ; frame at exactly 262 lines and restores blank space above and below.
        TIMER_SETUP 192

        ldx #0
.topSpace
        sta WSYNC
        inx
        cpx #10
        bne .topSpace

        lda ControlMode
        cmp #2
        beq .showInventory
        jsr ShowText
        jmp .visibleDone
.showInventory
        jsr ShowInventory
.visibleDone
        TIMER_WAIT

        lda #2
        sta VBLANK
        TIMER_SETUP 30
        jmp StorySelectLogicBank

; ---------------------------------------------------------------------------
; Display setup and kernel. These routines retain the timing and RAM bitmap
; construction of the user's working tiny_text.asm reference.
; ---------------------------------------------------------------------------

SetupBackground subroutine
        ldx CurrentPage
        lda SceneBackgroundColors,x
        sta SceneBackgroundColor
        sta COLUBK
        lda SceneBorderColors,x
        sta COLUPF
        lda SceneTextColors,x
        sta COLUP0
        sta COLUP1
        lda SceneActionTextColors,x
        sta SceneActionTextColor
        lda SceneActionBackgroundColors,x
        sta SceneActionBackgroundColor
        lda SceneBorderStyles,x
        and #1                    ; bit 7 marks an ending scene
        bne .solidBorder
        ; Ten outer playfield columns form striped side panels. The inner ten
        ; columns stay clear so COLUBK remains the text-area colour.
        lda #%10100000
        sta PF0
        lda #%01010100
        sta PF1
        lda #0
        sta PF2
        jmp .borderReady
.solidBorder
        ; Fill the same ten outer columns for solid side panels.
        lda #%11110000
        sta PF0
        lda #%11111100
        sta PF1
        lda #0
        sta PF2
.borderReady
        lda #%00000001
        sta CTRLPF
        rts

PrepareText subroutine
        lda #THREE_COPIES
        sta NUSIZ0
        sta NUSIZ1
        sta WSYNC
        SLEEP 36
        sta RESP0
        sta RESP1
        lda #$10
        sta HMP1
        sta WSYNC
        sta HMOVE
        lda #1
        sta VDELP0
        sta VDELP1
        rts

; The action row is still drawn by the unchanged five-scanline text kernel.
; Its colours change at the row boundary, outside DrawText, so none of the
; cycle-sensitive character writes are disturbed. The playfield is untouched:
; the configured side panels remain visible beside the centre action area.
PrepareActionRowStyle subroutine
        lda SceneActionTextColor
        sta COLUP0
        sta COLUP1
        lda SceneActionBackgroundColor
        sta COLUBK
        rts

FinishActionRowStyle subroutine
        lda SceneBackgroundColor
        sta COLUBK
        rts

; Build the 48x5 bitmap for the twelve native character bytes at StrPtr.
BuildText subroutine
        tsx
        stx TempSP
        lda #FontBuf+4
        sta WriteOfs
        ldy #0
        sty StrLen
.charLoop
        lda (StrPtr),y
        sec
        sbc #LoChar
        sta Temp
        asl
        asl
        adc Temp
        tax

        iny
        lda (StrPtr),y
        sec
        sbc #LoChar
        sta Temp
        asl
        asl
        adc Temp
        iny
        sty StrLen
        tay

        txa
        ldx WriteOfs
        txs
        tax

        lda FontTableLo+4,y
        ora FontTableHi+4,x
        pha
        lda FontTableLo+3,y
        ora FontTableHi+3,x
        pha
        lda FontTableLo+2,y
        ora FontTableHi+2,x
        pha
        lda FontTableLo+1,y
        ora FontTableHi+1,x
        pha
        lda FontTableLo,y
        ora FontTableHi,x
        pha

        lda WriteOfs
        clc
        adc #5
        sta WriteOfs
        ldy StrLen
        cpy #12
        bne .charLoop

        ldx TempSP
        txs
        rts

DrawText subroutine
        lda #4
        sta LoopCount
.scanline
        sta WSYNC
        ldy LoopCount
        lda FontBuf+0,y
        sta GRP0
        lda FontBuf+5,y
        sta GRP1
        lda FontBuf+10,y
        sta GRP0
        lda FontBuf+25,y
        sta Temp
        ldx FontBuf+20,y
        lda FontBuf+15,y
        ldy Temp
        sta GRP1
        stx GRP0
        sty GRP1
        sta GRP0
        dec LoopCount
        lda LoopCount
        cmp #$FF
        bne .scanline

        lda #0
        sta GRP0
        sta GRP1
        sta GRP0
        sta GRP1
        rts

; X=10 is the top story row. X=1 is the tenth story row. X=0 is
; deliberately and permanently the action-selection row.
ShowText subroutine
        ldx #10
.lineLoop
        txa
        pha
        jsr DrawText
        pla
        tax
        dex
        bmi .done

        txa
        pha
        jsr SelectLinePointer
        jsr BuildText
        pla
        tax
        cpx #0
        bne .nextLine
        jsr PrepareActionRowStyle
.nextLine
        jmp .lineLoop
.done
        jsr FinishActionRowStyle
        rts

ShowInventory subroutine
        ldx #10
.lineLoop
        txa
        pha
        jsr DrawText
        pla
        tax
        dex
        bmi .done

        txa
        pha
        jsr SelectInventoryLinePointer
        jsr BuildText
        pla
        tax
        cpx #0
        bne .nextLine
        jsr PrepareActionRowStyle
.nextLine
        jmp .lineLoop
.done
        jsr FinishActionRowStyle
        rts

LoadPagePointer subroutine
        ldx CurrentPage
        lda PageTextLo,x
        sta PagePtr
        lda PageTextHi,x
        sta PagePtr+1
        rts

; Cache the final row's source pointer during VBLANK. Selecting a built-in or
; contextual action takes more cycles than selecting MOVE; doing that work
; here keeps the visible action row on exactly the same scanline in every mode.
PrepareActionPointer subroutine
        ldx CurrentPage
        lda SceneBorderStyles,x
        bmi .restart
        lda ControlMode
        bne .selectedAction
        lda #<MovePrompt
        sta InventoryLineLo
        lda #>MovePrompt
        sta InventoryLineHi
        rts

.selectedAction
        ldy SelectedAction
        cpy #ACTION_CONTEXT
        bcs .contextAction
        lda ActionTextLo,y
        sta InventoryLineLo
        lda ActionTextHi,y
        sta InventoryLineHi
        rts
.contextAction
        lda #<ActionLineBuffer
        sta InventoryLineLo
        lda #>ActionLineBuffer
        sta InventoryLineHi
        rts
.restart
        lda #<ActionRestart
        sta InventoryLineLo
        lda #>ActionRestart
        sta InventoryLineHi
        rts

; Select a story row or, for X=0, the independent action row.
SelectLinePointer subroutine
        cpx #0
        beq .action

        lda PagePtr
        clc
        adc LineOffsets,x
        sta StrPtr
        lda PagePtr+1
        adc #0
        sta StrPtr+1
        rts

.action
        ; Match the former MOVE path's 26-cycle timing for every label.
        SLEEP 3
        lda InventoryLineLo
        sta StrPtr
        lda InventoryLineHi
        sta StrPtr+1
        rts

SelectInventoryLinePointer subroutine
        ; Match the ordinary story-pointer path so inventory rows retain the
        ; same vertical cadence while still avoiding a variable object scan.
        SLEEP 7
        lda InventoryLineLo,x
        sta StrPtr
        lda InventoryLineHi,x
        sta StrPtr+1
        rts

; Build the inventory's complete row-pointer table outside the drawable area.
; The visible kernel then performs no object scan and cannot overrun its timer.
PrepareInventoryPointers subroutine
        ldx #10
.blankRows
        lda #<BlankLine
        sta InventoryLineLo,x
        lda #>BlankLine
        sta InventoryLineHi,x
        dex
        bpl .blankRows

        lda #<InventoryTitle
        sta InventoryLineLo+10
        lda #>InventoryTitle
        sta InventoryLineHi+10
        lda #<InventoryReturn
        sta InventoryLineLo
        lda #>InventoryReturn
        sta InventoryLineHi

        if OBJECT_COUNT > 0
        lda #9
        sta Temp
        ldy #0
.object
        lda ObjectLocations,y
        cmp #$FE
        bne .nextObject
        ldx Temp
        lda ObjectNameLo,y
        sta InventoryLineLo,x
        lda ObjectNameHi,y
        sta InventoryLineHi,x
        dec Temp
.nextObject
        iny
        cpy #OBJECT_COUNT
        bne .object
        endif
        rts

; Display indexes 10..1 correspond to byte offsets 0,12..108.
LineOffsets
        dc.b 0,108,96,84,72,60,48,36,24,12,0

ActionTextLo
        dc.b <ActionLook,<ActionNorth,<ActionEast
        dc.b <ActionSouth,<ActionWest,<ActionNext,<ActionInventory
ActionTextHi
        dc.b >ActionLook,>ActionNorth,>ActionEast
        dc.b >ActionSouth,>ActionWest,>ActionNext,>ActionInventory

; Keep all fixed 12-byte strings within one 256-byte ROM page. BuildText uses
; (StrPtr),Y; crossing a page adds a cycle and can move this bottom row by a
; scanline when the selected action changes.
        align $100
MovePrompt      dc.b "MOVE:[NSEW[["
ActionLook      dc.b "ACT:[LOOK[[["
ActionNorth     dc.b "ACT:[NORTH[["
ActionEast      dc.b "ACT:[EAST[[["
ActionSouth     dc.b "ACT:[SOUTH[["
ActionWest      dc.b "ACT:[WEST[[["
ActionNext      dc.b "ACT:[NEXT[[["
ActionInventory dc.b "INVENTORY[[["
ActionRestart   dc.b "FIRE:RESTART"
InventoryTitle  dc.b "[INVENTORY[["
InventoryReturn dc.b "FIRE:[RETURN"
BlankLine       dc.b "[[[[[[[[[[[["
        endif

; ---------------------------------------------------------------------------
; Controller and minimal page engine.
; In movement mode the four joystick directions directly follow the matching
; PageActions destination. Fire enters action mode without executing anything.
; In action mode any direction cycles valid LOOK/NEXT/contextual choices and
; Fire confirms the displayed choice.
; Each page has six destination bytes in LOOK,NORTH,EAST,SOUTH,WEST,NEXT order.
; Destinations pack the F4 bank into bits 7..5 and page index into bits 4..0.
; $FF means unavailable; story page indexes are 0..16.
; ---------------------------------------------------------------------------

        if BANK_ROLE = 1
LogicOverscan
        jsr ReadControls
        jsr PrepareContextActionLine
        TIMER_WAIT
        jmp LogicSelectStoryBank

ReadControls subroutine
        ; Rearm only after every direction and fire have all been released.
        lda SWCHA
        and #%11110000
        cmp #%11110000
        bne .pressed
        lda INPT4
        bpl .pressed
        lda #1
        sta InputArmed
        rts

.pressed
        lda InputArmed
        bne .inputArmed
        jmp .done
.inputArmed

        ; Ending scenes deliberately suppress movement, inventory, NEXT and
        ; contextual actions. Fire restores the complete initial game state.
        ldx CurrentScene
        lda PageEndings,x
        beq .normalControls
        lda INPT4
        bpl .restartGame
        jmp .done
.restartGame
        jsr InitializeGame
        jmp .consume

.normalControls

        lda ControlMode
        cmp #2
        beq .inventoryMode
        lda ControlMode
        bne .actionMode

        ; Movement has priority if fire and a direction are pressed together.
        lda SWCHA
        and #%00010000
        beq .north
        lda SWCHA
        and #%10000000
        beq .east
        lda SWCHA
        and #%00100000
        beq .south
        lda SWCHA
        and #%01000000
        beq .west
        lda INPT4
        bmi .done
        lda #1
        sta ControlMode
        lda #ACTION_LOOK
        sta SelectedAction
        jmp .consume

.north
        lda #ACTION_NORTH
        bne .move
.east
        lda #ACTION_EAST
        bne .move
.south
        lda #ACTION_SOUTH
        bne .move
.west
        lda #ACTION_WEST
.move
        sta SelectedAction
        jsr PerformAction
        jmp .consume

.actionMode
        ; A direction cycles valid LOOK/NEXT/contextual choices. It never
        ; executes one, so an imprecise fire/direction chord remains harmless.
        lda SWCHA
        and #%11110000
        cmp #%11110000
        bne .toggleAction
        lda INPT4
        bmi .done
        jsr PerformAction
        lda ControlMode
        cmp #2
        beq .consume
        lda #0
        sta ControlMode
        jmp .consume

.inventoryMode
        lda INPT4
        bmi .done
        lda #0
        sta ControlMode
        jmp .consume

.toggleAction
        jsr SelectNextAction

.consume
        lda #0
        sta InputArmed
.done
        rts

PerformAction subroutine
        lda SelectedAction
        cmp #ACTION_INVENTORY
        beq .inventory
        cmp #ACTION_CONTEXT
        bcc .standard
        jsr ApplyContextAction
        jsr ResolvePageVariant
        rts
.inventory
        lda #2
        sta ControlMode
        rts
.standard
        ; Effects are read from the source bank before a destination can switch
        ; the cartridge to another physical bank.
        jsr ApplyFlagEffects

        jsr LoadSelectedDestination
        cmp #NO_EXIT
        beq .resolve
        jsr ApplyDestination
.resolve
        lda SelectedAction
        cmp #ACTION_NEXT
        beq .done
        jsr ResolvePageVariant
.done
        rts

; Cycle LOOK, NEXT (when linked), and up to six flag-qualified scene actions.
SelectNextAction subroutine
.try
        lda SelectedAction
        cmp #ACTION_LOOK
        beq .selectNext
        cmp #ACTION_LAST
        bcs .selectLook
        clc
        adc #1
        bne .test
.selectNext
        lda #ACTION_NEXT
        bne .test
.selectLook
        lda #ACTION_LOOK
.test
        sta SelectedAction
        jsr SelectedActionAvailable
        bcc .try
        rts

SelectedActionAvailable subroutine
        lda SelectedAction
        beq .yes
        cmp #ACTION_INVENTORY
        beq .yes
        cmp #ACTION_NEXT
        bne ContextActionAvailable
        lda #ACTION_NEXT
        jsr LoadActionDestination
        cmp #NO_EXIT
        beq .no
.yes
        sec
        rts
.no
        clc
        rts

; Locate SelectedAction's variable-length record. Returns C=1 and Y at its
; two-byte label pointer, or C=0 if the scene does not define that ordinal.
FindContextAction subroutine
        ldx CurrentScene
        lda PageContextLo,x
        sta StrPtr
        lda PageContextHi,x
        sta StrPtr+1
        ldy #0
        lda SelectedAction
        sec
        sbc #ACTION_CONTEXT
        sta LoopCount
        cmp (StrPtr),y
        bcs .missing
        iny
.record
        lda LoopCount
        beq .found
        iny
        iny
.skipRequirements
        lda (StrPtr),y
        iny
        cmp #$FF
        bne .skipRequirements
.skipObjectRequirements
        lda (StrPtr),y
        iny
        cmp #$FF
        bne .skipObjectRequirements
.skipEffects
        lda (StrPtr),y
        iny
        cmp #$FF
        bne .skipEffects
.skipObjectEffects
        lda (StrPtr),y
        iny
        cmp #$FF
        bne .skipObjectEffects
        dec LoopCount
        jmp .record
.found
        sec
        rts
.missing
        clc
        rts

ContextActionAvailable subroutine
        jsr FindContextAction
        bcc .failed
        iny
        iny
.condition
        lda (StrPtr),y
        cmp #$FF
        beq .objectConditions
        sta WriteOfs
        iny
        jsr TestFlagCondition
        bcs .condition
.failed
        clc
        rts
.objectConditions
        iny
.objectCondition
        lda (StrPtr),y
        cmp #$FF
        beq .passed
        sta WriteOfs
        iny
        and #$3F
        tax
        lda ObjectLocations,x
        sta Temp
        lda WriteOfs
        and #$C0
        cmp #$40
        beq .requireHere
        lda Temp
        cmp #$FE
        beq .objectCondition
        bne .failed
.requireHere
        lda Temp
        ldx CurrentScene
        cmp PageRoomLocations,x
        beq .objectCondition
        bne .failed
.passed
        sec
        rts

ApplyContextAction subroutine
        jsr FindContextAction
        bcc .done
        iny
        iny
.skipRequirements
        lda (StrPtr),y
        iny
        cmp #$FF
        bne .skipRequirements
.skipObjectRequirements
        lda (StrPtr),y
        iny
        cmp #$FF
        bne .skipObjectRequirements
.effect
        lda (StrPtr),y
        cmp #$FF
        beq .objectEffects
        iny
        jsr ApplyFlagOperation
        jmp .effect
.objectEffects
        iny
.objectEffect
        lda (StrPtr),y
        cmp #$FF
        beq .done
        sta WriteOfs
        iny
        and #$3F
        tax
        lda WriteOfs
        and #$C0
        beq .takeObject
        lda #$FF
        bne .storeObject
.takeObject
        lda #$FE
.storeObject
        sta ObjectLocations,x
        jmp .objectEffect
.done
        rts

ApplyDestination subroutine
        sta Temp
        and #PAGE_MASK
        sta CurrentPage
        lda Temp
        and #BANK_MASK
        lsr
        lsr
        lsr
        lsr
        lsr
        sta CurrentBank
UpdateCurrentScene subroutine
        ldx CurrentBank
        lda StoryBankOffsets,x
        clc
        adc CurrentPage
        sta CurrentScene
        rts

LoadSelectedDestination subroutine
        lda SelectedAction
LoadActionDestination subroutine
        tay
        lda ActionTableLo,y
        sta StrPtr
        lda ActionTableHi,y
        sta StrPtr+1
        ldy CurrentScene
        lda (StrPtr),y
        rts

; PageEffects is a compact bank-local list. Records contain source page,
; action, encoded operations, then $FF; $FE terminates the complete table.
ApplyFlagEffects subroutine
        lda #<PageEffects
        sta StrPtr
        lda #>PageEffects
        sta StrPtr+1
        ldy #0
.record
        lda (StrPtr),y
        cmp #$FE
        beq .done
        sta Temp
        iny
        lda (StrPtr),y
        sta LoopCount
        iny
        lda Temp
        cmp CurrentScene
        bne .skip
        lda LoopCount
        cmp SelectedAction
        bne .skip
.apply
        lda (StrPtr),y
        cmp #$FF
        beq .done
        iny
        jsr ApplyFlagOperation
        jmp .apply
.skip
        lda (StrPtr),y
        iny
        cmp #$FF
        bne .skip
        jmp .record
.done
        rts

; A encodes SET=$00, CLEAR=$40, TOGGLE=$80 plus a six-bit flag index.
ApplyFlagOperation subroutine
        sta WriteOfs
        and #$3F
        sta LoopCount
        and #7
        tax
        lda FlagMasks,x
        sta StrLen
        lda LoopCount
        lsr
        lsr
        lsr
        tax
        lda WriteOfs
        and #$C0
        beq .set
        cmp #$40
        beq .clear
        lda GameFlags,x
        eor StrLen
        sta GameFlags,x
        rts
.set
        lda GameFlags,x
        ora StrLen
        sta GameFlags,x
        rts
.clear
        lda StrLen
        eor #$FF
        and GameFlags,x
        sta GameFlags,x
        rts

; The first ordered rule whose conditions pass replaces the current scene. A rule
; stores SET requirements as $00-$3F and CLEAR requirements as $80-$BF.
ResolvePageVariant subroutine
        ldx CurrentScene
        lda PageVariantLo,x
        sta StrPtr
        lda PageVariantHi,x
        sta StrPtr+1
        ldy #0
.rule
        lda (StrPtr),y
        cmp #$FE
        beq .done
        lda #1
        sta PagePtr
.condition
        lda (StrPtr),y
        cmp #$FF
        beq .destination
        sta WriteOfs
        iny
        jsr TestFlagCondition
        bcs .condition
        lda #0
        sta PagePtr
        jmp .condition
.destination
        iny
        lda (StrPtr),y
        iny
        ldx PagePtr
        beq .rule
        jsr ApplyDestination
.done
        rts

TestFlagCondition subroutine
        lda WriteOfs
        and #$3F
        sta LoopCount
        and #7
        tax
        lda FlagMasks,x
        sta StrLen
        lda LoopCount
        lsr
        lsr
        lsr
        tax
        lda GameFlags,x
        and StrLen
        sta LoopCount
        lda WriteOfs
        bmi .requireClear
        lda LoopCount
        beq .failed
        sec
        rts
.requireClear
        lda LoopCount
        bne .failed
        sec
        rts
.failed
        clc
        rts

FlagMasks
        dc.b $01,$02,$04,$08,$10,$20,$40,$80

PrepareContextActionLine subroutine
        lda ControlMode
        cmp #1
        bne .done
        lda SelectedAction
        cmp #ACTION_CONTEXT
        bcc .done
        jsr FindContextAction
        bcc .done
        lda (StrPtr),y
        sta Temp
        iny
        lda (StrPtr),y
        sta StrPtr+1
        lda Temp
        sta StrPtr
        ldy #0
.copy
        lda (StrPtr),y
        sta ActionLineBuffer,y
        iny
        cpy #12
        bne .copy
.done
        rts
        endif

; Renderer-local strings, object-name pointers and text pointers fit below the
; cross-bank landing slots. The timed font occupies $F500-$F6FF.
        if BANK_ROLE = 2
        org $F400
          if BANK_ID = 2
            include "data\bank2_context_labels.inc"
            include "data\bank2_story.inc"
          endif
          if BANK_ID = 3
            include "data\bank3_context_labels.inc"
            include "data\bank3_story.inc"
          endif
          if BANK_ID = 4
            include "data\bank4_context_labels.inc"
            include "data\bank4_story.inc"
          endif
          if BANK_ID = 5
            include "data\bank5_context_labels.inc"
            include "data\bank5_story.inc"
          endif
          if BANK_ID = 6
            include "data\bank6_context_labels.inc"
            include "data\bank6_story.inc"
          endif
          if BANK_ID = 7
            include "data\bank7_context_labels.inc"
            include "data\bank7_story.inc"
          endif
        endif

; Story renderer -> logic bank. The LDA changes banks; bank 1 continues at
; $F4C3 and jumps into its overscan handler.
        org $F4C0
        if BANK_ROLE = 2
StorySelectLogicBank
        lda $1FF5
        else
        dc.b 0,0,0
LogicOverscanLanding
        jmp LogicOverscan
        endif

; Logic bank -> selected story bank. The target renderer continues at $F4D5.
        org $F4D0
        if BANK_ROLE = 1
LogicSelectStoryBank
        ldx CurrentBank
        lda $1FF4,x
        else
        dc.b 0,0,0,0,0
StoryFrameLanding
        jmp NextFrame
        endif

; Cold-boot and splash handoff landings from bank 0.
        org $F4E0
        if BANK_ROLE = 1
        dc.b 0,0,0
ColdBootLanding
        jmp Start
        endif
        org $F4F0
        if BANK_ROLE = 1
        dc.b 0,0,0
SplashGameLanding
        jmp StartFromSplash
        endif

        if BANK_ROLE = 2
        org $F500
        include "tiny_font.inc"
          if BANK_ID = 2
            include "data\bank2_text.inc"
          endif
          if BANK_ID = 3
            include "data\bank3_text.inc"
          endif
          if BANK_ID = 4
            include "data\bank4_text.inc"
          endif
          if BANK_ID = 5
            include "data\bank5_text.inc"
          endif
          if BANK_ID = 6
            include "data\bank6_text.inc"
          endif
          if BANK_ID = 7
            include "data\bank7_text.inc"
          endif
        else
        include "data\logic_story.inc"
        endif

; Every bank routes reset through bank 0. Bank 0 carries the same landing JMP.
        org $FFE0
ResetEntry
        bit $1FF4
        jmp $F000

        org $FFFC
        dc.w ResetEntry
        dc.w ResetEntry
