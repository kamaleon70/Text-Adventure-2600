; GENERATED global story logic for 32K F4 bank 1
        org $F500
START_BANK equ 2
START_PAGE equ 0
START_SCENE equ 0
InitialFlags
        dc.b $00,$00,$00,$00,$00,$00,$00,$00
OBJECT_COUNT equ 3
InitialObjectLocations
        dc.b BANK_2|4,$F1,BANK_2|11
ObjectContainerOpenFlags
        dc.b $00,$FF,$FF
ObjectContainerLockedFlags
        dc.b $FF,$FF,$FF
StoryBankOffsets
        dc.b 0,0,0,17,34,51,68,85

PageActionLook
        dc.b BANK_2|0,BANK_2|0,BANK_2|2,BANK_2|2,BANK_2|4,BANK_2|4,BANK_2|4,BANK_2|7,BANK_2|7,BANK_2|9,BANK_2|9,BANK_2|11,BANK_2|11,BANK_2|11,BANK_2|14,BANK_2|14
        dc.b BANK_2|16,BANK_2|16,BANK_3|1,BANK_3|1,BANK_3|3,BANK_3|3,BANK_3|5,BANK_3|5
PageActionNorth
        dc.b BANK_2|7,BANK_2|7,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,BANK_2|9,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,BANK_2|16,BANK_2|16
        dc.b NO_EXIT,NO_EXIT,NO_EXIT,BANK_3|3,BANK_3|5,BANK_3|5,NO_EXIT,NO_EXIT
PageActionEast
        dc.b BANK_2|2,BANK_2|2,BANK_2|4,BANK_2|4,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,BANK_2|14,BANK_2|14,BANK_2|9,BANK_2|9,BANK_2|9,BANK_3|1,BANK_3|1
        dc.b NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT
PageActionSouth
        dc.b NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,BANK_2|0,BANK_2|0,BANK_2|7,BANK_2|7,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT
        dc.b BANK_2|14,BANK_2|14,NO_EXIT,NO_EXIT,BANK_3|1,BANK_3|1,BANK_3|3,BANK_3|3
PageActionWest
        dc.b NO_EXIT,NO_EXIT,BANK_2|0,BANK_2|0,BANK_2|2,BANK_2|2,BANK_2|2,NO_EXIT,NO_EXIT,BANK_2|11,BANK_2|11,NO_EXIT,NO_EXIT,NO_EXIT,BANK_2|9,BANK_2|9
        dc.b NO_EXIT,NO_EXIT,BANK_2|14,BANK_2|14,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT
PageActionNext
        dc.b BANK_2|1,NO_EXIT,BANK_2|3,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,BANK_2|10,NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,BANK_2|15,NO_EXIT
        dc.b NO_EXIT,NO_EXIT,NO_EXIT,NO_EXIT,BANK_3|4,NO_EXIT,NO_EXIT,NO_EXIT
ActionTableLo
        dc.b <PageActionLook,<PageActionNorth,<PageActionEast,<PageActionSouth,<PageActionWest,<PageActionNext
ActionTableHi
        dc.b >PageActionLook,>PageActionNorth,>PageActionEast,>PageActionSouth,>PageActionWest,>PageActionNext
PageRoomLocations
        dc.b BANK_2|0,BANK_2|0,BANK_2|2,BANK_2|2,BANK_2|4,BANK_2|4,BANK_2|4,BANK_2|7,BANK_2|7,BANK_2|9,BANK_2|9,BANK_2|11,BANK_2|11,BANK_2|11,BANK_2|14,BANK_2|14
        dc.b BANK_2|16,BANK_2|16,BANK_3|1,BANK_3|1,BANK_3|3,BANK_3|3,BANK_3|5,BANK_3|5
PageEndings
        dc.b 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
        dc.b 0,1,0,0,0,0,0,1
PageVariantLo
        dc.b <NoVariants,<NoVariants,<NoVariants,<NoVariants,<Scene4Variants,<NoVariants,<NoVariants,<Scene7Variants,<NoVariants,<NoVariants,<NoVariants,<Scene11Variants,<NoVariants,<NoVariants,<NoVariants,<NoVariants
        dc.b <Scene16Variants,<NoVariants,<Scene18Variants,<NoVariants,<NoVariants,<NoVariants,<Scene22Variants,<NoVariants
PageVariantHi
        dc.b >NoVariants,>NoVariants,>NoVariants,>NoVariants,>Scene4Variants,>NoVariants,>NoVariants,>Scene7Variants,>NoVariants,>NoVariants,>NoVariants,>Scene11Variants,>NoVariants,>NoVariants,>NoVariants,>NoVariants
        dc.b >Scene16Variants,>NoVariants,>Scene18Variants,>NoVariants,>NoVariants,>NoVariants,>Scene22Variants,>NoVariants
