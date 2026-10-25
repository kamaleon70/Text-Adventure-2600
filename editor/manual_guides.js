"use strict";

window.TextAdventureManualGuides = {
  workflow: {
    kicker: "Recommended workflow",
    title: "Start your adventure",
    html: `<h3>1. Plan the smallest playable route</h3>
      <p>Begin with a start room, two or three connected locations, and a simple objective. Give every room a short name and a stable ID. Build and test this small route before expanding the world.</p>
      <h3>2. Write and connect the story</h3>
      <p>Use <strong>Rooms &amp; scenes</strong> to write each ten-line display. Configure the room exits first, then add continuation scenes with NEXT only where one display is not enough.</p>
      <h3>3. Add state gradually</h3>
      <p>Add flags for facts the game must remember and objects for portable items. Introduce one condition at a time, then verify it in Playtest before adding another dependency.</p>
      <h3>4. Test and preserve milestones</h3>
      <p>Test every route, unavailable action, conditional scene, and ending. Download a numbered configuration after each stable milestone. When the browser playtest behaves correctly, build the ROM and repeat the important tests in Javatari or Stella.</p>`,
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
      <p>A downloaded ROM is playable but is not an editable backup. Keep the configuration file as the master copy of the adventure.</p>`,
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
      <p>For large games, group related areas spatially and avoid crossing too many connection lines. Map organization has no ROM cost.</p>`,
  },
  rooms: {
    kicker: "Locations and text",
    title: "Rooms and scenes",
    html: `<h3>Logical rooms</h3>
      <p>A room owns its four normal movement exits and one primary scene. Moving into that room resolves its conditional variants and displays either the first matching variant or the primary scene.</p>
      <h3>Display scenes</h3>
      <p>A scene is one complete Atari text display: ten authored rows of up to 12 characters. Text is converted to uppercase. The eleventh row belongs to the engine and displays movement, actions, inventory return, or restart.</p>
      <h3>IDs, names, and order</h3>
      <p>IDs are internal references. Keep them short and descriptive, start them with a letter or underscore, and use only letters, numbers, and underscores. Names are editor labels and can be more readable. Earlier/Later changes cartridge allocation order but does not create a gameplay link.</p>
      <h3>Primary and start choices</h3>
      <p><strong>Make primary</strong> selects the room's default description. <strong>Set start room</strong> selects the logical room used after power-on and Restart. Use NEXT links—not authoring order—to connect multiple pages.</p>`,
  },
  navigation: {
    kicker: "Multiple pages",
    title: "NEXT and movement overrides",
    html: `<h3>NEXT chains</h3>
      <p>NEXT connects one scene to another scene in the same room. It is useful for descriptions that need more than ten lines. End the chain with <strong>End continuation</strong>. Avoid loops unless repeating NEXT forever is intentional.</p>
      <h3>Inherited movement</h3>
      <p>Scenes normally inherit the room's four exits. This keeps a multi-page room consistent and lets you change its normal navigation in one place.</p>
      <h3>Scene overrides</h3>
      <p>Use an override when a particular scene must block a direction or lead somewhere different. For example, the first page may allow NORTH while a special trap scene overrides NORTH to have no exit. Returning an override to <strong>Same as room</strong> restores inheritance.</p>
      <h3>LOOK and room entry</h3>
      <p>LOOK resolves the room again using its current flags. Movement into a room always starts from its primary or matching conditional scene; it never enters an arbitrary continuation page.</p>`,
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
      <p>If the initial flags already satisfy the ending condition in the start room, Restart will correctly return to the same ending. Change the initial state if that is not intended.</p>`,
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
      <p>Use the Playtest flag debugger to force combinations and check rule ordering. On Windows/Linux use Ctrl-click, or Command-click on macOS, to select multiple entries in a condition list.</p>`,
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
      <p>A NORTH action can SET <code>ENTERED_TOWER</code> before moving. The destination room may then use that flag immediately to choose a conditional description.</p>`,
  },
  objects: {
    kicker: "Inventory",
    title: "Objects",
    html: `<h3>Define an object</h3>
      <p>Each object needs a unique internal ID, an uppercase inventory name of at most 12 characters, and an initial location. The initial location can be a room, already carried, or removed from play.</p>
      <h3>Object states</h3>
      <p>An object is always in exactly one state: located in a logical room, carried in inventory, or removed. Up to eight objects are supported because each location consumes one byte of Atari RAM.</p>
      <h3>Use objects in actions</h3>
      <p>A contextual action can require an object to be present in the current room or carried. It can then take an object into inventory or remove a consumed object. Room presence uses the logical room, so the same object remains present across that room's continuation and conditional scenes.</p>
      <p>References must be removed from contextual actions before an object can be deleted.</p>`,
  },
  contextual: {
    kicker: "Custom verbs",
    title: "Contextual actions",
    html: `<h3>Create the action</h3>
      <p>Select a scene and add an action. Its label occupies the complete 12-character Atari action row, so use a short command such as <code>TAKE KEY</code>, <code>OPEN DOOR</code>, or <code>USE FUSE</code>.</p>
      <h3>Requirements</h3>
      <p><strong>Require set</strong> and <strong>Require clear</strong> test flags. <strong>Must be carried</strong> and <strong>Must be here</strong> test objects. The action is offered only when every configured requirement matches.</p>
      <h3>Results</h3>
      <p>The action may SET, CLEAR, or TOGGLE flags, take one object, and remove one object. After execution, the current room's variant rules are evaluated again, allowing the display to change immediately.</p>
      <h3>Example sequence</h3>
      <p>TAKE KEY requires the key to be here and takes it. UNLOCK requires the key to be carried, sets <code>DOOR_OPEN</code>, and optionally removes the key. A room variant requiring <code>DOOR_OPEN</code> can then reveal the open-door description.</p>`,
  },
  playtest: {
    kicker: "Fast iteration",
    title: "Playtest",
    html: `<h3>Test the game model</h3>
      <p>The browser playtest simulates navigation, NEXT, variants, actions, inventory, objects, and endings without compiling a ROM. Available controls are highlighted; unavailable contextual actions remain disabled.</p>
      <h3>Debug state</h3>
      <p>The flag debugger can force any flag on or off. The object debugger can move an object into a room, inventory, or removed state. These tools are useful for reaching combinations quickly and do not change the project's configured initial values.</p>
      <h3>Reset and test checklist</h3>
      <p><strong>Reset to start room</strong> restores the configured initial state. Test every entrance to each room, both outcomes of each condition, inventory with zero and several items, unavailable actions, all NEXT chains, and every ending.</p>
      <p>Playtest checks story logic, but the compiled ROM must still be tested in Javatari, Stella, or hardware for final display and controller behavior.</p>`,
  },
  appearance: {
    kicker: "Cartridge display",
    title: "Colours and border",
    html: `<h3>Global defaults</h3>
      <p>The Appearance tab controls the normal story background, side-panel colour, story text, action-row text, side-panel style, and optional action-row background. The palette uses even Atari colour bytes.</p>
      <h3>Per-scene overrides</h3>
      <p>Open a scene under <strong>Rooms &amp; scenes</strong>. Enable only the appearance settings that should differ. Unchecked fields remain linked to the global values, so later global changes continue to affect them. <strong>Reset to global defaults</strong> removes all overrides from that scene.</p>
      <h3>Action row and border</h3>
      <p>The action background affects the centre behind the final row while the side panels remain visible. Striped panels preserve the original appearance; solid panels fill the same side areas.</p>
      <p>The browser palette is an NTSC approximation. Always inspect the compiled cartridge in an emulator or on the intended television and hardware.</p>`,
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
      <p>The display time is measured in NTSC frames; 120 frames is about two seconds. After the delay, the player must release Fire and press it again. The splash occupies physical bank 0 but does not reduce the 102-scene capacity.</p>`,
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
      <p>Test the downloaded ROM in Stella and, when possible, on compatible hardware. The cartridge uses the 32K F4 bankswitching format. Verify startup, splash exit, all controls, state changes, endings, and Restart.</p>`,
  },
  controls: {
    kicker: "Atari controls",
    title: "Playing the cartridge",
    html: `<h3>Movement mode</h3>
      <p>NORTH, EAST, SOUTH, and WEST immediately attempt the matching room movement. The action row normally shows the available compass directions.</p>
      <h3>Action-selection mode</h3>
      <p>Press Fire to enter action selection. Move the joystick in any direction to cycle through available choices such as LOOK, NEXT, INVENTORY, and contextual actions. Press Fire again to perform the displayed choice.</p>
      <h3>Inventory and endings</h3>
      <p>Inventory lists carried objects and uses Fire to return. On an ending scene, all other input is disabled and the action row displays <strong>FIRE:RESTART</strong>.</p>
      <h3>Clean input</h3>
      <p>Release both joystick and Fire between commands. The engine waits for a neutral controller state before accepting another input, preventing a single press from being read more than once.</p>`,
  },
};
