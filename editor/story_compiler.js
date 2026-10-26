(function (root) {
  "use strict";

  const BANKS = Array.from({ length: 8 }, (_, index) => index);
  const STORY_BANKS = [2, 3, 4, 5, 6, 7];
  const MOVEMENTS = ["north", "east", "south", "west"];
  const ACTIONS = ["look", ...MOVEMENTS, "next"];
  const FLAG_EFFECTS = ["set", "clear", "toggle"];
  const SPLASH_TABLES = ["PF0DataA", "PF1DataA", "PF2DataA", "PF0DataB", "PF1DataB", "PF2DataB", "PFColors"];
  const ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const ALLOWED = new Set(" )*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const ROW_WIDTH = 12;
  const MAX_PAGES_PER_BANK = 17;
  const APPEARANCE_DEFAULTS = { background_color: 0x82, border_color: 0x84, text_color: 0x0E, action_text_color: 0x0E, action_background_enabled: false, action_background_color: 0x24, border_style: "striped" };
  const APPEARANCE_FIELDS = Object.keys(APPEARANCE_DEFAULTS);
  const BORDER_STYLES = { striped: 0, solid: 1 };

  function fail(message) { throw new Error(message); }
  function hex(value) { return `$${Number(value).toString(16).toUpperCase().padStart(2, "0")}`; }
  function unknownKeys(value, allowed) { return Object.keys(value).filter((key) => !allowed.includes(key)); }
  function target(value, label) {
    if (value == null || value === "") return null;
    if (typeof value !== "string") fail(`${label} must be an ID or empty`);
    return value;
  }
  function validateCharacters(value, label, allowEmpty = false) {
    if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > ROW_WIDTH) fail(`${label} must contain ${allowEmpty ? `0-${ROW_WIDTH}` : `1-${ROW_WIDTH}`} characters`);
    const result = value.toUpperCase();
    const invalid = [...new Set([...result].filter((character) => !ALLOWED.has(character)))].sort();
    if (invalid.length) fail(`${label} has unsupported character(s): ${invalid.join("")}`);
    return result;
  }
  function checkedFlags(value, label, flagIds) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) fail(`${label} must be a list of flag IDs`);
    if (new Set(value).size !== value.length) fail(`${label} contains a duplicate flag`);
    const missing = value.find((item) => !flagIds.has(item));
    if (missing) fail(`${label} references missing flag '${missing}'`);
    return [...value];
  }

  function validateAppearance(value) {
    const raw = value == null ? {} : value;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("appearance must be an object");
    const unknown = unknownKeys(raw, Object.keys(APPEARANCE_DEFAULTS));
    if (unknown.length) fail(`appearance has unknown field '${unknown[0]}'`);
    const appearance = { ...APPEARANCE_DEFAULTS, ...raw };
    for (const field of ["background_color", "border_color", "text_color", "action_text_color", "action_background_color"]) {
      const colour = appearance[field];
      if (!Number.isInteger(colour) || colour < 0 || colour > 0xFE || colour % 2) fail(`appearance.${field} must be an even Atari colour byte from 00 to FE`);
    }
    if (typeof appearance.action_background_enabled !== "boolean") fail("appearance.action_background_enabled must be true or false");
    if (!Object.hasOwn(BORDER_STYLES, appearance.border_style)) fail("appearance.border_style must be striped or solid");
    return appearance;
  }

  function validateAppearanceOverrides(value, label) {
    const raw = value == null ? {} : value;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(`${label}: appearance_overrides must be an object`);
    const unknown = unknownKeys(raw, APPEARANCE_FIELDS);
    if (unknown.length) fail(`${label}: appearance_overrides has unknown field '${unknown[0]}'`);
    const overrides = {};
    for (const [field, setting] of Object.entries(raw)) {
      if (["background_color", "border_color", "text_color", "action_text_color", "action_background_color"].includes(field)) {
        if (!Number.isInteger(setting) || setting < 0 || setting > 0xFE || setting % 2) fail(`${label}: ${field} must be an even Atari colour byte from 00 to FE`);
      } else if (field === "action_background_enabled" && typeof setting !== "boolean") fail(`${label}: action_background_enabled must be true or false`);
      else if (field === "border_style" && !Object.hasOwn(BORDER_STYLES, setting)) fail(`${label}: border_style must be striped or solid`);
      overrides[field] = setting;
    }
    return overrides;
  }

  function parseSplash(source) {
    if (typeof source !== "string" || !source.trim()) fail("Select a splash-screen ASM file");
    if (new TextEncoder().encode(source).length > 128 * 1024) fail("Splash-screen ASM must be no larger than 128 KB");
    const constant = (name) => {
      const match = source.match(new RegExp(`^\\s*${name}\\s*=\\s*#?(\\d+)\\s*(?:;.*)?$`, "im"));
      if (!match) fail(`Splash ASM is missing ${name}`);
      return Number(match[1]);
    };
    const kernelLines = constant("kernel_lines");
    const lineCount = constant("playfield_lines");
    const lineHeight = constant("playfield_line_height");
    if (kernelLines !== 192 || lineHeight !== 2 || lineCount < 1 || lineCount > 90) fail("Splash ASM must use a 192-line, 2-scanline kernel with 1-90 rows");
    if (!/^\s*sta\s+CTRLPF\b/im.test(source)) fail("Splash ASM is not a mirrored playfield export");
    const tables = {};
    for (let index = 0; index < SPLASH_TABLES.length; index += 1) {
      const name = SPLASH_TABLES[index];
      const start = source.search(new RegExp(`^\\s*${name}\\s*:?\\s*(?:;[^\\r\\n]*)?$`, "im"));
      if (start < 0) fail(`Splash ASM is missing ${name}`);
      const tail = source.slice(start).replace(/^.*\r?\n/, "");
      const nextNames = SPLASH_TABLES.filter((candidate) => candidate !== name).join("|");
      const endMatch = tail.match(new RegExp(`^\\s*(?:${nextNames})\\s*:?\\s*(?:;[^\\r\\n]*)?$|^\\s*(?:ORG|SEG|END)\\b`, "im"));
      const block = endMatch ? tail.slice(0, endMatch.index) : tail;
      const values = [];
      for (const match of block.matchAll(/^\s*\.?(?:byte|dc\.b)\s+([^;\r\n]+)/gim)) {
        for (const rawToken of match[1].split(",")) {
          const token = rawToken.trim();
          if (/^%[01]{8}$/.test(token)) values.push(parseInt(token.slice(1), 2));
          else if (/^\$[0-9a-f]{1,2}$/i.test(token)) values.push(parseInt(token.slice(1), 16));
          else if (/^\d{1,3}$/.test(token) && Number(token) <= 255) values.push(Number(token));
          else fail(`${name} contains unsupported byte value '${token}'`);
        }
      }
      if (values.length !== lineCount) fail(`${name} must contain ${lineCount} bytes; found ${values.length}`);
      tables[name] = values;
    }
    return { kernel_lines: kernelLines, line_count: lineCount, line_height: lineHeight, tables };
  }

  function validateProject(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) fail("Project must be a JSON object");
    const raw = structuredClone(input);
    if (!Array.isArray(raw.rooms) || !raw.rooms.length) fail("The project needs at least one room");
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title || title.length > 80) fail("Project title must contain 1-80 characters");
    const splashRaw = raw.splash || {};
    const splashSource = typeof splashRaw.source === "string" ? splashRaw.source : "";
    const splashEnabled = Boolean(splashRaw.enabled);
    const splashParsed = splashSource.trim() ? parseSplash(splashSource) : null;
    if (splashEnabled && !splashParsed) fail("Enable splash requires a compatible ASM file");
    const delay = Number(splashRaw.delay_frames ?? 120);
    if (!Number.isInteger(delay) || delay < 0 || delay > 255) fail("Splash delay must be between 0 and 255 frames");
    const splash = { enabled: splashEnabled, filename: String(splashRaw.filename || "").split(/[\\/]/).pop(), source: splashSource, delay_frames: delay, background_color: 0, metadata: splashParsed ? { kernel_lines: splashParsed.kernel_lines, line_count: splashParsed.line_count, line_height: splashParsed.line_height } : null };
    const appearance = validateAppearance(raw.appearance);
    const appearancePresets = raw.appearance_presets || [];
    if (!Array.isArray(appearancePresets) || appearancePresets.length > 32) fail("appearance_presets must contain at most 32 entries");
    const presetIds = new Set();
    const cleanAppearancePresets = appearancePresets.map((preset, index) => {
      if (!preset || typeof preset !== "object" || !ID_PATTERN.test(preset.id || "")) fail(`appearance preset ${index + 1} has an invalid ID`);
      if (presetIds.has(preset.id)) fail(`Duplicate appearance preset ID: ${preset.id}`);
      presetIds.add(preset.id);
      const name = String(preset.name || "").trim();
      if (!name || name.length > 48) fail(`${preset.id}: preset name must contain 1-48 characters`);
      return { id: preset.id, name, appearance: validateAppearance(preset.appearance) };
    });

    const flags = raw.flags || [];
    if (!Array.isArray(flags) || flags.length > 64) fail("Project flags must contain at most 64 entries");
    const flagIds = new Set();
    const cleanFlags = flags.map((flag, index) => {
      if (!flag || typeof flag !== "object" || !ID_PATTERN.test(flag.id || "")) fail(`flag ${index + 1} has an invalid ID`);
      if (flagIds.has(flag.id)) fail(`Duplicate flag ID: ${flag.id}`);
      flagIds.add(flag.id); return { id: flag.id, initial: Boolean(flag.initial) };
    });
    const objects = raw.objects || [];
    if (!Array.isArray(objects) || objects.length > 8) fail("Project objects must contain at most eight entries");
    const objectIds = new Set();
    const cleanObjects = objects.map((record, index) => {
      if (!record || typeof record !== "object" || !ID_PATTERN.test(record.id || "")) fail(`object ${index + 1} has an invalid ID`);
      if (objectIds.has(record.id)) fail(`Duplicate object ID: ${record.id}`);
      objectIds.add(record.id);
      return { id: record.id, name: validateCharacters(record.name || "", `${record.id}: name`), initial_location: String(record.initial_location || "") };
    });

    const firstBank = 2;
    const roomIds = new Set(); const sceneIds = new Set(); let sceneCount = 0;
    const rooms = raw.rooms.map((room, roomIndex) => {
      if (!room || typeof room !== "object" || !ID_PATTERN.test(room.id || "")) fail(`room ${roomIndex + 1} has an invalid ID`);
      if (roomIds.has(room.id)) fail(`Duplicate room ID: ${room.id}`); roomIds.add(room.id);
      const localIds = new Set();
      const scenes = (room.scenes || []).map((scene, sceneIndex) => {
        if (!scene || !ID_PATTERN.test(scene.id || "")) fail(`${room.id} scene ${sceneIndex + 1} has an invalid ID`);
        if (sceneIds.has(scene.id)) fail(`Duplicate scene ID: ${scene.id}`); sceneIds.add(scene.id); localIds.add(scene.id);
        if (!Array.isArray(scene.text) || scene.text.length !== 10) fail(`${scene.id}: text must contain exactly 10 rows`);
        const effects = {};
        for (const [action, effectRaw] of Object.entries(scene.effects || {})) {
          if (!ACTIONS.includes(action)) fail(`${scene.id}: effects must use valid action names`);
          const effect = {}; for (const operation of FLAG_EFFECTS) effect[operation] = checkedFlags(effectRaw?.[operation], `${scene.id}: ${action} ${operation}`, flagIds);
          effects[action] = effect;
        }
        const contextActions = (scene.context_actions || []).map((action, actionIndex) => {
          const label = `${scene.id}: contextual action ${actionIndex + 1}`;
          const actionEffects = {}; for (const operation of FLAG_EFFECTS) actionEffects[operation] = checkedFlags(action.effects?.[operation], `${label} ${operation}`, flagIds);
          actionEffects.take_object = target(action.effects?.take_object, `${label} take_object`);
          actionEffects.remove_object = target(action.effects?.remove_object, `${label} remove_object`);
          return { label: validateCharacters(action.label || "", `${label} label`), when_all: checkedFlags(action.when_all, `${label} when_all`, flagIds), when_clear: checkedFlags(action.when_clear, `${label} when_clear`, flagIds), requires_carried: target(action.requires_carried, `${label} requires_carried`), requires_here: target(action.requires_here, `${label} requires_here`), effects: actionEffects };
        });
        if (contextActions.length > 6) fail(`${scene.id}: context_actions must contain at most six actions`);
        const appearancePreset = target(scene.appearance_preset, `${scene.id}: appearance_preset`);
        if (appearancePreset && !presetIds.has(appearancePreset)) fail(`${scene.id}: appearance_preset references missing preset '${appearancePreset}'`);
        const result = { id: scene.id, name: String(scene.name || scene.id).trim(), bank: firstBank + Math.floor(sceneCount / MAX_PAGES_PER_BANK), text: scene.text.map((row, index) => validateCharacters(row, `${scene.id} row ${index + 1}`, true)), next: target(scene.next, `${scene.id}: NEXT target`), exit_overrides: {}, ending: Boolean(scene.ending), appearance_preset: appearancePreset, appearance_overrides: validateAppearanceOverrides(scene.appearance_overrides, scene.id), effects, context_actions: contextActions };
        for (const [direction, value] of Object.entries(scene.exit_overrides || {})) { if (!MOVEMENTS.includes(direction)) fail(`${scene.id}: unknown exit override ${direction}`); result.exit_overrides[direction] = target(value, `${scene.id}: ${direction} override`); }
        sceneCount += 1; return result;
      });
      if (!scenes.length) fail(`${room.id}: room needs at least one scene`);
      const entry = room.entry_scene || scenes[0].id;
      if (!localIds.has(entry)) fail(`${room.id}: entry_scene must name a scene in this room`);
      const exits = {}; for (const direction of MOVEMENTS) exits[direction] = target(room.exits?.[direction], `${room.id}: ${direction} exit`);
      const variants = (room.variants || []).map((variant, index) => ({ scene: variant.scene, when_all: checkedFlags(variant.when_all, `${room.id}: variant ${index + 1} when_all`, flagIds), when_clear: checkedFlags(variant.when_clear, `${room.id}: variant ${index + 1} when_clear`, flagIds) }));
      const appearancePreset = target(room.appearance_preset, `${room.id}: appearance_preset`);
      if (appearancePreset && !presetIds.has(appearancePreset)) fail(`${room.id}: appearance_preset references missing preset '${appearancePreset}'`);
      return { id: room.id, name: String(room.name || room.id).trim(), position: { x: Math.max(20, Number(room.position?.x) || 80), y: Math.max(20, Number(room.position?.y) || 80) }, appearance_preset: appearancePreset, appearance_overrides: validateAppearanceOverrides(room.appearance_overrides, room.id), entry_scene: entry, exits, scenes, variants };
    });
    if (sceneCount > STORY_BANKS.length * MAX_PAGES_PER_BANK) fail(`The 32K cartridge supports at most ${STORY_BANKS.length * MAX_PAGES_PER_BANK} scenes`);
    if (!roomIds.has(raw.start_room)) fail("start_room must name an existing room");
    const sceneRoom = new Map(rooms.flatMap((room) => room.scenes.map((scene) => [scene.id, room.id])));
    for (const object of cleanObjects) if (![...roomIds, "carried", "removed"].includes(object.initial_location)) fail(`${object.id}: initial_location references a missing room`);
    for (const room of rooms) {
      for (const direction of MOVEMENTS) if (room.exits[direction] && !roomIds.has(room.exits[direction])) fail(`${room.id}: ${direction} points to a missing room`);
      for (const variant of room.variants) if (sceneRoom.get(variant.scene) !== room.id) fail(`${room.id}: variant scene must belong to this room`);
      for (const scene of room.scenes) {
        if (scene.next && sceneRoom.get(scene.next) !== room.id) fail(`${scene.id}: NEXT must point to a scene in the same room`);
        for (const value of Object.values(scene.exit_overrides)) if (value && !roomIds.has(value)) fail(`${scene.id}: exit override points to a missing room`);
        for (const action of scene.context_actions) for (const id of [action.requires_carried, action.requires_here, action.effects.take_object, action.effects.remove_object]) if (id && !objectIds.has(id)) fail(`${scene.id}: contextual action references missing object '${id}'`);
      }
    }
    return { version: 2, title, start_room: raw.start_room, appearance, appearance_presets: cleanAppearancePresets, splash, flags: cleanFlags, objects: cleanObjects, rooms };
  }

  const records = (project) => project.rooms.flatMap((room) => room.scenes.map((scene) => [room, scene]));
  const bankScenes = (project, bank) => records(project).filter(([, scene]) => scene.bank === bank);

  function generateBank(project, bank) {
    const pages = bankScenes(project, bank); const locations = new Map();
    for (const targetBank of BANKS) bankScenes(project, targetBank).forEach(([, scene], index) => locations.set(scene.id, [targetBank, index]));
    const rooms = new Map(project.rooms.map((room) => [room.id, room]));
    const [startBank, startPage] = locations.get(rooms.get(project.start_room).entry_scene);
    const flagIndexes = new Map(project.flags.map((flag, index) => [flag.id, index]));
    const objectIndexes = new Map(project.objects.map((object, index) => [object.id, index]));
    const encodedScene = (id) => { const [b, page] = locations.get(id); return `BANK_${b}|${page}`; };
    const objectLocations = project.objects.map((object) => object.initial_location === "carried" ? "$FE" : object.initial_location === "removed" ? "$FF" : encodedScene(rooms.get(object.initial_location).entry_scene));
    const masks = Array(8).fill(0); project.flags.forEach((flag, index) => { if (flag.initial) masks[Math.floor(index / 8)] |= 1 << (index & 7); });
    const lines = [`; GENERATED in browser - BANK ${bank}`, "; Rooms are flattened to runtime pages.", "", `START_BANK     equ ${startBank}`, `START_PAGE     equ ${startPage}`, "InitialFlags", `        dc.b ${masks.map(hex).join(",")}`, `OBJECT_COUNT    equ ${project.objects.length}`, "InitialObjectLocations", `        dc.b ${objectLocations.join(",") || "$FF"}`, "ObjectNameLo", `        dc.b ${project.objects.map((_, i) => `<ObjectName${i}`).join(",") || "<BlankLine"}`, "ObjectNameHi", `        dc.b ${project.objects.map((_, i) => `>ObjectName${i}`).join(",") || ">BlankLine"}`, "", "PageTextLo", `        dc.b ${pages.map((_, i) => `<Page${i}Text`).join(",") || "0"}`, "PageTextHi", `        dc.b ${pages.map((_, i) => `>Page${i}Text`).join(",") || "0"}`, "", "; LOOK, NORTH, EAST, SOUTH, WEST, NEXT", "PageActions"];
    for (const [room, scene] of pages) {
      const targets = { look: room.entry_scene, next: scene.next };
      for (const direction of MOVEMENTS) { const roomId = Object.prototype.hasOwnProperty.call(scene.exit_overrides, direction) ? scene.exit_overrides[direction] : room.exits[direction]; targets[direction] = roomId ? rooms.get(roomId).entry_scene : null; }
      lines.push(`        dc.b ${ACTIONS.map((action) => targets[action] ? encodedScene(targets[action]) : "NO_EXIT").join(",")} ; ${room.id} / ${scene.id}`);
    }
    if (!pages.length) lines.push("        dc.b NO_EXIT ; bank intentionally empty");
    lines.push("", "; Logical room location for every physical scene page.", "PageRoomLocations", `        dc.b ${pages.length ? pages.map(([room]) => encodedScene(room.entry_scene)).join(",") : "$FF"}`);
    const variantLabels = pages.map(([room, scene], index) => scene.id === room.entry_scene && room.variants.length ? `Page${index}Variants` : "NoVariants");
    lines.push("", "; Ordered conditional descriptions for each destination entry page.", "PageVariantLo", `        dc.b ${variantLabels.map((label) => `<${label}`).join(",") || "<NoVariants"}`, "PageVariantHi", `        dc.b ${variantLabels.map((label) => `>${label}`).join(",") || ">NoVariants"}`, "NoVariants", "        dc.b $FE");
    pages.forEach(([room], index) => { if (variantLabels[index] === "NoVariants") return; lines.push("", `Page${index}Variants`); for (const rule of room.variants) { const conditions = [...rule.when_all.map((id) => hex(flagIndexes.get(id))), ...rule.when_clear.map((id) => hex(0x80 | flagIndexes.get(id)))]; lines.push(`        dc.b ${[...conditions, "$FF", encodedScene(rule.scene)].join(",")}`); } lines.push("        dc.b $FE"); });
    const effectLines = [];
    pages.forEach(([, scene], page) => ACTIONS.forEach((action, actionIndex) => { const effect = scene.effects[action]; if (!effect) return; const operations = FLAG_EFFECTS.flatMap((operation, operationIndex) => effect[operation].map((id) => hex(operationIndex * 0x40 | flagIndexes.get(id)))); effectLines.push(`        dc.b ${page},${actionIndex},${operations.join(",")},$FF ; ${scene.id} ${action}`); }));
    lines.push("", "; page, action, encoded flag operations, $FF; table ends with $FE", "PageEffects", ...effectLines, "        dc.b $FE");
    const contexts = pages.map(([, scene], index) => scene.context_actions.length ? `Page${index}Context` : "NoContext");
    lines.push("", "; Per-page contextual actions: label pointer, requirements, effects.", "PageContextLo", `        dc.b ${contexts.map((label) => `<${label}`).join(",") || "<NoContext"}`, "PageContextHi", `        dc.b ${contexts.map((label) => `>${label}`).join(",") || ">NoContext"}`, "NoContext", "        dc.b 0");
    pages.forEach(([, scene], page) => { if (!scene.context_actions.length) return; lines.push("", `Page${page}Context`, `        dc.b ${scene.context_actions.length}`); scene.context_actions.forEach((action, actionIndex) => { const requirements = [...action.when_all.map((id) => hex(flagIndexes.get(id))), ...action.when_clear.map((id) => hex(0x80 | flagIndexes.get(id)))]; const objectRequirements = []; if (action.requires_carried) objectRequirements.push(hex(objectIndexes.get(action.requires_carried))); if (action.requires_here) objectRequirements.push(hex(0x40 | objectIndexes.get(action.requires_here))); const operations = FLAG_EFFECTS.flatMap((operation, operationIndex) => action.effects[operation].map((id) => hex(operationIndex * 0x40 | flagIndexes.get(id)))); const objectOperations = []; if (action.effects.take_object) objectOperations.push(hex(objectIndexes.get(action.effects.take_object))); if (action.effects.remove_object) objectOperations.push(hex(0x40 | objectIndexes.get(action.effects.remove_object))); lines.push(`        dc.w ContextLabel${page}_${actionIndex}`, `        dc.b ${[...requirements, "$FF"].join(",")}`, `        dc.b ${[...objectRequirements, "$FF"].join(",")}`, `        dc.b ${[...operations, "$FF"].join(",")}`, `        dc.b ${[...objectOperations, "$FF"].join(",")}`); }); });
    pages.forEach(([room, scene], index) => { lines.push(""); if (index % 2 === 0) lines.push("        align $100"); lines.push(`; ${room.id} / ${scene.id} - ${scene.name}`, `Page${index}Text`, ...scene.text.map((row) => `        dc.b "${row.padEnd(ROW_WIDTH).replaceAll(" ", "[")}"`)); });
    lines.push(""); return lines.join("\n");
  }

  function contextLabels(project, bank) {
    const lines = [`; GENERATED contextual labels and object names for BANK ${bank}`, "        align $100"];
    const actions = bankScenes(project, bank).flatMap(([, scene], page) => scene.context_actions.map((action, index) => [page, index, action]));
    if (actions.length > 8) fail(`Bank ${bank} has more than 8 contextual actions`);
    if (actions.length + project.objects.length > 18) fail(`Bank ${bank} contextual labels plus object names exceed the stable label page`);
    actions.forEach(([page, index, action]) => lines.push(`ContextLabel${page}_${index} dc.b "${action.label.padEnd(ROW_WIDTH).replaceAll(" ", "[")}"`));
    project.objects.forEach((object, index) => lines.push(`ObjectName${index} dc.b "${object.name.padEnd(ROW_WIDTH).replaceAll(" ", "[")}"`)); lines.push(""); return lines.join("\n");
  }

  function f4Layout(project) {
    const pages = records(project); const locations = new Map(); const indexes = new Map();
    pages.forEach(([, scene], globalIndex) => { const bank = STORY_BANKS[Math.floor(globalIndex / MAX_PAGES_PER_BANK)]; const page = globalIndex % MAX_PAGES_PER_BANK; locations.set(scene.id, [bank, page]); indexes.set(scene.id, globalIndex); });
    return { pages, locations, indexes };
  }

  const encodedF4 = (locations, id) => { const [bank, page] = locations.get(id); return `BANK_${bank}|${page}`; };

  function generateF4Bank(project, bank) {
    const pages = bankScenes(project, bank);
    return [`; GENERATED renderer metadata - F4 BANK ${bank}`, `OBJECT_COUNT equ ${project.objects.length}`,
      "ObjectNameLo", `        dc.b ${project.objects.map((_, i) => `<ObjectName${i}`).join(",") || "<BlankLine"}`,
      "ObjectNameHi", `        dc.b ${project.objects.map((_, i) => `>ObjectName${i}`).join(",") || ">BlankLine"}`,
      "PageTextLo", `        dc.b ${pages.map((_, i) => `<Page${i}Text`).join(",") || "0"}`,
      "PageTextHi", `        dc.b ${pages.map((_, i) => `>Page${i}Text`).join(",") || "0"}`, ""].join("\n");
  }

  function generateF4Text(project, bank) {
    const lines = [`; GENERATED text records - F4 BANK ${bank}`, "        org $F700"];
    const pages = bankScenes(project, bank);
    pages.forEach(([room, scene], index) => { if (index % 2 === 0) lines.push("        align $100"); lines.push(`; ${room.id} / ${scene.id} - ${scene.name}`, `Page${index}Text`, ...scene.text.map((row) => `        dc.b "${row.padEnd(ROW_WIDTH).replaceAll(" ", "[")}"`)); });
    const presets = new Map(project.appearance_presets.map((preset) => [preset.id, preset.appearance]));
    const effective = pages.map(([room, scene]) => ({ ...project.appearance, ...(presets.get(room.appearance_preset) || {}), ...room.appearance_overrides, ...(presets.get(scene.appearance_preset) || {}), ...scene.appearance_overrides }));
    while (effective.length < MAX_PAGES_PER_BANK) effective.push(project.appearance);
    const emit = (label, values) => {
      lines.push(label);
      for (let offset = 0; offset < values.length; offset += 16) lines.push(`        dc.b ${values.slice(offset, offset + 16).join(",")}`);
    };
    lines.push("", "; Six bytes per scene; 17 scenes occupy $FF78-$FFDD.", "        org $FF78");
    emit("SceneBackgroundColors", effective.map((item) => hex(item.background_color)));
    emit("SceneBorderColors", effective.map((item) => hex(item.border_color)));
    emit("SceneTextColors", effective.map((item) => hex(item.text_color)));
    emit("SceneActionTextColors", effective.map((item) => hex(item.action_text_color)));
    emit("SceneActionBackgroundColors", effective.map((item) => hex(item.action_background_enabled ? item.action_background_color : item.background_color)));
    emit("SceneBorderStyles", effective.map((item, index) => hex(BORDER_STYLES[item.border_style] | (pages[index]?.[1].ending ? 0x80 : 0))));
    lines.push(""); return lines.join("\n");
  }

  function f4RendererLabels(project, bank) {
    return [`; GENERATED renderer strings - F4 BANK ${bank}`, "        align $100", ...project.objects.map((object, index) => `ObjectName${index} dc.b "${object.name.padEnd(ROW_WIDTH).replaceAll(" ", "[")}"`), ""].join("\n");
  }

  function generateF4Logic(project) {
    const { pages, locations, indexes } = f4Layout(project); const rooms = new Map(project.rooms.map((room) => [room.id, room]));
    const flagIndexes = new Map(project.flags.map((flag, index) => [flag.id, index])); const objectIndexes = new Map(project.objects.map((object, index) => [object.id, index]));
    const startId = rooms.get(project.start_room).entry_scene; const [startBank, startPage] = locations.get(startId);
    const masks = Array(8).fill(0); project.flags.forEach((flag, index) => { if (flag.initial) masks[Math.floor(index / 8)] |= 1 << (index & 7); });
    const objectLocations = project.objects.map((object) => object.initial_location === "carried" ? "$FE" : object.initial_location === "removed" ? "$FF" : encodedF4(locations, rooms.get(object.initial_location).entry_scene));
    const lines = ["; GENERATED global story logic for 32K F4 bank 1", "        org $F500", `START_BANK equ ${startBank}`, `START_PAGE equ ${startPage}`, `START_SCENE equ ${indexes.get(startId)}`, "InitialFlags", `        dc.b ${masks.map(hex).join(",")}`, `OBJECT_COUNT equ ${project.objects.length}`, "InitialObjectLocations", `        dc.b ${objectLocations.join(",") || "$FF"}`, "StoryBankOffsets", "        dc.b 0,0,0,17,34,51,68,85"];
    const emitTable = (label, values) => { lines.push(label); for (let offset = 0; offset < values.length; offset += 16) lines.push(`        dc.b ${values.slice(offset, offset + 16).join(",")}`); };
    const columns = ACTIONS.map(() => []);
    pages.forEach(([room, scene]) => { const targets = { look: room.entry_scene, next: scene.next }; for (const direction of MOVEMENTS) { const roomId = Object.hasOwn(scene.exit_overrides, direction) ? scene.exit_overrides[direction] : room.exits[direction]; targets[direction] = roomId ? rooms.get(roomId).entry_scene : null; } ACTIONS.forEach((action, index) => columns[index].push(targets[action] ? encodedF4(locations, targets[action]) : "NO_EXIT")); });
    ACTIONS.forEach((action, index) => emitTable(`PageAction${action[0].toUpperCase()}${action.slice(1)}`, columns[index]));
    lines.push(
      "ActionTableLo",
      `        dc.b ${ACTIONS.map((a) => `<PageAction${a[0].toUpperCase()}${a.slice(1)}`).join(",")}`,
      "ActionTableHi",
      `        dc.b ${ACTIONS.map((a) => `>PageAction${a[0].toUpperCase()}${a.slice(1)}`).join(",")}`,
    );
    emitTable("PageRoomLocations", pages.map(([room]) => encodedF4(locations, room.entry_scene)));
    emitTable("PageEndings", pages.map(([, scene]) => scene.ending ? "1" : "0"));
    const variants = pages.map(([room, scene], index) => scene.id === room.entry_scene && room.variants.length ? `Scene${index}Variants` : "NoVariants");
    emitTable("PageVariantLo", variants.map((v) => `<${v}`)); emitTable("PageVariantHi", variants.map((v) => `>${v}`)); lines.push("NoVariants", "        dc.b $FE");
    pages.forEach(([room], index) => { if (variants[index] === "NoVariants") return; lines.push(`Scene${index}Variants`); room.variants.forEach((rule) => lines.push(`        dc.b ${[...rule.when_all.map((id) => hex(flagIndexes.get(id))), ...rule.when_clear.map((id) => hex(0x80 | flagIndexes.get(id))), "$FF", encodedF4(locations, rule.scene)].join(",")}`)); lines.push("        dc.b $FE"); });
    const effects = []; pages.forEach(([, scene], sceneIndex) => ACTIONS.forEach((action, actionIndex) => { const effect = scene.effects[action]; if (!effect) return; const operations = FLAG_EFFECTS.flatMap((operation, operationIndex) => effect[operation].map((id) => hex(operationIndex * 0x40 | flagIndexes.get(id)))); effects.push(`        dc.b ${sceneIndex},${actionIndex},${operations.join(",")},$FF`); }));
    lines.push("PageEffects", ...effects, "        dc.b $FE");
    const contextLabels = []; const contextPages = pages.map(([, scene], index) => scene.context_actions.length ? `Scene${index}Context` : "NoContext");
    emitTable("PageContextLo", contextPages.map((v) => `<${v}`)); emitTable("PageContextHi", contextPages.map((v) => `>${v}`)); lines.push("NoContext", "        dc.b 0");
    pages.forEach(([, scene], sceneIndex) => { if (!scene.context_actions.length) return; lines.push(`Scene${sceneIndex}Context`, `        dc.b ${scene.context_actions.length}`); scene.context_actions.forEach((action, actionIndex) => { const requirements = [...action.when_all.map((id) => hex(flagIndexes.get(id))), ...action.when_clear.map((id) => hex(0x80 | flagIndexes.get(id)))]; const objectRequirements = []; if (action.requires_carried) objectRequirements.push(hex(objectIndexes.get(action.requires_carried))); if (action.requires_here) objectRequirements.push(hex(0x40 | objectIndexes.get(action.requires_here))); const operations = FLAG_EFFECTS.flatMap((operation, operationIndex) => action.effects[operation].map((id) => hex(operationIndex * 0x40 | flagIndexes.get(id)))); const objectOperations = []; if (action.effects.take_object) objectOperations.push(hex(objectIndexes.get(action.effects.take_object))); if (action.effects.remove_object) objectOperations.push(hex(0x40 | objectIndexes.get(action.effects.remove_object))); lines.push(`        dc.w ContextLabel${sceneIndex}_${actionIndex}`, `        dc.b ${[...requirements, "$FF"].join(",")}`, `        dc.b ${[...objectRequirements, "$FF"].join(",")}`, `        dc.b ${[...operations, "$FF"].join(",")}`, `        dc.b ${[...objectOperations, "$FF"].join(",")}`); contextLabels.push([sceneIndex, actionIndex, action]); }); });
    contextLabels.forEach(([scene, index, action]) => lines.push(`ContextLabel${scene}_${index} dc.b "${action.label.padEnd(ROW_WIDTH).replaceAll(" ", "[")}"`));
    lines.push(""); return lines.join("\n");
  }

  function generateSources(input) {
    const project = validateProject(input); const generated = new Map();
    for (const bank of BANKS) { generated.set(`src/data/bank${bank}_story.inc`, generateF4Bank(project, bank)); generated.set(`src/data/bank${bank}_context_labels.inc`, f4RendererLabels(project, bank)); }
    for (const bank of STORY_BANKS) generated.set(`src/data/bank${bank}_text.inc`, generateF4Text(project, bank));
    generated.set("src/data/logic_story.inc", generateF4Logic(project));
    const startRoom = project.rooms.find((room) => room.id === project.start_room); const startScene = startRoom.scenes.find((scene) => scene.id === startRoom.entry_scene);
    generated.set("src/data/splash_config.inc", [`; GENERATED in browser`, `SPLASH_ENABLED     equ ${project.splash.enabled ? 1 : 0}`, `SPLASH_DELAY_FRAMES equ ${project.splash.delay_frames}`, `SPLASH_START_BANK  equ ${startScene.bank}`, `SPLASH_BACKGROUND_COLOR equ ${hex(project.splash.background_color)}`, `GAME_BACKGROUND_COLOR equ ${hex(project.appearance.background_color)}`, `GAME_BORDER_COLOR equ ${hex(project.appearance.border_color)}`, `GAME_TEXT_COLOR equ ${hex(project.appearance.text_color)}`, `GAME_ACTION_TEXT_COLOR equ ${hex(project.appearance.action_text_color)}`, `GAME_ACTION_BACKGROUND_ENABLED equ ${project.appearance.action_background_enabled ? 1 : 0}`, `GAME_ACTION_BACKGROUND_COLOR equ ${hex(project.appearance.action_background_color)}`, `GAME_BORDER_STYLE equ ${BORDER_STYLES[project.appearance.border_style]}`, ""].join("\n"));
    const art = ["; GENERATED splash art in browser"];
    if (project.splash.source.trim()) { const parsed = parseSplash(project.splash.source); art.push(`SPLASH_PLAYFIELD_LINES equ ${parsed.line_count}`, `SPLASH_LINE_HEIGHT     equ ${parsed.line_height}`, "SPLASH_PADDING_LINES   equ 1", "SPLASH_REMAINING_LINES equ 192-SPLASH_PLAYFIELD_LINES*SPLASH_LINE_HEIGHT-SPLASH_PADDING_LINES-2"); for (const table of SPLASH_TABLES) { art.push("", "        align $100", `Splash${table}`); for (let offset = 0; offset < parsed.tables[table].length; offset += 12) art.push(`        dc.b ${parsed.tables[table].slice(offset, offset + 12).map(hex).join(",")}`); } } else { art.push("SPLASH_PLAYFIELD_LINES equ 1", "SPLASH_LINE_HEIGHT equ 2", "SPLASH_PADDING_LINES equ 1", "SPLASH_REMAINING_LINES equ 187"); for (const table of SPLASH_TABLES) art.push("", `Splash${table}`, "        dc.b $00"); }
    art.push(""); generated.set("src/data/splash_art.inc", art.join("\n"));
    return { project, generated };
  }

  root.TextAdventureStoryCompiler = { validateProject, generateSources, parseSplash };
})(globalThis);
