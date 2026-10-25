; GENERATED global story logic for 32K F4 bank 1
        org $F500
START_BANK equ 2
START_PAGE equ 0
START_SCENE equ 0
InitialFlags
        dc.b $00,$00,$00,$00,$00,$00,$00,$00
OBJECT_COUNT equ 1
InitialObjectLocations
        dc.b BANK_2|2
StoryBankOffsets
        dc.b 0,0,0,17,34,51,68,85

PageActionLook
        dc.b BANK_2|0,BANK_2|0,BANK_2|2,BANK_2|2,BANK_2|4,BANK_2|5,BANK_2|6,BANK_2|7,BANK_2|7,BANK_2|9,BANK_2|10,BANK_2|11,BANK_2|12,BANK_2|13
PageActionNorth
        dc.b BANK_2|4,BANK_2|4,BANK_2|5,BANK_2|5,BANK_2|6,NO_EXIT,NO_EXIT,BANK_2|9,BANK_2|9,NO_EXIT,BANK_2|7,NO_EXIT,BANK_2|11,NO_EXIT
PageActionEast
        dc.b BANK_2|2,BANK_2|2,NO_EXIT,NO_EXIT,BANK_2|5,BANK_2|7,BANK_2|9,NO_EXIT,NO_EXIT,BANK_2|11,BANK_2|12,NO_EXIT,NO_EXIT,NO_EXIT
PageActionSouth
        dc.b NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,BANK_2|0,BANK_2|2,BANK_2|4,BANK_2|10,BANK_2|10,BANK_2|7,NO_EXIT,BANK_2|12,NO_EXIT,NO_EXIT
PageActionWest
        dc.b NO_EXIT,NO_EXIT,BANK_2|0,BANK_2|0,NO_EXIT,BANK_2|4,NO_EXIT,BANK_2|5,BANK_2|5,BANK_2|6,NO_EXIT,BANK_2|9,BANK_2|10,NO_EXIT
PageActionNext
        dc.b BANK_2|1,BANK_2|0,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT
ActionTableLo
        dc.b <PageActionLook,<PageActionNorth,<PageActionEast,<PageActionSouth,<PageActionWest,<PageActionNext
ActionTableHi
        dc.b >PageActionLook,>PageActionNorth,>PageActionEast,>PageActionSouth,>PageActionWest,>PageActionNext
PageRoomLocations
        dc.b BANK_2|0,BANK_2|0,BANK_2|2,BANK_2|2,BANK_2|4,BANK_2|5,BANK_2|6,BANK_2|7,BANK_2|7,BANK_2|9,BANK_2|10,BANK_2|11,BANK_2|12,BANK_2|13
PageEndings
        dc.b 0,0,0,0,0,0,0,0,0,0,0,0,0,0
PageVariantLo
        dc.b <Scene0Variants,<NoVariants,<Scene2Variants,<NoVariants,<NoVariants,<NoVariants,<NoVariants,<Scene7Variants,<NoVariants,<NoVariants,<NoVariants,<NoVariants,<NoVariants,<NoVariants
PageVariantHi
        dc.b >Scene0Variants,>NoVariants,>Scene2Variants,>NoVariants,>NoVariants,>NoVariants,>NoVariants,>Scene7Variants,>NoVariants,>NoVariants,>NoVariants,>NoVariants,>NoVariants,>NoVariants
NoVariants
        dc.b $FE
Scene0Variants
        dc.b $00,$FF,BANK_2|1
        dc.b $FE
Scene2Variants
        dc.b $01,$FF,BANK_2|3
        dc.b $FE
Scene7Variants
        dc.b $02,$FF,BANK_2|8
        dc.b $FE
PageEffects
        dc.b 0,5,$00,$FF
        dc.b 1,5,$40,$FF
        dc.b $FE
PageContextLo
        dc.b <NoContext,<NoContext,<Scene2Context,<NoContext,<NoContext,<NoContext,<NoContext,<Scene7Context,<NoContext,<NoContext,<NoContext,<NoContext,<NoContext,<NoContext
PageContextHi
        dc.b >NoContext,>NoContext,>Scene2Context,>NoContext,>NoContext,>NoContext,>NoContext,>Scene7Context,>NoContext,>NoContext,>NoContext,>NoContext,>NoContext,>NoContext
NoContext
        dc.b 0
Scene2Context
        dc.b 1
        dc.w ContextLabel2_0
        dc.b $81,$FF
        dc.b $40,$FF
        dc.b $01,$FF
        dc.b $00,$FF
Scene7Context
        dc.b 1
        dc.w ContextLabel7_0
        dc.b $82,$FF
        dc.b $00,$FF
        dc.b $02,$FF
        dc.b $40,$FF
ContextLabel2_0 dc.b "TAKE[FUSE[[["
ContextLabel7_0 dc.b "USE[FUSE[[[["
