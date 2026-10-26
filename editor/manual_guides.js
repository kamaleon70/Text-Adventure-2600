"use strict";

window.TextAdventureManualGuides = {
  workflow: {
    kicker: "Recommended workflow",
    title: "Start your adventure",
    html: `<h3>1. Plan the smallest playable route</h3>
      <p>Select <strong>New project</strong> to create a clean one-room adventure, or load an existing configuration. Begin with two or three connected locations and a simple objective. Give every room a short, unique name and build this small route before expanding the world.</p>
      <h3>2. Write and connect the story</h3>
      <p>Use <strong>Rooms &amp; scenes</strong> to write each ten-line display. Configure the room exits first, then add continuation scenes with NEXT only where one display is not enough.</p>
      <h3>3. Add state gradually</h3>
      <p>Add flags for facts the game must remember and objects for portable items. Introduce one condition at a time, then verify it in Playtest before adding another dependency.</p>
      <h3>4. Test and preserve milestones</h3>
      <p>Test every route, unavailable action, conditional scene, and ending. Download a numbered configuration after each stable milestone. When the browser playtest behaves correctly, build the ROM and repeat the important tests in Javatari or Stella.</p>
      <h3>Small-project example</h3>
      <p>Create Forest, Gate, and Castle Hall. Connect Forest EAST to Gate, place a key in Forest, and keep Gate locked until a USE KEY action opens it. This tests navigation, an object, a flag, a conditional description, and an action destination before the adventure grows.</p>`,
  },
  saving: {
    kicker: "Your project file",
    title: "Save and restore",
    html: `<h3>Browser draft</h3>
      <p>The editor keeps a local draft in the browser after changes. Returning to the same page normally restores that draft, but private browsing, browser cleanup, a different device, or a different browser profile can remove it.</p>
      <h3>Save config</h3>
      <p><strong>Save config</strong> downloads the editable project, including text, map positions, links, flags, objects, colours, ending settings, contextual actions, and splash artwork. Use names such as <code>castle-01.json</code> and <code>castle-02.json</code> so an earlier working version is easy to recover.</p>
      <h3>Load config</h3>
      <p><strong>Load config</strong> replaces the editor's current project. Save the current configuration first if it contains work you may need. After loading, inspect the map and Playtest before building a new ROM.</p>
      <p>A downloaded ROM is playable but is not an editable backup. Keep the configuration file as the master copy of the adventure.</p>
      <h3>Example backup sequence</h3>
      <p>Save <code>castle-01-map.json</code> after building the rooms, <code>castle-02-objects.json</code> after adding keys and containers, and <code>castle-03-ending.json</code> after the winning route works.</p>`,
  },
  map: {
    kicker: "World structure",
    title: "World map",
    html: `<h3>Rooms and connections</h3>
      <p>Each card represents a logical room. Add a room, select it, and configure NORTH, EAST, SOUTH, and WEST from <strong>Rooms &amp; scenes</strong>. Connection lines are a visual summary of those configured exits.</p>
      <h3>Arrange the diagram</h3>
      <p>Drag cards to make the map readable. Their coordinates affect only the editor layout, so rooms may be arranged for clarity without changing the cartridge. The canvas expands as rooms are moved farther right or down and can be scrolled in both directions.</p>
      <h3>Start room and capacity</h3>
      <p>The starred card is the start room. Double-click a card to edit its primary scene. The cartridge supports up to 102 scenes in total; a room may use one scene or several continuation and conditional scenes.</p>
      <p>For large games, group related areas spatially and avoid crossing too many connection lines. Map organization has no ROM cost.</p>
      <h3>Example layout</h3>
      <p>Place outdoor rooms on the left, the castle in the centre, and underground rooms below it. This helps the author read the map, but moving a card never changes gameplay connections.</p>`,
  },
  rooms: {
    kicker: "Locations and text",
    title: "Rooms and scenes",
    html: `<h3>Logical rooms</h3>
      <p>A room owns its four normal movement exits and one primary scene. Moving into that room resolves its conditional variants and displays either the first matching variant or the primary scene.</p>
      <h3>Display scenes</h3>
      <p>A scene is one complete Atari text display: ten authored rows of up to 12 characters. Text is converted to uppercase. The eleventh row belongs to the engine and displays movement, actions, inventory return, or restart.</p>
      <h3>Names and order</h3>
      <p>The editor creates stable internal IDs automatically. Room names must be unique, while scene names must be unique within their room. Earlier/Later changes cartridge allocation order but does not create a gameplay link.</p>
      <h3>Primary and start choices</h3>
      <p><strong>Make primary</strong> selects the room's default description. <strong>Set start room</strong> selects the logical room used after power-on and Restart. Use NEXT links—not authoring order—to connect multiple pages.</p>
      <h3>Example room</h3>
      <p>Old Library can have a primary scene describing the shelves, a second scene reached with NEXT describing a strange book, and a conditional scene used after the bookcase moves. All three remain inside the same logical room and normally share its exits.</p>`,
  },
  navigation: {
    kicker: "Multiple pages",
    title: "NEXT and movement overrides",
    html: `<h3>NEXT chains</h3>
      <p>NEXT connects one scene to another scene in the same room. It is useful for descriptions that need more than ten lines. When a NEXT link exists, pressing Fire initially selects NEXT so the player can continue with a second Fire press. End the chain with <strong>End continuation</strong>. Avoid loops unless repeating NEXT forever is intentional.</p>
      <h3>Inherited movement</h3>
      <p>Scenes normally inherit the room's four exits. This keeps a multi-page room consistent and lets you change its normal navigation in one place.</p>
      <h3>Scene overrides</h3>
      <p>Use an override when a particular scene must block a direction or lead somewhere different. For example, the first page may allow NORTH while a special trap scene overrides NORTH to have no exit. Returning an override to <strong>Same as room</strong> restores inheritance.</p>
      <h3>LOOK and room entry</h3>
      <p>LOOK resolves the room again using its current flags. From a continuation page it returns to the room's primary or matching conditional scene. Movement into a room also starts from that resolved scene; it never enters an arbitrary continuation page.</p>
      <h3>Example continuation</h3>
      <p>Link Hall description 1 to Hall description 2 with NEXT. Fire initially selects NEXT on page 1. After reading page 2, LOOK returns to page 1 unless a flag now selects a different Hall variant.</p>`,
  },
  endings: {
    kicker: "Winning and losing",
    title: "Ending scenes",
    html: `<h3>Create the ending text</h3>
      <p>Add an ordinary scene and write the victory, congratulation, game-over, or other final message in its ten text rows. Enable <strong>Ending scene — only Restart is available</strong>.</p>
      <h3>What the player sees</h3>
      <p>The final action row becomes <strong>FIRE:RESTART</strong>. Directional movement, LOOK, NEXT, inventory, and contextual actions are ignored. Pressing Fire restores every flag and object to its configured initial state and returns to the start room.</p>
      <h3>Conditional ending example</h3>
      <ol><li>Create a flag such as <code>MISSION_DONE</code>.</li><li>Create the ending scene inside the destination room and mark it as an ending.</li><li>Add a Room description variant for that room which selects the ending scene when <code>MISSION_DONE</code> must be set.</li><li>Use an action elsewhere to set the flag.</li><li>Enter or resolve the destination room and verify that the ending appears.</li></ol>
      <p>If the initial flags already satisfy the ending condition in the start room, Restart will correctly return to the same ending. Change the initial state if that is not intended.</p>
      <h3>Failure and victory example</h3>
      <p>Create separate ending scenes named The Dragon Wins and Treasure Recovered. TOUCH DRAGON can go directly to the failure scene, while TAKE CROWN can set <code>MISSION_DONE</code> and go to the victory scene. Both endings offer only Restart.</p>`,
  },
  flags: {
    kicker: "Persistent story state",
    title: "Flags and room variants",
    html: `<h3>Choose meaningful flags</h3>
      <p>A flag stores one yes/no fact for the entire game. Examples include <code>DOOR_OPEN</code>, <code>DRAGON_DEAD</code>, or <code>KNOWS_CODE</code>. Up to 64 flags are available. <strong>Initially set</strong> defines the value after power-on or Restart.</p>
      <h3>Build a room variant</h3>
      <p>Select a room, add a rule, choose a scene from that same room, and select flags under <strong>must be set</strong> and <strong>must be clear</strong>. Every condition in a rule must match.</p>
      <h3>Rule priority</h3>
      <p>Rules are evaluated from top to bottom and the first match wins. Put the most specific rule first. If no rule matches, the room's primary scene is displayed.</p>
      <h3>Testing</h3>
      <p>Use the Playtest flag debugger to force combinations and check rule ordering. On Windows/Linux use Ctrl-click, or Command-click on macOS, to select multiple entries in a condition list.</p>
      <h3>Example: dark and powered room</h3>
      <p>Create <code>POWER_ON</code>, initially clear. Make the room's primary scene dark, then add a variant that shows Control Room - Lit when <code>POWER_ON</code> must be set. An action elsewhere can SET the flag; the next room entry or LOOK displays the lit scene.</p>`,
  },
  effects: {
    kicker: "Built-in actions",
    title: "Scene action effects",
    html: `<h3>When effects run</h3>
      <p>Select a source scene and a built-in action: LOOK, NORTH, EAST, SOUTH, WEST, or NEXT. Its effects run before the destination is followed. They also run when that action has no destination.</p>
      <h3>Operations</h3>
      <ul><li><strong>SET</strong> makes a flag true.</li><li><strong>CLEAR</strong> makes it false.</li><li><strong>TOGGLE</strong> reverses its current value.</li></ul>
      <p>The same flag cannot receive two operations from one action. Use a contextual action when an effect should be offered only under requirements or should manipulate an object.</p>
      <h3>Example</h3>
      <p>A NORTH action can SET <code>ENTERED_TOWER</code> before moving. The destination room may then use that flag immediately to choose a conditional description.</p>
      <p>For a one-use bridge, EAST can SET <code>BRIDGE_CROSSED</code>. A variant in the original room can later describe the bridge as collapsed. Use a contextual action instead when crossing should require an object or another flag.</p>`,
  },
  objects: {
    kicker: "Inventory and containers",
    title: "Objects",
    html: `<h3>Define an object</h3>
      <p>Each object needs a unique internal ID, an uppercase display name of at most 12 characters, a type, and an initial location. Up to eight portable items and containers are supported in total because each location consumes one byte of Atari RAM.</p>
      <h3>Portable items</h3>
      <p>A portable item can begin in a logical room, inside a container, already carried, or removed from play. Its display name is used on the inventory screen. Taking it changes its location to carried; removing it consumes or hides it permanently until Restart.</p>
      <h3>Containers</h3>
      <p>A container begins in a room and needs an open-state flag. It may also select a locked-state flag. The flags' initial values determine whether the container starts open or locked. An item inside it counts as present only when the container is in the current room and its open flag is set.</p>
      <p>Create contextual actions for the required behavior: OPEN requires the open and locked flags clear and SETs the open flag; CLOSE requires the open flag set and CLEARs it; UNLOCK requires the locked flag set and normally requires a key to be carried, then CLEARs the locked flag.</p>
      <h3>Use objects in actions</h3>
      <p>A contextual action can require an object to be present in the current room or carried. It can then take a portable item into inventory or remove an object. Room presence uses the logical room, so the same object remains present across that room's continuation and conditional scenes. Closing a container hides remaining contents without moving or deleting them.</p>
      <p>References and contained items must be removed before their object or container can be deleted.</p>
      <h3>Example: key inside a chest</h3>
      <ol><li>Create <code>CHEST_OPEN</code>, initially clear.</li><li>Create a Chest container and select that open-state flag.</li><li>Create a Key portable item with <strong>Inside: Chest</strong> as its initial location.</li><li>OPEN CHEST requires <code>CHEST_OPEN</code> clear and SETs it.</li><li>TAKE KEY uses <strong>Must be here: Key</strong> and <strong>Take object: Key</strong>. It appears only while the chest is open.</li></ol>`,
  },
  contextual: {
    kicker: "Custom verbs",
    title: "Contextual actions",
    html: `<h3>Create the action</h3>
      <p>Select a scene and add an action. Its label occupies the complete 12-character Atari action row, so use a short command such as <code>TAKE KEY</code>, <code>OPEN DOOR</code>, or <code>USE FUSE</code>.</p>
      <h3>Requirements</h3>
      <p><strong>Require set</strong> and <strong>Require clear</strong> test flags. <strong>Must be carried</strong> tests portable items. <strong>Must be here</strong> tests an object in the room, including an item inside an open container. The action is offered only when every configured requirement matches.</p>
      <h3>Results</h3>
      <p>The action may SET, CLEAR, or TOGGLE flags, take one object, and remove one object. <strong>After action</strong> can stay in the current room, enter another logical room, or display a specific scene. Entering a room resolves its conditional description; selecting a scene goes directly to that scene.</p>
      <h3>Example sequence</h3>
      <p>TAKE KEY requires the key to be here and takes it. UNLOCK requires the key to be carried, sets <code>DOOR_OPEN</code>, optionally removes the key, and can enter the room beyond the door immediately. Leave <strong>After action</strong> empty when the action should simply resolve the current room again.</p>
      <h3>Destination examples</h3>
      <ul><li><strong>Stay in current room:</strong> OPEN CHEST sets <code>CHEST_OPEN</code>, then a room variant reveals the contents.</li><li><strong>Enter room:</strong> USE KEY sets <code>CASTLE_OPEN</code>, removes the key, and enters Castle Hall.</li><li><strong>Show specific scene:</strong> READ NOTE displays a scene containing the message without changing the logical room.</li></ul>`,
  },
  playtest: {
    kicker: "Fast iteration",
    title: "Playtest",
    html: `<h3>Test the game model</h3>
      <p>The browser playtest simulates navigation, NEXT, variants, actions, inventory, containers, objects, and endings without compiling a ROM. Available controls are highlighted; unavailable contextual actions remain disabled.</p>
      <h3>Debug state</h3>
      <p>The flag debugger can force any flag on or off, including open and locked container states. The object debugger can move a portable item into a room, container, inventory, or removed state. These tools are useful for reaching combinations quickly and do not change the project's configured initial values.</p>
      <h3>Reset and test checklist</h3>
      <p><strong>Reset to start room</strong> restores the configured initial state. Test every entrance to each room, both outcomes of each condition, inventory with zero and several items, unavailable actions, all NEXT chains, and every ending.</p>
      <p>Playtest checks story logic, but the compiled ROM must still be tested in Javatari, Stella, or hardware for final display and controller behavior.</p>
      <h3>Example test sequence</h3>
      <p>At a locked gate, confirm USE KEY is disabled before taking the key. Move the key to inventory with the Object debugger and confirm the action appears. Execute it, then verify the flag, consumed key, and destination.</p>`,
  },
  appearance: {
    kicker: "Cartridge display",
    title: "Colours and border",
    html: `<h3>Global defaults</h3>
      <p>The Appearance tab controls the normal story background, side-panel colour, story text, action-row text, side-panel style, and optional action-row background. The palette uses even Atari colour bytes.</p>
      <h3>Reusable appearance presets</h3>
      <p>Create named presets such as <strong>Outdoor</strong>, <strong>Castle</strong>, or <strong>Dungeon</strong> in the Appearance tab. Select a preset in a room to apply it to every scene in that room. Editing the preset later updates every room linked to it.</p>
      <p>The room editor can also copy the effective appearance of another room, or promote the current scene's appearance to the entire room.</p>
      <h3>Per-scene overrides</h3>
      <p>Open a scene under <strong>Rooms &amp; scenes</strong>. Enable only the appearance settings that should differ. Unchecked fields inherit the room preset or room appearance, then the global defaults. <strong>Reset to room appearance</strong> removes all overrides from that scene. You can also copy the complete appearance of another scene.</p>
      <p>The inheritance order is <strong>Global default → Room appearance → Scene appearance → Individual scene settings</strong>. A scene can inherit its room or select another reusable theme, making effects such as lights turning on or a danger scene changing to red straightforward. Selecting a room appearance clears that room's previous scene appearance so the theme applies immediately; scenes can then be customized again. Version 0.3 configuration files remain compatible and keep their existing global and per-scene colours until you choose a room or scene appearance.</p>
      <h3>Action row and border</h3>
      <p>The action background affects the centre behind the final row while the side panels remain visible. Striped panels preserve the original appearance; solid panels fill the same side areas.</p>
      <p>The browser palette is an NTSC approximation. Always inspect the compiled cartridge in an emulator or on the intended television and hardware.</p>
      <h3>Example theme inheritance</h3>
      <p>Use neutral blue globally, an Outdoor green preset for forest rooms, and a Castle grey preset indoors. Give one conditional alarm scene a red Danger preset. Editing Danger later updates every linked scene.</p>`,
  },
  splash: {
    kicker: "Opening artwork",
    title: "Create a splash screen",
    html: `<h3>Create compatible artwork</h3>
      <p>Open Alien Bill's <a href="https://alienbill.com/2600/atari-background-builder/" target="_blank" rel="noopener noreferrer">Atari Background Builder</a> and draw a 40-pixel-wide image. Choose black (<code>$00</code>) as the background.</p>
      <h3>Required export settings</h3>
      <ul><li><strong>Render Type:</strong> ASM Asymmetrical (Mirrored) color</li><li><strong>Kernel:</strong> 2 Scanline Kernel</li><li><strong>Height:</strong> 1–90 rows, producing at most 180 scanlines</li></ul>
      <h3>Import into the editor</h3>
      <p>Download the ASM file, open the editor's Splash screen tab, upload it, and enable the splash. Confirm that the decoded preview looks correct. Uploaded assembly instructions are not executed; the editor extracts the supported playfield and colour tables.</p>
      <h3>Start behavior</h3>
      <p>The display time is measured in NTSC frames; 120 frames is about two seconds. After the delay, the player must release Fire and press it again. The splash occupies physical bank 0 but does not reduce the 102-scene capacity.</p>
      <h3>Example</h3>
      <p>Create a castle silhouette, export it with the mirrored-colour and two-scanline settings, import the ASM, set 120 frames, and verify that Fire starts the game only after the delay and a release.</p>`,
  },
  build: {
    kicker: "Cartridge workflow",
    title: "Build and run",
    html: `<h3>Build and download</h3>
      <p>This validates the current editor contents, assembles all eight F4 banks in the browser, and downloads a 32K ROM. Keep the separate configuration file as the editable source project.</p>
      <h3>Build and run Javatari</h3>
      <p>This performs the same build and sends the completed ROM directly to the embedded emulator. The emulator keeps the Atari display proportions while the build log remains available beside it.</p>
      <h3>Reading errors</h3>
      <p>The Build output identifies invalid IDs, missing links, unsupported characters, capacity problems, splash-format errors, and assembler failures. Correct the reported project data, save the configuration, and build again.</p>
      <h3>Final testing</h3>
      <p>Test the downloaded ROM in Stella and, when possible, on compatible hardware. The cartridge uses the 32K F4 bankswitching format. Verify startup, splash exit, all controls, state changes, endings, and Restart.</p>
      <h3>Example release check</h3>
      <p>Run the game in Javatari, then download the same ROM for Stella. Obtain and use every required object, reach one failure and one victory ending, press Restart, and confirm all flags and objects return to their initial state.</p>`,
  },
  controls: {
    kicker: "Atari controls",
    title: "Playing the cartridge",
    html: `<h3>Movement mode</h3>
      <p>NORTH, EAST, SOUTH, and WEST immediately attempt the matching room movement. The action row normally shows the available compass directions.</p>
      <h3>Action-selection mode</h3>
      <p>Press Fire to enter action selection. NEXT is selected first when the scene has a continuation link; otherwise LOOK is selected. Move the joystick in any direction to cycle through LOOK, NEXT, INVENTORY, and available contextual actions. Press Fire again to perform the displayed choice.</p>
      <h3>Inventory and endings</h3>
      <p>Inventory lists carried objects and uses Fire to return. On an ending scene, all other input is disabled and the action row displays <strong>FIRE:RESTART</strong>.</p>
      <h3>Clean input</h3>
      <p>Release both joystick and Fire between commands. The engine waits for a neutral controller state before accepting another input, preventing a single press from being read more than once.</p>
      <h3>Example input sequence</h3>
      <p>On a scene with NEXT, press Fire, release it, confirm NEXT is displayed, then press Fire again. On the final continuation page, Fire starts with LOOK instead; LOOK returns to the room's primary or matching conditional scene.</p>`,
  },
  interactions: {
    kicker: "Features working together",
    title: "Rooms, flags, objects, and actions",
    html: `<h3>The usual interaction chain</h3>
      <ol><li>A <strong>room or scene</strong> provides the current location and text.</li><li><strong>Flags and object locations</strong> store what has happened.</li><li>A <strong>contextual action</strong> checks those facts to decide whether it is available.</li><li>The action changes flags or objects, then optionally enters a room or displays a scene.</li><li>The destination room resolves its variants using the newly changed state.</li></ol>
      <h3>Complete example: enter a locked castle</h3>
      <ol><li>Create a Chest container and a Brass Key inside it.</li><li>OPEN CHEST SETs <code>CHEST_OPEN</code>; TAKE KEY requires the key to be here and moves it to inventory.</li><li>At Castle Gate, USE KEY requires the Brass Key carried and <code>CASTLE_OPEN</code> clear.</li><li>USE KEY SETs <code>CASTLE_OPEN</code>, removes the key, and uses <strong>After action: Enter room - Castle Hall</strong>.</li><li>If the player returns to the gate, its variant requiring <code>CASTLE_OPEN</code> shows the open-gate description.</li></ol>
      <h3>Appearance and endings</h3>
      <p>The same state change can select a scene with a different appearance. For example, a danger variant may use a red preset. An action destination may also point directly to a victory or failure scene marked as an ending, where only Restart remains available.</p>
      <h3>Choosing the correct feature</h3>
      <p>Use flags for facts the game remembers, objects for items and containers, variants for state-dependent descriptions, NEXT for additional reading, and action destinations when performing the action itself should move the story somewhere new.</p>`,
  },
};