NoVariants
        dc.b $FE
Scene4Variants
        dc.b $00,$01,$FF,BANK_2|6
        dc.b $00,$81,$FF,BANK_2|5
        dc.b $FE
Scene7Variants
        dc.b $02,$FF,BANK_2|8
        dc.b $FE
Scene11Variants
        dc.b $03,$04,$FF,BANK_2|13
        dc.b $03,$84,$FF,BANK_2|12
        dc.b $FE
Scene16Variants
        dc.b $06,$FF,BANK_3|0
        dc.b $FE
Scene18Variants
        dc.b $05,$FF,BANK_3|2
        dc.b $FE
Scene22Variants
        dc.b $07,$FF,BANK_3|6
        dc.b $FE
PageEffects
        dc.b $FE
PageContextLo
        dc.b <NoContext,<NoContext,<NoContext,<NoContext,<Scene4Context,<Scene5Context,<Scene6Context,<Scene7Context,<NoContext,<NoContext,<NoContext,<Scene11Context,<Scene12Context,<NoContext,<NoContext,<NoContext
        dc.b <Scene16Context,<NoContext,<Scene18Context,<NoContext,<NoContext,<NoContext,<Scene22Context,<NoContext
PageContextHi
        dc.b >NoContext,>NoContext,>NoContext,>NoContext,>Scene4Context,>Scene5Context,>Scene6Context,>Scene7Context,>NoContext,>NoContext,>NoContext,>Scene11Context,>Scene12Context,>NoContext,>NoContext,>NoContext
        dc.b >Scene16Context,>NoContext,>Scene18Context,>NoContext,>NoContext,>NoContext,>Scene22Context,>NoContext
NoContext
        dc.b 0
Scene4Context
        dc.b 1
        dc.w ContextLabel4_0
        dc.b $80,$FF
        dc.b $40,$FF
        dc.b $00,$FF
        dc.b $FF
        dc.b NO_EXIT
Scene5Context
        dc.b 2
        dc.w ContextLabel5_0
        dc.b $00,$FF
        dc.b $40,$FF
        dc.b $40,$FF
        dc.b $FF
        dc.b NO_EXIT
        dc.w ContextLabel5_1
        dc.b $00,$81,$FF
        dc.b $41,$FF
        dc.b $01,$FF
        dc.b $01,$FF
        dc.b NO_EXIT
Scene6Context
        dc.b 1
        dc.w ContextLabel6_0
        dc.b $00,$FF
        dc.b $40,$FF
        dc.b $40,$FF
        dc.b $FF
        dc.b NO_EXIT
Scene7Context
        dc.b 1
        dc.w ContextLabel7_0
        dc.b $82,$FF
        dc.b $01,$FF
        dc.b $02,$FF
        dc.b $41,$FF
        dc.b NO_EXIT
Scene11Context
        dc.b 1
        dc.w ContextLabel11_0
        dc.b $83,$FF
        dc.b $FF
        dc.b $03,$FF
        dc.b $FF
        dc.b NO_EXIT
Scene12Context
        dc.b 1
        dc.w ContextLabel12_0
        dc.b $03,$84,$FF
        dc.b $42,$FF
        dc.b $04,$FF
        dc.b $02,$FF
        dc.b NO_EXIT
Scene16Context
        dc.b 1
        dc.w ContextLabel16_0
        dc.b $86,$FF
        dc.b $FF
        dc.b $06,$FF
        dc.b $FF
        dc.b NO_EXIT
Scene18Context
        dc.b 1
        dc.w ContextLabel18_0
        dc.b $85,$FF
        dc.b $02,$FF
        dc.b $05,$FF
        dc.b $42,$FF
        dc.b BANK_3|3
Scene22Context
        dc.b 1
        dc.w ContextLabel22_0
        dc.b $87,$FF
        dc.b $FF
        dc.b $07,$FF
        dc.b $FF
        dc.b NO_EXIT
ContextLabel4_0 dc.b "OPEN[CHEST[["
ContextLabel5_0 dc.b "CLOSE[CHEST["
ContextLabel5_1 dc.b "TAKE[BRASS[["
ContextLabel6_0 dc.b "CLOSE[CHEST["
ContextLabel7_0 dc.b "USE[BRASS[[["
ContextLabel11_0 dc.b "MOVE[STATUE["
ContextLabel12_0 dc.b "TAKE[SILVER["
ContextLabel16_0 dc.b "TOUCH[SKULL["
ContextLabel18_0 dc.b "USE[SILVER[["
ContextLabel22_0 dc.b "TAKE[CROWN[["
