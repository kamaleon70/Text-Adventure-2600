const ACTIONS = ["look", "north", "east", "south", "west", "next"];
const MOVEMENTS = ["north", "east", "south", "west"];
const ACTION_LABELS = { look: "LOOK", north: "NORTH", east: "EAST", south: "SOUTH", west: "WEST", next: "NEXT" };
const BANK_COUNT = 8;
const BANKS = Array.from({ length: BANK_COUNT }, (_, bank) => bank);
const STORY_BANKS = [2, 3, 4, 5, 6, 7];
const MAX_PAGES_PER_BANK = 17;
const CHARACTERS_PER_PAGE = 120;
const WORLD_MIN_WIDTH = 1200;
const WORLD_MIN_HEIGHT = 720;
const WORLD_NODE_WIDTH = 164;
const WORLD_NODE_HEIGHT = 76;
const WORLD_PADDING = 180;
const APPEARANCE_DEFAULTS = { background_color: 0x82, border_color: 0x84, text_color: 0x0E, action_text_color: 0x0E, action_background_enabled: false, action_background_color: 0x24, border_style: "striped" };
const SCENE_APPEARANCE_LABELS = { background_color: "Text background", border_color: "Border colour", text_color: "Story text", action_text_color: "Action-row text", border_style: "Side-panel style", action_background_enabled: "Action background", action_background_color: "Action background colour" };
const ATARI_HUE_NAMES = ["Gray", "Gold", "Orange", "Red-orange", "Red", "Rose", "Purple", "Violet", "Blue", "Blue", "Cyan", "Turquoise", "Green", "Yellow-green", "Olive", "Yellow"];
const AUTOSAVE_KEY = "tinyTextAdventure.project.autosave.v1";
const STATIC_MODE = window.TINY_TEXT_STATIC === true || new URLSearchParams(window.location.search).get("static") === "1";
let autosaveTimer = null;
let worldResizeFrame = 0;
let worldResizeObserver = null;
const state = {
  data: null,
  project: null,
  token: null,
  selectedScene: null,
  playScene: null,
  playAction: "look",
  playFlags: {},
  playObjects: {},
  playInventory: false,
  variantRoom: null,
  effectScene: null,
  effectAction: "next",
  contextScene: null,
  dirty: false,
  pollTimer: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function roomById(id) {
  return state.project.rooms.find((room) => room.id === id) || null;
}

function sceneRecord(id) {
  for (const room of state.project.rooms) {
    const scene = room.scenes.find((candidate) => candidate.id === id);
    if (scene) return { room, scene };
  }
  return null;
}

function allSceneRecords() {
  return state.project.rooms.flatMap((room) => room.scenes.map((scene) => ({ room, scene })));
}

function sceneById(id) {
  return sceneRecord(id)?.scene || null;
}

function scenesInBank(bank) {
  return allSceneRecords().filter(({ scene }) => scene.bank === bank);
}

function splashEnabled() { return Boolean(state.project?.splash?.enabled); }
function storyBanks() { return STORY_BANKS; }
function sceneCapacity() { return storyBanks().length * MAX_PAGES_PER_BANK; }
function appearanceSettings() {
  state.project.appearance = { ...APPEARANCE_DEFAULTS, ...(state.project.appearance || {}) };
  return state.project.appearance;
}
function sceneAppearance(scene) {
  scene.appearance_overrides ||= {};
  return { ...appearanceSettings(), ...scene.appearance_overrides };
}

function assignBanks() {
  allSceneRecords().forEach(({ scene }, index) => { scene.bank = STORY_BANKS[0] + Math.floor(index / MAX_PAGES_PER_BANK); });
}

function textBudget(bank) {
  const pages = scenesInBank(bank);
  const authored = pages.reduce((total, { scene }) => total + scene.text.reduce((sum, row) => sum + row.trimEnd().length, 0), 0);
  return {
    pages: pages.length,
    authored,
    available: (MAX_PAGES_PER_BANK - pages.length) * CHARACTERS_PER_PAGE,
  };
}

function effectiveExit(room, scene, direction) {
  return Object.prototype.hasOwnProperty.call(scene.exit_overrides, direction)
    ? scene.exit_overrides[direction]
    : room.exits[direction];
}

function actionTarget(sceneId, action) {
  const record = sceneRecord(sceneId);
  if (!record) return null;
  const { room, scene } = record;
  if (action === "look") return resolvedRoomScene(room);
  if (action === "next") return scene.next;
  const targetRoomId = effectiveExit(room, scene, action);
  const targetRoom = targetRoomId ? roomById(targetRoomId) : null;
  return targetRoom ? resolvedRoomScene(targetRoom) : null;
}

function initialPlayFlags() {
  return Object.fromEntries((state.project.flags || []).map((flag) => [flag.id, flag.initial]));
}

function initialPlayObjects() {
  return Object.fromEntries((state.project.objects || []).map((record) => [record.id, record.initial_location]));
}

function resetPlaytest() {
  state.playFlags = initialPlayFlags();
  state.playObjects = initialPlayObjects();
  state.playInventory = false;
  state.playScene = resolvedRoomScene(roomById(state.project.start_room));
  state.playAction = "look";
  renderPlaytest();
}

function resolvedRoomScene(room) {
  for (const variant of room.variants || []) {
    if (variant.when_all.every((flag) => Boolean(state.playFlags[flag])) && variant.when_clear.every((flag) => !state.playFlags[flag])) return variant.scene;
  }
  return room.entry_scene;
}

function applyPlayEffects(scene, action) {
  const effect = scene.effects?.[action];
  applyFlagEffect(effect);
}

function applyFlagEffect(effect) {
  if (!effect) return;
  effect.set.forEach((flag) => { state.playFlags[flag] = true; });
  effect.clear.forEach((flag) => { state.playFlags[flag] = false; });
  effect.toggle.forEach((flag) => { state.playFlags[flag] = !state.playFlags[flag]; });
}

function markDirty() {
  state.dirty = true;
  const badge = $("#save-state");
  badge.textContent = "Unsaved changes";
  badge.className = "badge dirty";
  updateBuildAvailability();
  scheduleBrowserAutosave();
}

function markSaved() {
  state.dirty = false;
  const badge = $("#save-state");
  badge.textContent = "Saved";
  badge.className = "badge saved";
  updateBuildAvailability();
  saveBrowserDraft();
}

function browserSavePayload() {
  return { app: "Tiny Text Adventure Workshop", saveVersion: 1, savedAt: new Date().toISOString(), project: state.project };
}

function saveBrowserDraft() {
  if (!state.project) return;
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(browserSavePayload())); }
  catch (error) { console.warn("Could not save the browser draft", error); }
}

function scheduleBrowserAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveBrowserDraft, 500);
}

function cachedProject() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || "null");
    const rawProject = parsed?.project || parsed;
    const project = window.TextAdventureStoryCompiler?.validateProject(rawProject) || rawProject;
    return project && Array.isArray(project.rooms) && project.rooms.length ? project : null;
  } catch (error) {
    console.warn("Could not restore the browser draft", error);
    return null;
  }
}

function downloadBlob(contents, type, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}

function downloadProjectJson() {
  downloadBlob(JSON.stringify(browserSavePayload(), null, 2), "application/json", "tiny-text-adventure.json");
  if (STATIC_MODE) markSaved();
}

async function loadProjectJson(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const input = parsed?.project || parsed;
    if (!input || !Array.isArray(input.rooms) || !input.rooms.length) throw new Error("This file does not contain a Tiny Text Adventure project.");
    const project = window.TextAdventureStoryCompiler.validateProject(input);
    state.project = structuredClone(project);
    state.selectedScene = project.rooms[0].entry_scene;
    state.playScene = roomById(project.start_room)?.entry_scene || state.selectedScene;
    state.playFlags = initialPlayFlags(); state.playObjects = initialPlayObjects(); state.playInventory = false;
    markDirty(); renderAll();
  } catch (error) { alert(`Could not load project JSON.\n\n${error.message}`); }
}

function showTab(name) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  $$(".panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
  const content = $("main");
  if (content) content.scrollTop = 0;
  if (name === "world") renderWorld();
  if (name === "page") renderPageEditor();
  if (name === "flags") renderFlags();
  if (name === "objects") renderObjects();
  if (name === "play") renderPlaytest();
  if (name === "appearance") renderAppearance();
  if (name === "splash") renderSplash();
  if (name === "build") renderBuild();
  if (name === "debug") renderDebug();
  if (name === "manual") showManualOverview();
}

function showManualOverview() {
  const overview = $(".manual-layout");
  const detail = $("#manual-detail");
  if (!overview || !detail) return;
  overview.classList.remove("hidden");
  detail.classList.add("hidden");
  const content = $("main");
  if (content) content.scrollTop = 0;
}

function openManualGuide(key) {
  const guide = window.TextAdventureManualGuides?.[key];
  if (!guide) return;
  $("#manual-detail-kicker").textContent = guide.kicker;
  $("#manual-detail-title").textContent = guide.title;
  $("#manual-detail-body").innerHTML = guide.html;
  $(".manual-layout").classList.add("hidden");
  $("#manual-detail").classList.remove("hidden");
  const content = $("main");
  if (content) content.scrollTop = 0;
}

function bindManualGuides() {
  $$(".manual-card[data-manual-guide]").forEach((card) => {
    const guide = window.TextAdventureManualGuides?.[card.dataset.manualGuide];
    if (!guide) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button ghost manual-detail-link";
    button.textContent = "Detailed guide →";
    button.addEventListener("click", () => openManualGuide(card.dataset.manualGuide));
    card.append(button);
  });
  $$(".manual-back").forEach((button) => button.addEventListener("click", showManualOverview));
}

function selectScene(id, openEditor = false) {
  if (!sceneById(id)) return;
  state.selectedScene = id;
  renderWorld();
  renderPageEditor();
  if (openEditor) showTab("page");
}

function renderWorldLinks() {
  const svg = $("#world-links");
  if (!state.project || !svg) return;
  const nodes = new Map([...$("#world-nodes").children].map((node) => [node.dataset.roomId, node]));
  const edges = new Map();
  for (const room of state.project.rooms) {
    for (const direction of MOVEMENTS) {
      const target = roomById(room.exits[direction]);
      if (!target || target.id === room.id) continue;
      const ids = [room.id, target.id].sort();
      const key = ids.join("\u0000");
      if (!edges.has(key)) edges.set(key, { first: roomById(ids[0]), second: roomById(ids[1]), actions: [] });
      const edge = edges.get(key);
      const label = ACTION_LABELS[direction];
      if (!edge.actions.includes(label)) edge.actions.push(label);
    }
  }
  const links = [];
  for (const edge of edges.values()) {
    const firstNode = nodes.get(edge.first.id);
    const secondNode = nodes.get(edge.second.id);
    if (!firstNode || !secondNode) continue;
    const x1 = firstNode.offsetLeft + firstNode.offsetWidth / 2;
    const y1 = firstNode.offsetTop + firstNode.offsetHeight / 2;
    const x2 = secondNode.offsetLeft + secondNode.offsetWidth / 2;
    const y2 = secondNode.offsetTop + secondNode.offsetHeight / 2;
    const curve = Math.max(30, Math.abs(x2 - x1) * .25);
    links.push(`<path class="world-link" d="M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}"/>`);
    links.push(`<text class="world-link-label" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 5}">${edge.actions.join("/")}</text>`);
  }
  svg.innerHTML = links.join("");
}

function resizeWorldSurface(extraX = 0, extraY = 0) {
  const canvas = $("#world-canvas");
  const surface = $("#world-surface");
  const svg = $("#world-links");
  if (!state.project || !canvas || !surface || !svg) return;
  const furthestX = state.project.rooms.reduce((maximum, room) => Math.max(maximum, room.position.x + WORLD_NODE_WIDTH), extraX);
  const furthestY = state.project.rooms.reduce((maximum, room) => Math.max(maximum, room.position.y + WORLD_NODE_HEIGHT), extraY);
  const width = Math.ceil(Math.max(WORLD_MIN_WIDTH, canvas.clientWidth, furthestX + WORLD_PADDING));
  const height = Math.ceil(Math.max(WORLD_MIN_HEIGHT, canvas.clientHeight, furthestY + WORLD_PADDING));
  surface.style.width = `${width}px`;
  surface.style.height = `${height}px`;
  // Without a viewBox, SVG user units remain CSS pixels. This keeps paths in
  // the same coordinate system as the absolutely positioned room cards when
  // browser zoom changes the available CSS viewport size.
  svg.removeAttribute("viewBox");
}

function scheduleWorldGeometryRefresh() {
  if (worldResizeFrame) return;
  worldResizeFrame = requestAnimationFrame(() => {
    worldResizeFrame = 0;
    if (!state.project || !$("[data-panel=\"world\"]").classList.contains("active")) return;
    resizeWorldSurface();
    renderWorldLinks();
  });
}

function renderWorld() {
  if (!state.project) return;
  const pages = allSceneRecords().length;
  const capacity = sceneCapacity();
  $("#world-space-summary").innerHTML = `<strong>${state.project.rooms.length} rooms · ${pages}/${capacity} scenes</strong><span>${((capacity - pages) * CHARACTERS_PER_PAGE).toLocaleString()} text characters available</span>`;
  const selectedRoom = sceneRecord(state.selectedScene)?.room;
  const nodes = $("#world-nodes");
  nodes.innerHTML = "";
  for (const room of state.project.rooms) {
    const node = document.createElement("button");
    node.type = "button";
    node.dataset.roomId = room.id;
    node.className = `world-node${room === selectedRoom ? " selected" : ""}${room.id === state.project.start_room ? " start" : ""}`;
    node.style.left = `${room.position.x}px`;
    node.style.top = `${room.position.y}px`;
    const marker = room.id === state.project.start_room ? "★ START" : `${room.scenes.length} PAGE${room.scenes.length === 1 ? "" : "S"}`;
    node.innerHTML = `<em>${marker}</em><strong>${escapeHtml(room.name)}</strong><span>${escapeHtml(room.id)}</span>`;
    node.addEventListener("dblclick", () => selectScene(room.entry_scene, true));
    node.addEventListener("click", () => selectScene(room.entry_scene));
    node.addEventListener("pointerdown", (event) => beginNodeDrag(event, node, room));
    nodes.appendChild(node);
  }
  resizeWorldSurface();
  renderWorldLinks();
}

function beginNodeDrag(event, node, room) {
  if (event.button !== 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const roomX = room.position.x;
  const roomY = room.position.y;
  const canvas = $("#world-canvas");
  const startScrollLeft = canvas.scrollLeft;
  const startScrollTop = canvas.scrollTop;
  let moved = false;
  let linkFrame = 0;
  node.classList.add("dragging");
  node.setPointerCapture(event.pointerId);
  const move = (moveEvent) => {
    const bounds = canvas.getBoundingClientRect();
    if (moveEvent.clientX > bounds.right - 36) canvas.scrollLeft += 24;
    else if (moveEvent.clientX < bounds.left + 36) canvas.scrollLeft -= 24;
    if (moveEvent.clientY > bounds.bottom - 36) canvas.scrollTop += 24;
    else if (moveEvent.clientY < bounds.top + 36) canvas.scrollTop -= 24;
    const dx = moveEvent.clientX - startX + canvas.scrollLeft - startScrollLeft;
    const dy = moveEvent.clientY - startY + canvas.scrollTop - startScrollTop;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    room.position.x = Math.max(20, Math.round(roomX + dx));
    room.position.y = Math.max(20, Math.round(roomY + dy));
    node.style.left = `${room.position.x}px`;
    node.style.top = `${room.position.y}px`;
    resizeWorldSurface(room.position.x + WORLD_NODE_WIDTH, room.position.y + WORLD_NODE_HEIGHT);
    if (!linkFrame) linkFrame = requestAnimationFrame(() => { linkFrame = 0; renderWorldLinks(); });
  };
  const finish = () => {
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerup", finish);
    node.removeEventListener("pointercancel", finish);
    node.classList.remove("dragging");
    if (linkFrame) cancelAnimationFrame(linkFrame);
    if (moved) { markDirty(); renderWorld(); }
  };
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", finish);
  node.addEventListener("pointercancel", finish);
}

function renderPageList() {
  const list = $("#page-list");
  list.innerHTML = state.project.rooms.map((room) => `
    <section class="room-group">
      <header><strong>${escapeHtml(room.name)}</strong><small>${room.id === state.project.start_room ? "★ START" : `${room.scenes.length} scene${room.scenes.length === 1 ? "" : "s"}`}</small></header>
      <div class="room-scenes">${room.scenes.map((scene, index) => `
        <button type="button" data-scene="${escapeHtml(scene.id)}" class="${scene.id === state.selectedScene ? "active" : ""}">
          <b>${scene.id === room.entry_scene ? "P" : index + 1}</b><span>${escapeHtml(scene.name)}</span>
        </button>`).join("")}</div>
    </section>`).join("");
  list.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => selectScene(button.dataset.scene)));
}

function roomOptions(selected = "") {
  return `<option value="">No destination</option>` + state.project.rooms.map((room) =>
    `<option value="${escapeHtml(room.id)}"${room.id === selected ? " selected" : ""}>${escapeHtml(room.name)}</option>`
  ).join("");
}

function continuationHasCycle(room, startId) {
  const nextById = new Map(room.scenes.map((scene) => [scene.id, scene.next]));
  const seen = new Set();
  let current = startId;
  while (current && !seen.has(current)) {
    seen.add(current);
    current = nextById.get(current);
  }
  return Boolean(current);
}

function renderPageEditor() {
  if (!state.project) return;
  renderPageList();
  const record = sceneRecord(state.selectedScene);
  $("#page-empty").classList.toggle("hidden", Boolean(record));
  $("#page-form").classList.toggle("hidden", !record);
  if (!record) return;
  const { room, scene } = record;

  $("#page-heading").textContent = `${room.name} · ${scene.name}`;
  $("#room-id").value = room.id;
  $("#room-name").value = room.name;
  $("#room-x").value = room.position.x;
  $("#room-y").value = room.position.y;
  $("#scene-id").value = scene.id;
  $("#scene-name").value = scene.name;
  $("#scene-role").value = scene.id === room.entry_scene ? "Primary room scene" : "Continuation scene";
  $("#scene-ending").checked = Boolean(scene.ending);
  $("#set-start").disabled = room.id === state.project.start_room;
  $("#set-start").textContent = room.id === state.project.start_room ? "Start room" : "Set start room";
  $("#set-entry").disabled = scene.id === room.entry_scene;
  $("#set-entry").textContent = scene.id === room.entry_scene ? "Primary scene" : "Make primary";
  $("#delete-scene").disabled = room.scenes.length === 1;
  $("#delete-room").disabled = state.project.rooms.length === 1 || room.id === state.project.start_room;

  const exits = $("#room-exits");
  exits.innerHTML = MOVEMENTS.map((direction) => `<label>${ACTION_LABELS[direction]} exit<select data-room-exit="${direction}">${roomOptions(room.exits[direction] || "")}</select></label>`).join("");
  exits.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => {
    room.exits[select.dataset.roomExit] = select.value || null;
    markDirty(); renderWorld(); renderPlaytest();
  }));

  const authored = scene.text.reduce((total, row) => total + row.trimEnd().length, 0);
  $("#page-text-budget").textContent = `${authored} authored · 120 allocated`;
  const rows = $("#text-rows");
  rows.innerHTML = scene.text.map((line, index) => `
    <label class="text-row"><span>${index + 1}</span><input data-row="${index}" maxlength="12" value="${escapeHtml(line)}"><em>${line.length}/12</em></label>`).join("");
  rows.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => {
    const clean = input.value.toUpperCase().replace(/[^ )*+,\-./0-9:;<=>?@A-Z]/g, "").slice(0, 12);
    input.value = clean;
    scene.text[Number(input.dataset.row)] = clean;
    input.parentElement.querySelector("em").textContent = `${clean.length}/12`;
    const count = scene.text.reduce((total, row) => total + row.trimEnd().length, 0);
    $("#page-text-budget").textContent = `${count} authored · 120 allocated`;
    markDirty();
  }));
  $("#editor-action-row").textContent = scene.ending ? "FIRE:RESTART" : "ACT: LOOK";
  $("#scene-ending").onchange = (event) => {
    scene.ending = event.target.checked;
    markDirty(); renderPageEditor(); renderPlaytest();
  };
  renderSceneAppearance(scene);

  const nextOptions = `<option value="">End continuation</option>` + room.scenes.map((candidate) =>
    `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)}</option>`
  ).join("");
  const links = $("#scene-links");
  const overrideRows = MOVEMENTS.map((direction) => {
    const inherited = room.exits[direction] ? roomById(room.exits[direction])?.name || room.exits[direction] : "no exit";
    const options = `<option value="__inherit__">Same as room: ${escapeHtml(inherited)}</option><option value="">Override: no exit</option>` + state.project.rooms.map((candidate) => `<option value="${escapeHtml(candidate.id)}">Override: ${escapeHtml(candidate.name)}</option>`).join("");
    return `<label class="action-link"><strong>${ACTION_LABELS[direction]}</strong><select data-override="${direction}">${options}</select></label>`;
  }).join("");
  const hasOverrides = Object.keys(scene.exit_overrides).length > 0;
  links.innerHTML = `<label class="action-link"><strong>NEXT</strong><select data-next>${nextOptions}</select></label><details class="movement-overrides"${hasOverrides ? " open" : ""}><summary>Optional movement overrides${hasOverrides ? " · active" : ""}</summary><div>${overrideRows}</div></details>`;
  const nextSelect = links.querySelector("[data-next]");
  nextSelect.value = scene.next || "";
  nextSelect.addEventListener("change", () => { scene.next = nextSelect.value || null; markDirty(); renderPageEditor(); renderPlaytest(); });
  links.querySelectorAll("[data-override]").forEach((select) => {
    const direction = select.dataset.override;
    select.value = Object.prototype.hasOwnProperty.call(scene.exit_overrides, direction)
      ? scene.exit_overrides[direction] || ""
      : "__inherit__";
    select.addEventListener("change", () => {
      if (select.value === "__inherit__") delete scene.exit_overrides[direction];
      else scene.exit_overrides[direction] = select.value || null;
      markDirty(); renderPlaytest();
    });
  });
  const warning = $("#continuation-warning");
  const cycle = continuationHasCycle(room, scene.id);
  warning.classList.toggle("hidden", !cycle);
  warning.textContent = cycle ? "Warning: this NEXT chain forms a loop and cannot reach an ending page." : "";

  const index = room.scenes.indexOf(scene);
  $("#move-up").disabled = index === 0;
  $("#move-down").disabled = index === room.scenes.length - 1;
}

function moveSelected(direction) {
  const record = sceneRecord(state.selectedScene);
  if (!record) return;
  const { room, scene } = record;
  const index = room.scenes.indexOf(scene);
  const other = index + direction;
  if (other < 0 || other >= room.scenes.length) return;
  [room.scenes[index], room.scenes[other]] = [room.scenes[other], room.scenes[index]];
  assignBanks(); markDirty(); renderAll();
}

function uniqueRoomId() {
  let number = state.project.rooms.length + 1;
  let id = `room_${number}`;
  while (roomById(id)) id = `room_${++number}`;
  return id;
}

function uniqueSceneId(prefix) {
  let number = 1;
  let id = prefix;
  while (sceneById(id)) id = `${prefix}_${++number}`;
  return id;
}

function nextRoomPosition() {
  const canvasWidth = $("#world-canvas")?.clientWidth || WORLD_MIN_WIDTH;
  const columns = Math.max(4, Math.floor((Math.max(WORLD_MIN_WIDTH, canvasWidth) - 120) / 240));
  for (let slot = 0; ; slot += 1) {
    const position = { x: 80 + (slot % columns) * 240, y: 80 + Math.floor(slot / columns) * 130 };
    const occupied = state.project.rooms.some((room) => Math.abs(room.position.x - position.x) < 190 && Math.abs(room.position.y - position.y) < 100);
    if (!occupied) return position;
  }
}

function addRoom() {
  if (allSceneRecords().length >= sceneCapacity()) {
    alert("The cartridge has no space for another scene."); return;
  }
  const id = uniqueRoomId();
  const count = state.project.rooms.length;
  const sceneId = uniqueSceneId(id);
  state.project.rooms.push({
    id, name: `New Room ${count + 1}`,
    position: nextRoomPosition(),
    entry_scene: sceneId,
    exits: { north: null, east: null, south: null, west: null },
    scenes: [{ id: sceneId, name: "Main description", bank: 0, text: Array(10).fill(""), next: null, exit_overrides: {}, ending: false, appearance_overrides: {}, effects: {}, context_actions: [] }],
    variants: [],
  });
  assignBanks(); state.selectedScene = sceneId; markDirty(); renderAll(); showTab("page");
}

function addScene() {
  const record = sceneRecord(state.selectedScene);
  if (!record || allSceneRecords().length >= sceneCapacity()) {
    alert("The cartridge has no space for another scene."); return;
  }
  const { room } = record;
  const id = uniqueSceneId(`${room.id}_page`);
  room.scenes.push({ id, name: `Continuation ${room.scenes.length}`, bank: 0, text: Array(10).fill(""), next: null, exit_overrides: {}, ending: false, appearance_overrides: {}, effects: {}, context_actions: [] });
  assignBanks(); state.selectedScene = id; markDirty(); renderAll();
}

function deleteSelectedScene() {
  const record = sceneRecord(state.selectedScene);
  if (!record) return;
  const { room, scene } = record;
  if (room.scenes.length === 1) { alert("A room must keep at least one scene."); return; }
  if (!confirm(`Delete scene “${scene.name}”? Incoming NEXT links will be cleared.`)) return;
  room.scenes = room.scenes.filter((candidate) => candidate !== scene);
  if (room.entry_scene === scene.id) room.entry_scene = room.scenes[0].id;
  room.variants = (room.variants || []).filter((variant) => variant.scene !== scene.id);
  for (const candidate of room.scenes) if (candidate.next === scene.id) candidate.next = null;
  if (state.playScene === scene.id) state.playScene = room.entry_scene;
  state.selectedScene = room.entry_scene;
  assignBanks(); markDirty(); renderAll();
}

function deleteSelectedRoom() {
  const record = sceneRecord(state.selectedScene);
  if (!record) return;
  const { room } = record;
  if (state.project.rooms.length === 1 || room.id === state.project.start_room) {
    alert("Choose another start room before deleting this room."); return;
  }
  if (!confirm(`Delete room “${room.name}” and all ${room.scenes.length} of its scenes?`)) return;
  const removedScenes = new Set(room.scenes.map((scene) => scene.id));
  state.project.rooms = state.project.rooms.filter((candidate) => candidate !== room);
  for (const candidate of state.project.rooms) {
    for (const direction of MOVEMENTS) if (candidate.exits[direction] === room.id) candidate.exits[direction] = null;
    for (const scene of candidate.scenes) {
      for (const direction of MOVEMENTS) if (scene.exit_overrides[direction] === room.id) scene.exit_overrides[direction] = null;
    }
  }
  const first = state.project.rooms[0];
  for (const object of state.project.objects || []) if (object.initial_location === room.id) object.initial_location = first.id;
  if (state.variantRoom === room.id) state.variantRoom = first.id;
  state.selectedScene = first.entry_scene;
  if (removedScenes.has(state.playScene)) state.playScene = roomById(state.project.start_room).entry_scene;
  assignBanks(); markDirty(); renderAll();
}

function renameRoom(newId) {
  const record = sceneRecord(state.selectedScene);
  if (!record) return;
  const room = record.room;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newId)) { alert("Room IDs must start with a letter or underscore and contain only letters, numbers, and underscores."); renderPageEditor(); return; }
  if (newId !== room.id && roomById(newId)) { alert(`Room ID “${newId}” is already used.`); renderPageEditor(); return; }
  const oldId = room.id;
  room.id = newId;
  if (state.project.start_room === oldId) state.project.start_room = newId;
  for (const candidate of state.project.rooms) {
    for (const direction of MOVEMENTS) if (candidate.exits[direction] === oldId) candidate.exits[direction] = newId;
    for (const scene of candidate.scenes) {
      for (const direction of MOVEMENTS) if (scene.exit_overrides[direction] === oldId) scene.exit_overrides[direction] = newId;
    }
  }
  for (const object of state.project.objects || []) if (object.initial_location === oldId) object.initial_location = newId;
  markDirty(); renderAll();
}

function renameScene(newId) {
  const record = sceneRecord(state.selectedScene);
  if (!record) return;
  const { room, scene } = record;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newId)) { alert("Scene IDs must start with a letter or underscore and contain only letters, numbers, and underscores."); renderPageEditor(); return; }
  if (newId !== scene.id && sceneById(newId)) { alert(`Scene ID “${newId}” is already used.`); renderPageEditor(); return; }
  const oldId = scene.id;
  scene.id = newId;
  for (const candidateRoom of state.project.rooms) {
    if (candidateRoom.entry_scene === oldId) candidateRoom.entry_scene = newId;
    for (const variant of candidateRoom.variants || []) if (variant.scene === oldId) variant.scene = newId;
    for (const candidate of candidateRoom.scenes) if (candidate.next === oldId) candidate.next = newId;
  }
  if (state.playScene === oldId) state.playScene = newId;
  state.selectedScene = newId;
  markDirty(); renderAll();
}

function flagOptions(selected = []) {
  const chosen = new Set(selected);
  return (state.project.flags || []).map((flag) => `<option value="${escapeHtml(flag.id)}"${chosen.has(flag.id) ? " selected" : ""}>${escapeHtml(flag.id)}</option>`).join("");
}

function selectedValues(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function objectOptions(selected, includeEmpty = true) {
  const empty = includeEmpty ? `<option value=""${selected ? "" : " selected"}>None</option>` : "";
  return empty + (state.project.objects || []).map((record) => `<option value="${escapeHtml(record.id)}"${record.id === selected ? " selected" : ""}>${escapeHtml(record.name)} (${escapeHtml(record.id)})</option>`).join("");
}

function objectLocationOptions(selected) {
  const special = [["carried", "Carried initially"], ["removed", "Removed initially"]];
  return state.project.rooms.map((room) => `<option value="${escapeHtml(room.id)}"${room.id === selected ? " selected" : ""}>Room: ${escapeHtml(room.name)}</option>`).join("")
    + special.map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join("");
}

function objectIsUsed(id) {
  return state.project.rooms.some((room) => room.scenes.some((scene) => (scene.context_actions || []).some((action) =>
    action.requires_carried === id || action.requires_here === id || action.effects.take_object === id || action.effects.remove_object === id)));
}

function renameObject(oldId, newId) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newId)) { alert("Object IDs must start with a letter or underscore."); renderObjects(); return; }
  if (newId !== oldId && state.project.objects.some((record) => record.id === newId)) { alert("That object ID is already used."); renderObjects(); return; }
  const record = state.project.objects.find((candidate) => candidate.id === oldId);
  record.id = newId;
  for (const room of state.project.rooms) for (const scene of room.scenes) for (const action of scene.context_actions || []) {
    if (action.requires_carried === oldId) action.requires_carried = newId;
    if (action.requires_here === oldId) action.requires_here = newId;
    if (action.effects.take_object === oldId) action.effects.take_object = newId;
    if (action.effects.remove_object === oldId) action.effects.remove_object = newId;
  }
  if (Object.prototype.hasOwnProperty.call(state.playObjects, oldId)) { state.playObjects[newId] = state.playObjects[oldId]; delete state.playObjects[oldId]; }
  markDirty(); renderObjects(); renderFlags(); renderPlaytest();
}

function renderObjects() {
  if (!state.project) return;
  state.project.objects ||= [];
  $("#object-ram").textContent = `${state.project.objects.length} / 8 RAM bytes`;
  $("#object-list").innerHTML = state.project.objects.length ? state.project.objects.map((record, index) => `
    <div class="object-row" data-index="${index}"><label>Object ID<input class="object-id" value="${escapeHtml(record.id)}" maxlength="32"></label><label>Inventory name<input class="object-name" value="${escapeHtml(record.name)}" maxlength="12"></label><label>Initial location<select class="object-location">${objectLocationOptions(record.initial_location)}</select></label><button class="button danger object-delete" type="button">Delete</button></div>`).join("") : '<p class="help">No objects yet. Add one to create a portable item.</p>';
  $$(".object-row").forEach((row) => {
    const record = state.project.objects[Number(row.dataset.index)];
    row.querySelector(".object-id").addEventListener("change", (event) => renameObject(record.id, event.target.value.trim()));
    row.querySelector(".object-name").addEventListener("change", (event) => { record.name = event.target.value.trim().toUpperCase(); markDirty(); renderObjects(); renderPlaytest(); });
    row.querySelector(".object-location").addEventListener("change", (event) => { record.initial_location = event.target.value; state.playObjects[record.id] = event.target.value; markDirty(); renderPlaytest(); });
    row.querySelector(".object-delete").addEventListener("click", () => {
      if (objectIsUsed(record.id)) { alert(`Remove all contextual-action uses of ${record.id} before deleting it.`); return; }
      state.project.objects.splice(Number(row.dataset.index), 1); delete state.playObjects[record.id]; markDirty(); renderObjects(); renderFlags(); renderPlaytest();
    });
  });
}

function flagIsUsed(id) {
  for (const room of state.project.rooms) {
    for (const variant of room.variants || []) if (variant.when_all.includes(id) || variant.when_clear.includes(id)) return true;
    for (const scene of room.scenes) for (const effect of Object.values(scene.effects || {})) {
      if ([...effect.set, ...effect.clear, ...effect.toggle].includes(id)) return true;
    }
    for (const scene of room.scenes) for (const action of scene.context_actions || []) {
      if ([...action.when_all, ...action.when_clear, ...action.effects.set, ...action.effects.clear, ...action.effects.toggle].includes(id)) return true;
    }
  }
  return false;
}

function renameFlag(oldId, newId) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newId)) { alert("Flag IDs must start with a letter or underscore."); renderFlags(); return; }
  if (newId !== oldId && state.project.flags.some((flag) => flag.id === newId)) { alert("That flag ID is already used."); renderFlags(); return; }
  const replace = (items) => items.map((id) => id === oldId ? newId : id);
  state.project.flags.find((flag) => flag.id === oldId).id = newId;
  for (const room of state.project.rooms) {
    for (const variant of room.variants || []) { variant.when_all = replace(variant.when_all); variant.when_clear = replace(variant.when_clear); }
    for (const scene of room.scenes) for (const effect of Object.values(scene.effects || {})) {
      effect.set = replace(effect.set); effect.clear = replace(effect.clear); effect.toggle = replace(effect.toggle);
    }
    for (const scene of room.scenes) for (const action of scene.context_actions || []) {
      action.when_all = replace(action.when_all); action.when_clear = replace(action.when_clear);
      action.effects.set = replace(action.effects.set); action.effects.clear = replace(action.effects.clear); action.effects.toggle = replace(action.effects.toggle);
    }
  }
  if (Object.prototype.hasOwnProperty.call(state.playFlags, oldId)) { state.playFlags[newId] = state.playFlags[oldId]; delete state.playFlags[oldId]; }
  markDirty(); renderFlags(); renderPlaytest();
}

function renderFlags() {
  if (!state.project) return;
  state.project.flags ||= [];
  state.project.rooms.forEach((room) => { room.variants ||= []; room.scenes.forEach((scene) => { scene.effects ||= {}; scene.context_actions ||= []; }); });
  if (!roomById(state.variantRoom)) state.variantRoom = state.project.rooms[0].id;
  if (!sceneById(state.effectScene)) state.effectScene = state.selectedScene || state.project.rooms[0].entry_scene;

  $("#flag-list").innerHTML = state.project.flags.length ? state.project.flags.map((flag, index) => `
    <div class="flag-row" data-index="${index}"><input class="flag-id" value="${escapeHtml(flag.id)}" maxlength="32"><label><input class="flag-initial" type="checkbox"${flag.initial ? " checked" : ""}> initially set</label><button class="button danger flag-delete" type="button">Delete</button></div>`).join("") : '<p class="help">No flags yet. Add one for a persistent story fact.</p>';
  $$(".flag-row").forEach((row) => {
    const index = Number(row.dataset.index); const flag = state.project.flags[index];
    row.querySelector(".flag-id").addEventListener("change", (event) => renameFlag(flag.id, event.target.value.trim()));
    row.querySelector(".flag-initial").addEventListener("change", (event) => { flag.initial = event.target.checked; state.playFlags[flag.id] = flag.initial; markDirty(); renderPlaytest(); });
    row.querySelector(".flag-delete").addEventListener("click", () => {
      if (flagIsUsed(flag.id)) { alert(`Remove all uses of ${flag.id} before deleting it.`); return; }
      state.project.flags.splice(index, 1); delete state.playFlags[flag.id]; markDirty(); renderFlags();
    });
  });

  $("#variant-room").innerHTML = state.project.rooms.map((room) => `<option value="${escapeHtml(room.id)}"${room.id === state.variantRoom ? " selected" : ""}>${escapeHtml(room.name)}</option>`).join("");
  const room = roomById(state.variantRoom);
  $("#variant-list").innerHTML = room.variants.length ? room.variants.map((variant, index) => `
    <div class="variant-row" data-index="${index}"><div class="variant-head"><strong>${index + 1}</strong><select class="variant-scene">${room.scenes.map((scene) => `<option value="${escapeHtml(scene.id)}"${scene.id === variant.scene ? " selected" : ""}>${escapeHtml(scene.name)}</option>`).join("")}</select><button class="button danger variant-delete" type="button">Delete</button></div><div class="variant-conditions"><label>Flags that must be set<select class="variant-set" multiple>${flagOptions(variant.when_all)}</select></label><label>Flags that must be clear<select class="variant-clear" multiple>${flagOptions(variant.when_clear)}</select></label></div></div>`).join("") : '<p class="help">No conditional descriptions. The room always uses its primary scene.</p>';
  $$(".variant-row").forEach((row) => {
    const index = Number(row.dataset.index); const variant = room.variants[index];
    row.querySelector(".variant-scene").addEventListener("change", (event) => { variant.scene = event.target.value; markDirty(); });
    row.querySelector(".variant-set").addEventListener("change", (event) => { variant.when_all = selectedValues(event.target); variant.when_clear = variant.when_clear.filter((flag) => !variant.when_all.includes(flag)); markDirty(); renderFlags(); });
    row.querySelector(".variant-clear").addEventListener("change", (event) => { variant.when_clear = selectedValues(event.target); variant.when_all = variant.when_all.filter((flag) => !variant.when_clear.includes(flag)); markDirty(); renderFlags(); });
    row.querySelector(".variant-delete").addEventListener("click", () => { room.variants.splice(index, 1); markDirty(); renderFlags(); });
  });

  const records = allSceneRecords();
  $("#effect-scene").innerHTML = records.map(({ room: owner, scene }) => `<option value="${escapeHtml(scene.id)}"${scene.id === state.effectScene ? " selected" : ""}>${escapeHtml(owner.name)} / ${escapeHtml(scene.name)}</option>`).join("");
  $("#effect-action").innerHTML = ACTIONS.map((action) => `<option value="${action}"${action === state.effectAction ? " selected" : ""}>${ACTION_LABELS[action]}</option>`).join("");
  const scene = sceneById(state.effectScene); const effect = scene.effects[state.effectAction] || { set: [], clear: [], toggle: [] };
  $("#effect-fields").innerHTML = ["set", "clear", "toggle"].map((operation) => `<label>${operation.toUpperCase()} flags<select multiple data-operation="${operation}">${flagOptions(effect[operation])}</select></label>`).join("");
  $$("#effect-fields select").forEach((select) => select.addEventListener("change", () => {
    const next = { set: [], clear: [], toggle: [] };
    $$("#effect-fields select").forEach((field) => { next[field.dataset.operation] = selectedValues(field); });
    const seen = new Set();
    for (const operation of ["set", "clear", "toggle"]) next[operation] = next[operation].filter((flag) => { if (seen.has(flag)) return false; seen.add(flag); return true; });
    scene.effects[state.effectAction] = next;
    if (![...next.set, ...next.clear, ...next.toggle].length) delete scene.effects[state.effectAction];
    markDirty(); renderFlags();
  }));

  if (!sceneById(state.contextScene)) state.contextScene = state.selectedScene || records[0].scene.id;
  $("#context-scene").innerHTML = records.map(({ room: owner, scene: candidate }) => `<option value="${escapeHtml(candidate.id)}"${candidate.id === state.contextScene ? " selected" : ""}>${escapeHtml(owner.name)} / ${escapeHtml(candidate.name)}</option>`).join("");
  const contextScene = sceneById(state.contextScene);
  $("#context-action-list").innerHTML = contextScene.context_actions.length ? contextScene.context_actions.map((action, index) => `
    <div class="context-action-row" data-index="${index}"><div class="context-action-head"><label>Cartridge label (12 characters)<input class="context-label" maxlength="12" value="${escapeHtml(action.label)}"></label><button class="button danger context-delete" type="button">Delete</button></div>
    <div class="context-action-fields"><label>Require set<select class="context-require-set" multiple>${flagOptions(action.when_all)}</select></label><label>Require clear<select class="context-require-clear" multiple>${flagOptions(action.when_clear)}</select></label><label>SET flags<select class="context-set" multiple>${flagOptions(action.effects.set)}</select></label><label>CLEAR flags<select class="context-clear" multiple>${flagOptions(action.effects.clear)}</select></label><label>TOGGLE flags<select class="context-toggle" multiple>${flagOptions(action.effects.toggle)}</select></label></div>
    <div class="context-object-fields"><label>Must be carried<select class="context-require-carried">${objectOptions(action.requires_carried)}</select></label><label>Must be here<select class="context-require-here">${objectOptions(action.requires_here)}</select></label><label>Take object<select class="context-take">${objectOptions(action.effects.take_object)}</select></label><label>Remove object<select class="context-remove">${objectOptions(action.effects.remove_object)}</select></label></div></div>`).join("") : '<p class="help">This scene has no contextual actions. LOOK, INVENTORY, and NEXT remain available automatically.</p>';
  $$(".context-action-row").forEach((row) => {
    const action = contextScene.context_actions[Number(row.dataset.index)];
    row.querySelector(".context-label").addEventListener("change", (event) => { action.label = event.target.value.trim().toUpperCase(); markDirty(); renderPlaytest(); });
    const update = () => {
      action.when_all = selectedValues(row.querySelector(".context-require-set"));
      action.when_clear = selectedValues(row.querySelector(".context-require-clear")).filter((flag) => !action.when_all.includes(flag));
      action.requires_carried = row.querySelector(".context-require-carried").value || null;
      action.requires_here = row.querySelector(".context-require-here").value || null;
      action.effects = { set: selectedValues(row.querySelector(".context-set")), clear: selectedValues(row.querySelector(".context-clear")), toggle: selectedValues(row.querySelector(".context-toggle")), take_object: row.querySelector(".context-take").value || null, remove_object: row.querySelector(".context-remove").value || null };
      const seen = new Set();
      for (const operation of ["set", "clear", "toggle"]) action.effects[operation] = action.effects[operation].filter((flag) => { if (seen.has(flag)) return false; seen.add(flag); return true; });
      markDirty(); renderFlags(); renderPlaytest();
    };
    row.querySelectorAll("select").forEach((select) => select.addEventListener("change", update));
    row.querySelector(".context-delete").addEventListener("click", () => { contextScene.context_actions.splice(Number(row.dataset.index), 1); markDirty(); renderFlags(); renderPlaytest(); });
  });
}

function renderPlaytest() {
  if (!state.project) return;
  applyPlaytestAppearance();
  let record = sceneRecord(state.playScene);
  if (!record) {
    const start = roomById(state.project.start_room);
    state.playScene = start.entry_scene;
    record = sceneRecord(state.playScene);
  }
  const { room, scene } = record;
  if (state.playInventory) {
    const carried = (state.project.objects || []).filter((object) => state.playObjects[object.id] === "carried").map((object) => object.name);
    const rows = [" INVENTORY", ...carried, ...Array(9).fill("")].slice(0, 10);
    $("#play-page-name").textContent = "Inventory";
    $("#play-text").innerHTML = rows.map((line) => `<div>${escapeHtml(line.padEnd(12, " "))}</div>`).join("");
    $("#play-action").textContent = "FIRE: RETURN";
    $("#play-actions").innerHTML = '<button type="button" id="play-inventory-return" class="available">RETURN</button>';
    $("#play-inventory-return").addEventListener("click", () => { state.playInventory = false; state.playAction = "look"; renderPlaytest(); });
    renderPlayDebug();
    return;
  }
  $("#play-page-name").textContent = `${room.name} · ${scene.name}`;
  $("#play-text").innerHTML = scene.text.map((line) => `<div>${escapeHtml(line.padEnd(12, " "))}</div>`).join("");
  if (scene.ending) {
    $("#play-action").textContent = "FIRE:RESTART";
    $("#play-actions").innerHTML = '<button type="button" id="play-ending-restart" class="available">RESTART</button>';
    $("#play-ending-restart").addEventListener("click", resetPlaytest);
    $("#play-result").textContent = "This is an ending scene. Restart begins a new game.";
    renderPlayDebug();
    return;
  }
  const selectedContext = typeof state.playAction === "string" && state.playAction.startsWith("context:")
    ? scene.context_actions?.[Number(state.playAction.split(":")[1])] : null;
  $("#play-action").textContent = (selectedContext?.label || `ACT: ${ACTION_LABELS[state.playAction] || "LOOK"}`).padEnd(12, " ");
  const controls = $("#play-actions");
  const builtIns = ACTIONS.map((action) => `<button type="button" data-action="${action}" class="${action === "look" || actionTarget(scene.id, action) ? "available" : ""}">${ACTION_LABELS[action]}</button>`).join("") + '<button type="button" data-inventory class="available">INVENTORY</button>';
  const contextual = (scene.context_actions || []).map((action, index) => {
    const flagsMatch = action.when_all.every((flag) => Boolean(state.playFlags[flag])) && action.when_clear.every((flag) => !state.playFlags[flag]);
    const carriedMatch = !action.requires_carried || state.playObjects[action.requires_carried] === "carried";
    const hereMatch = !action.requires_here || state.playObjects[action.requires_here] === room.id;
    const available = flagsMatch && carriedMatch && hereMatch;
    return `<button type="button" data-context="${index}"${available ? ' class="available"' : " disabled"}>${escapeHtml(action.label)}</button>`;
  }).join("");
  controls.innerHTML = builtIns + contextual;
  controls.querySelectorAll("button[data-action]").forEach((button) => button.addEventListener("click", () => performPlayAction(button.dataset.action)));
  controls.querySelectorAll("button[data-context]").forEach((button) => button.addEventListener("click", () => performContextAction(Number(button.dataset.context))));
  controls.querySelector("button[data-inventory]").addEventListener("click", () => { state.playInventory = true; renderPlaytest(); });
  renderPlayDebug();
}

function renderPlayDebug() {
  $("#play-flags").innerHTML = (state.project.flags || []).length ? state.project.flags.map((flag) => `<label><input type="checkbox" data-flag="${escapeHtml(flag.id)}"${state.playFlags[flag.id] ? " checked" : ""}>${escapeHtml(flag.id)}</label>`).join("") : '<span class="help">No flags defined.</span>';
  $$("#play-flags input").forEach((input) => input.addEventListener("change", () => {
    state.playFlags[input.dataset.flag] = input.checked;
    const current = sceneRecord(state.playScene);
    if (current) state.playScene = resolvedRoomScene(current.room);
    renderPlaytest();
  }));
  $("#play-objects").innerHTML = (state.project.objects || []).length ? state.project.objects.map((object) => `<label>${escapeHtml(object.name)}<select data-object="${escapeHtml(object.id)}">${objectLocationOptions(state.playObjects[object.id])}</select></label>`).join("") : '<span class="help">No objects defined.</span>';
  $$("#play-objects select").forEach((select) => select.addEventListener("change", () => { state.playObjects[select.dataset.object] = select.value; renderPlaytest(); }));
}

function performContextAction(index) {
  const record = sceneRecord(state.playScene);
  const action = record?.scene.context_actions?.[index];
  if (!action) return;
  applyFlagEffect(action.effects);
  if (action.effects.take_object) state.playObjects[action.effects.take_object] = "carried";
  if (action.effects.remove_object) state.playObjects[action.effects.remove_object] = "removed";
  state.playAction = `context:${index}`;
  state.playScene = resolvedRoomScene(record.room);
  $("#play-result").textContent = `${action.label} applied; room state resolved again.`;
  renderPlaytest();
}

function performPlayAction(action) {
  const record = sceneRecord(state.playScene);
  applyPlayEffects(record.scene, action);
  const targetId = actionTarget(state.playScene, action);
  state.playAction = action;
  if (targetId) {
    const target = sceneRecord(targetId);
    state.playScene = targetId;
    $("#play-result").textContent = `${ACTION_LABELS[action]} → ${target.room.name} · ${target.scene.name}`;
  } else {
    $("#play-result").textContent = `${ACTION_LABELS[action]} has no destination on this scene.`;
  }
  renderPlaytest();
}

function splashMetadata(source) {
  const read = (name) => Number(source.match(new RegExp(`^\\s*${name}\\s*=\\s*#?(\\d+)`, "mi"))?.[1]);
  const lineCount = read("playfield_lines");
  const lineHeight = read("playfield_line_height");
  const kernelLines = read("kernel_lines");
  return Number.isFinite(lineCount) && Number.isFinite(lineHeight) && Number.isFinite(kernelLines)
    ? { line_count: lineCount, line_height: lineHeight, kernel_lines: kernelLines }
    : null;
}

function parseSplashArtwork(source) {
  const metadata = splashMetadata(source);
  if (!metadata) return null;
  const names = ["PF0DataA", "PF1DataA", "PF2DataA", "PF0DataB", "PF1DataB", "PF2DataB", "PFColors"];
  const tables = {};
  for (const name of names) {
    const start = source.search(new RegExp(`^\\s*${name}\\s*:?\\s*$`, "mi"));
    if (start < 0) return null;
    const tail = source.slice(start).replace(/^.*(?:\r?\n|$)/, "");
    const next = tail.search(new RegExp(`^\\s*(?:${names.filter((candidate) => candidate !== name).join("|")}|ORG|SEG|END)\\b`, "mi"));
    const block = next < 0 ? tail : tail.slice(0, next);
    const values = [];
    for (const match of block.matchAll(/^\s*\.?(?:byte|dc\.b)\s+([^;\r\n]+)/gmi)) {
      for (const raw of match[1].split(",")) {
        const token = raw.trim();
        if (/^%[01]{8}$/.test(token)) values.push(parseInt(token.slice(1), 2));
        else if (/^\$[0-9a-f]{1,2}$/i.test(token)) values.push(parseInt(token.slice(1), 16));
        else if (/^\d{1,3}$/.test(token)) values.push(Number(token));
      }
    }
    if (values.length !== metadata.line_count) return null;
    tables[name] = values;
  }
  return { ...metadata, tables };
}

function atariNtscColour(value) {
  const code = Number(value) & 0xFE;
  const hueIndex = code >> 4;
  const luminance = (code & 0x0E) >> 1;
  if (hueIndex === 0) {
    const level = Math.round(luminance / 7 * 100);
    return `hsl(0 0% ${level}%)`;
  }
  const hues = [0, 52, 31, 18, 4, 330, 300, 274, 244, 220, 202, 180, 151, 116, 82, 58];
  return `hsl(${hues[hueIndex]} 72% ${8 + luminance * 11}%)`;
}

function atariColourOptions(selected) {
  return ATARI_HUE_NAMES.map((name, hue) => `<optgroup label="${name} · $${(hue << 4).toString(16).toUpperCase().padStart(2, "0")}">${Array.from({ length: 8 }, (_, luminance) => {
    const value = (hue << 4) | (luminance << 1);
    const code = value.toString(16).toUpperCase().padStart(2, "0");
    return `<option value="${value}"${value === selected ? " selected" : ""}>$${code} · brightness ${luminance}</option>`;
  }).join("")}</optgroup>`).join("");
}

function renderSceneAppearance(scene) {
  const container = $("#scene-appearance-fields");
  if (!container) return;
  const global = appearanceSettings();
  const overrides = scene.appearance_overrides ||= {};
  const effective = sceneAppearance(scene);
  const colourFields = ["background_color", "border_color", "text_color", "action_text_color", "action_background_color"];
  const code = (value) => `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
  const rows = [];
  for (const field of colourFields) {
    const custom = Object.prototype.hasOwnProperty.call(overrides, field);
    rows.push(`<div class="scene-appearance-row">
      <label class="scene-override-toggle"><input type="checkbox" data-scene-appearance-toggle="${field}"${custom ? " checked" : ""}> Custom ${SCENE_APPEARANCE_LABELS[field].toLowerCase()}</label>
      <span class="colour-control"><i style="background:${atariNtscColour(effective[field])}"></i><select data-scene-appearance="${field}"${custom ? "" : " disabled"}>${atariColourOptions(effective[field])}</select></span>
      <small>Global ${code(global[field])}</small>
    </div>`);
  }
  for (const field of ["border_style", "action_background_enabled"]) {
    const custom = Object.prototype.hasOwnProperty.call(overrides, field);
    const options = field === "border_style"
      ? `<option value="striped"${effective[field] === "striped" ? " selected" : ""}>Striped side panels</option><option value="solid"${effective[field] === "solid" ? " selected" : ""}>Solid side panels</option>`
      : `<option value="false"${!effective[field] ? " selected" : ""}>No coloured background</option><option value="true"${effective[field] ? " selected" : ""}>Use coloured background</option>`;
    const globalLabel = field === "border_style" ? global[field] : (global[field] ? "enabled" : "disabled");
    rows.push(`<div class="scene-appearance-row compact">
      <label class="scene-override-toggle"><input type="checkbox" data-scene-appearance-toggle="${field}"${custom ? " checked" : ""}> Custom ${SCENE_APPEARANCE_LABELS[field].toLowerCase()}</label>
      <select data-scene-appearance="${field}"${custom ? "" : " disabled"}>${options}</select>
      <small>Global ${escapeHtml(globalLabel)}</small>
    </div>`);
  }
  container.innerHTML = rows.join("");
  $("#scene-appearance-count").textContent = `${Object.keys(overrides).length} custom setting${Object.keys(overrides).length === 1 ? "" : "s"}`;
  $("#scene-appearance-reset").disabled = Object.keys(overrides).length === 0;

  container.querySelectorAll("[data-scene-appearance-toggle]").forEach((toggle) => toggle.addEventListener("change", () => {
    const field = toggle.dataset.sceneAppearanceToggle;
    if (toggle.checked) overrides[field] = global[field];
    else delete overrides[field];
    markDirty(); renderSceneAppearance(scene); renderPlaytest();
  }));
  container.querySelectorAll("[data-scene-appearance]").forEach((select) => select.addEventListener("change", () => {
    const field = select.dataset.sceneAppearance;
    overrides[field] = colourFields.includes(field) ? Number(select.value) : field === "action_background_enabled" ? select.value === "true" : select.value;
    markDirty(); renderSceneAppearance(scene); renderPlaytest();
  }));
  $("#scene-appearance-reset").onclick = () => {
    scene.appearance_overrides = {};
    markDirty(); renderSceneAppearance(scene); renderPlaytest();
  };
}

function renderAppearance() {
  if (!state.project) return;
  const appearance = appearanceSettings();
  const fields = {
    background_color: "#appearance-background",
    border_color: "#appearance-border",
    text_color: "#appearance-text",
    action_text_color: "#appearance-action-text",
    action_background_color: "#appearance-action-background",
  };
  for (const [field, selector] of Object.entries(fields)) {
    const select = $(selector);
    select.innerHTML = atariColourOptions(appearance[field]);
    const swatch = $(`[data-colour-swatch="${field}"]`);
    if (swatch) swatch.style.background = atariNtscColour(appearance[field]);
  }
  $("#appearance-border-style").value = appearance.border_style;
  $("#appearance-action-background-enabled").checked = appearance.action_background_enabled;
  $("#appearance-action-background").disabled = !appearance.action_background_enabled;
  $("#appearance-action-background-field").classList.toggle("disabled", !appearance.action_background_enabled);

  const background = atariNtscColour(appearance.background_color);
  const border = atariNtscColour(appearance.border_color);
  const preview = $("#appearance-preview");
  preview.style.background = background;
  preview.querySelector(".appearance-preview-body").style.background = background;
  preview.querySelector(".appearance-preview-text").style.color = atariNtscColour(appearance.text_color);
  const railBackground = appearance.border_style === "striped"
    ? `repeating-linear-gradient(90deg, ${border} 0 9px, ${background} 9px 18px)`
    : border;
  preview.querySelectorAll(".appearance-rail").forEach((rail) => { rail.style.background = railBackground; });
  const action = preview.querySelector(".appearance-preview-text strong");
  action.style.color = atariNtscColour(appearance.action_text_color);
  action.style.background = appearance.action_background_enabled ? atariNtscColour(appearance.action_background_color) : "transparent";
  const code = (value) => `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
  $("#appearance-code-summary").textContent = `BG ${code(appearance.background_color)} · BORDER ${code(appearance.border_color)} · TEXT ${code(appearance.text_color)}`;
}

function applyPlaytestAppearance() {
  const scene = sceneById(state.playScene);
  const appearance = scene ? sceneAppearance(scene) : appearanceSettings();
  const screen = $(".screen");
  if (!screen) return;
  const background = atariNtscColour(appearance.background_color);
  const border = atariNtscColour(appearance.border_color);
  screen.style.color = atariNtscColour(appearance.text_color);
  screen.style.background = `repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px), ${background}`;
  screen.style.border = "0 solid transparent";
  if (appearance.border_style === "solid") {
    screen.style.borderLeftWidth = "12px";
    screen.style.borderRightWidth = "12px";
    screen.style.borderColor = border;
  }
  const action = $("#play-action");
  action.style.color = atariNtscColour(appearance.action_text_color);
  action.style.background = appearance.action_background_enabled ? atariNtscColour(appearance.action_background_color) : "transparent";
  action.style.paddingLeft = appearance.action_background_enabled ? "10px" : "0";
  action.style.paddingRight = appearance.action_background_enabled ? "10px" : "0";
}

function renderSplashPreview() {
  const canvas = $("#splash-preview");
  const empty = $("#splash-preview-empty");
  const artwork = parseSplashArtwork(state.project.splash.source || "");
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  context.fillStyle = atariNtscColour(state.project.splash.background_color ?? 0);
  context.fillRect(0, 0, canvas.width, canvas.height);
  empty.classList.toggle("hidden", Boolean(artwork));
  if (!artwork) return;

  const t = artwork.tables;
  const bit = (value, position) => (value >> position) & 1;
  const pixelWidth = canvas.width / 40;
  const scanlineHeight = canvas.height / 192;
  for (let row = 0; row < artwork.line_count; row++) {
    const index = artwork.line_count - 1 - row;
    const pixels = [
      ...[4, 5, 6, 7].map((position) => bit(t.PF0DataA[index], position)),
      ...[7, 6, 5, 4, 3, 2, 1, 0].map((position) => bit(t.PF1DataA[index], position)),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((position) => bit(t.PF2DataA[index], position)),
      ...[7, 6, 5, 4, 3, 2, 1, 0].map((position) => bit(t.PF2DataB[index], position)),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((position) => bit(t.PF1DataB[index], position)),
      ...[7, 6, 5, 4].map((position) => bit(t.PF0DataB[index], position)),
    ];
    context.fillStyle = atariNtscColour(t.PFColors[index]);
    const y = (1 + row * artwork.line_height) * scanlineHeight;
    const height = artwork.line_height * scanlineHeight;
    pixels.forEach((on, x) => { if (on) context.fillRect(x * pixelWidth, y, pixelWidth, height); });
  }
}

function renderSplash() {
  if (!state.project) return;
  state.project.splash ||= { enabled: false, filename: "", source: "", delay_frames: 120, background_color: 0, metadata: null };
  const splash = state.project.splash;
  splash.background_color ??= 0;
  $("#splash-enabled").checked = splash.enabled;
  $("#splash-delay").value = splash.delay_frames;
  const metadata = splashMetadata(splash.source || "") || splash.metadata;
  $("#splash-detected").textContent = metadata ? `${metadata.line_count} rows × ${metadata.line_height} scanlines` : "No file loaded";
  $("#splash-file-status").textContent = splash.filename
    ? `${splash.filename} · ${new Blob([splash.source || ""]).size.toLocaleString()} bytes`
    : "Upload the ASM generated by the third-party playfield tool.";
  const remainingBanks = STORY_BANKS.length;
  $("#splash-impact").innerHTML = splash.enabled
    ? `<strong>Splash enabled.</strong> Bank 0 contains the artwork. Six story banks provide ${remainingBanks * MAX_PAGES_PER_BANK} scenes and ${(remainingBanks * MAX_PAGES_PER_BANK * CHARACTERS_PER_PAGE).toLocaleString()} text characters.`
    : `<strong>Splash disabled.</strong> Bank 0 performs an immediate boot. The six story banks still provide ${remainingBanks * MAX_PAGES_PER_BANK} scenes.`;
  renderSplashPreview();
}

function renderBuild() {
  if (!state.project) return;
  $("#project-title").textContent = state.project.title;
  const pages = allSceneRecords().length;
  const capacity = sceneCapacity();
  const maximumCharacters = capacity * CHARACTERS_PER_PAGE;
  const allocatedCharacters = pages * CHARACTERS_PER_PAGE;
  const authored = storyBanks().reduce((total, bank) => total + textBudget(bank).authored, 0);
  $("#project-metrics").innerHTML = `
    <div class="metric"><strong>${state.project.rooms.length}</strong><span>logical rooms · up to ${capacity}</span></div>
    <div class="metric"><strong>${pages}/${capacity}</strong><span>text scenes</span></div>
    <div class="metric"><strong>${state.project.flags.length}/64</strong><span>persistent flags</span></div>
    <div class="metric"><strong>${(state.project.objects || []).length}/8</strong><span>inventory objects</span></div>
    <div class="metric"><strong>${allocatedCharacters.toLocaleString()}/${maximumCharacters.toLocaleString()}</strong><span>characters used</span></div>
    <div class="metric"><strong>${authored.toLocaleString()}</strong><span>characters written</span></div>`;
  const rom = state.data.rom;
  $("#rom-meta").textContent = rom ? `${rom.path} · ${rom.size} bytes · ${rom.modified}` : "ROM has not been built yet.";
  updateBuildAvailability();
}

function renderDebug() {
  if (!state.project) return;
  $("#debug-banks").innerHTML = BANKS.map((bank) => {
    if (bank === 0) {
      const metadata = splashMetadata(state.project.splash.source || "") || state.project.splash.metadata;
      if (!state.project.splash.enabled) {
        return `<article class="card debug-bank"><div><p class="kicker">Physical bank 0</p><h3>Immediate startup</h3><small>Splash screen disabled</small></div><i><b style="width:100%"></b></i><ul><li>Boot handoff to shared game logic</li></ul></article>`;
      }
      return `<article class="card debug-bank"><div><p class="kicker">Physical bank 0</p><h3>Colour splash</h3><small>${metadata ? `${metadata.line_count} artwork rows × ${metadata.line_height} scanlines` : "Reserved artwork bank"}</small></div><i><b style="width:100%"></b></i><ul><li>Splash kernel and colour playfield data</li></ul></article>`;
    }
    if (bank === 1) {
      return `<article class="card debug-bank"><div><p class="kicker">Physical bank 1</p><h3>Game logic</h3><small>Shared by all story banks</small></div><i><b style="width:100%"></b></i><ul><li>Navigation, flags, objects, variants and contextual actions</li></ul></article>`;
    }
    const pages = scenesInBank(bank);
    const budget = textBudget(bank);
    const pageList = pages.length
      ? pages.map(({ room, scene }, index) => `<li><code>${index}</code>${escapeHtml(room.name)} / ${escapeHtml(scene.name)}${room.id === state.project.start_room && scene.id === room.entry_scene ? " <strong>START</strong>" : ""}</li>`).join("")
      : '<li class="empty">Unused</li>';
    return `<article class="card debug-bank"><div><p class="kicker">Physical bank ${bank}</p><h3>${pages.length} / ${MAX_PAGES_PER_BANK} scenes</h3><small>${budget.available.toLocaleString()} text characters free</small></div><i><b style="width:${pages.length / MAX_PAGES_PER_BANK * 100}%"></b></i><ul>${pageList}</ul></article>`;
  }).join("");
}

function updateBuildAvailability(running = false) {
  $$(".engine-action").forEach((button) => { button.disabled = state.dirty || running; });
  $$(".browser-build-action").forEach((button) => { button.disabled = running || (!STATIC_MODE && state.dirty); });
  const note = $("#build-note");
  if (note) note.textContent = running ? "A build action is running." : STATIC_MODE ? "The browser compiler builds the current editor contents." : state.dirty ? "Save the project before building." : "Build actions use the saved project.";
}

function renderJob(job) {
  const badge = $("#job-status");
  badge.textContent = job.status === "idle" ? "Idle" : job.status;
  badge.className = `badge ${job.status === "succeeded" ? "saved" : job.status}`;
  $("#job-output").textContent = job.log;
  const running = job.status === "running";
  updateBuildAvailability(running);
  clearTimeout(state.pollTimer);
  if (running) state.pollTimer = setTimeout(pollAction, 700);
  if (!running && job.id) loadProject(false, true);
}

async function pollAction() {
  try {
    const response = await fetch("/api/action", { headers: { "X-Text-Adventure-Editor": state.token }, cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not read build status");
    renderJob(payload.job);
  } catch (error) {
    $("#job-output").textContent += `\n${error.message}`;
    updateBuildAvailability(false);
  }
}

async function runAction(action) {
  if (state.dirty) { alert("Save the project before building."); return; }
  try {
    const response = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Text-Adventure-Editor": state.token },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not start build action");
    renderJob(payload.job);
  } catch (error) { alert(error.message); }
}

function renderAll() {
  assignBanks(); renderWorld(); renderPageEditor(); renderFlags(); renderObjects(); renderPlaytest(); renderAppearance(); renderSplash(); renderBuild(); renderDebug();
}

async function loadProject(confirmDiscard = false, preserveDraft = false) {
  if (confirmDiscard && state.dirty && !confirm("Discard unsaved changes and reload the saved project?")) return;
  try {
    let payload;
    if (STATIC_MODE) {
      const response = await fetch("project.json", { cache: "no-store" });
      const rawProject = await response.json();
      if (!response.ok) throw new Error("Could not load the starter project");
      const project = window.TextAdventureStoryCompiler.validateProject(rawProject);
      payload = { data: { project, rom: null }, editor_token: null };
    } else {
      const response = await fetch("/api/project", { cache: "no-store" });
      payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load project");
    }
    state.data = payload.data;
    state.token = payload.editor_token;
    if (!preserveDraft) {
      state.project = structuredClone(payload.data.project);
      const draft = confirmDiscard ? null : cachedProject();
      const restoredDraft = draft && JSON.stringify(draft) !== JSON.stringify(state.project);
      if (restoredDraft) state.project = structuredClone(draft);
      const firstRoom = state.project.rooms[0];
      if (!sceneById(state.selectedScene)) state.selectedScene = firstRoom.entry_scene;
      if (!sceneById(state.playScene)) state.playScene = roomById(state.project.start_room).entry_scene;
      state.playFlags = initialPlayFlags();
      state.playObjects = initialPlayObjects();
      state.playInventory = false;
      state.playScene = resolvedRoomScene(roomById(state.project.start_room));
      if (restoredDraft) {
        markDirty();
        const badge = $("#save-state"); badge.textContent = "Browser draft restored"; badge.className = "badge dirty";
      } else markSaved();
    } else state.data.rom = payload.data.rom;
    $("#loading").classList.add("hidden");
    $("#fatal").classList.add("hidden");
    $("#app").classList.remove("hidden");
    renderAll();
    if (!preserveDraft && !STATIC_MODE) pollAction();
  } catch (error) {
    $("#loading").classList.add("hidden");
    $("#fatal").textContent = error.message;
    $("#fatal").classList.remove("hidden");
  }
}

async function saveProject() {
  if (STATIC_MODE) { downloadProjectJson(); return; }
  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Text-Adventure-Editor": state.token },
      body: JSON.stringify(state.project),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not save project");
    state.data = payload.data;
    state.project = structuredClone(payload.data.project);
    state.token = payload.editor_token;
    markSaved(); renderAll();
  } catch (error) { alert(error.message); }
}

function bindStaticEvents() {
  bindManualGuides();
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
  window.addEventListener("resize", scheduleWorldGeometryRefresh);
  if ("ResizeObserver" in window) {
    worldResizeObserver = new ResizeObserver(scheduleWorldGeometryRefresh);
    worldResizeObserver.observe($("#world-canvas"));
  }
  $("#save").addEventListener("click", saveProject);
  $("#download-project").addEventListener("click", downloadProjectJson);
  $("#load-project").addEventListener("click", () => { $("#load-project-file").value = ""; $("#load-project-file").click(); });
  $("#load-project-file").addEventListener("change", (event) => loadProjectJson(event.target.files[0]));
  $("#reload").addEventListener("click", () => loadProject(true));
  $("#add-room").addEventListener("click", addRoom);
  $("#sidebar-add-room").addEventListener("click", addRoom);
  $("#add-scene").addEventListener("click", addScene);
  $("#delete-scene").addEventListener("click", deleteSelectedScene);
  $("#delete-room").addEventListener("click", deleteSelectedRoom);
  $("#set-start").addEventListener("click", () => {
    const record = sceneRecord(state.selectedScene);
    if (!record || record.room.id === state.project.start_room) return;
    state.project.start_room = record.room.id;
    state.playScene = record.room.entry_scene;
    markDirty(); renderAll();
  });
  $("#set-entry").addEventListener("click", () => {
    const record = sceneRecord(state.selectedScene);
    if (!record || record.scene.id === record.room.entry_scene) return;
    record.room.entry_scene = record.scene.id;
    markDirty(); renderAll();
  });
  $("#move-up").addEventListener("click", () => moveSelected(-1));
  $("#move-down").addEventListener("click", () => moveSelected(1));
  $("#play-reset").addEventListener("click", resetPlaytest);
  $$(".engine-action").forEach((button) => button.addEventListener("click", () => runAction(button.dataset.action)));
  $("#add-flag").addEventListener("click", () => {
    if (state.project.flags.length >= 64) { alert("The cartridge supports at most 64 flags."); return; }
    let number = state.project.flags.length + 1; let id = `FLAG_${number}`;
    while (state.project.flags.some((flag) => flag.id === id)) { number++; id = `FLAG_${number}`; }
    state.project.flags.push({ id, initial: false }); state.playFlags[id] = false; markDirty(); renderFlags();
  });
  $("#add-object").addEventListener("click", () => {
    state.project.objects ||= [];
    if (state.project.objects.length >= 8) { alert("The cartridge supports at most eight portable objects."); return; }
    let number = state.project.objects.length + 1; let id = `object_${number}`;
    while (state.project.objects.some((record) => record.id === id)) { number++; id = `object_${number}`; }
    const record = { id, name: `OBJECT ${number}`.slice(0, 12), initial_location: state.project.start_room };
    state.project.objects.push(record); state.playObjects[id] = record.initial_location; markDirty(); renderObjects(); renderFlags(); renderPlaytest();
  });
  const appearanceFields = {
    "#appearance-background": "background_color",
    "#appearance-border": "border_color",
    "#appearance-text": "text_color",
    "#appearance-action-text": "action_text_color",
    "#appearance-action-background": "action_background_color",
  };
  for (const [selector, field] of Object.entries(appearanceFields)) {
    $(selector).addEventListener("change", (event) => {
      appearanceSettings()[field] = Number(event.target.value);
      markDirty(); renderAppearance(); renderPageEditor(); renderPlaytest();
    });
  }
  $("#appearance-border-style").addEventListener("change", (event) => {
    appearanceSettings().border_style = event.target.value;
    markDirty(); renderAppearance(); renderPageEditor(); renderPlaytest();
  });
  $("#appearance-action-background-enabled").addEventListener("change", (event) => {
    appearanceSettings().action_background_enabled = event.target.checked;
    markDirty(); renderAppearance(); renderPageEditor(); renderPlaytest();
  });
  $("#variant-room").addEventListener("change", (event) => { state.variantRoom = event.target.value; renderFlags(); });
  $("#add-variant").addEventListener("click", () => {
    if (!state.project.flags.length) { alert("Add a named flag before creating a conditional variant."); return; }
    const room = roomById(state.variantRoom || state.project.rooms[0].id);
    room.variants.push({ scene: room.scenes[Math.min(1, room.scenes.length - 1)].id, when_all: [state.project.flags[0].id], when_clear: [] });
    markDirty(); renderFlags();
  });
  $("#effect-scene").addEventListener("change", (event) => { state.effectScene = event.target.value; renderFlags(); });
  $("#effect-action").addEventListener("change", (event) => { state.effectAction = event.target.value; renderFlags(); });
  $("#context-scene").addEventListener("change", (event) => { state.contextScene = event.target.value; renderFlags(); });
  $("#add-context-action").addEventListener("click", () => {
    const scene = sceneById(state.contextScene || state.selectedScene);
    if (!scene) return;
    if ((scene.context_actions || []).length >= 6) { alert("A scene supports at most six contextual actions."); return; }
    scene.context_actions ||= [];
    scene.context_actions.push({ label: "NEW ACTION", when_all: [], when_clear: [], requires_carried: null, requires_here: null, effects: { set: [], clear: [], toggle: [], take_object: null, remove_object: null } });
    markDirty(); renderFlags(); renderPlaytest();
  });
  $("#splash-enabled").addEventListener("change", (event) => {
    if (event.target.checked && !state.project.splash.source?.trim()) {
      event.target.checked = false;
      alert("Upload a compatible splash ASM file first.");
      return;
    }
    state.project.splash.enabled = event.target.checked;
    assignBanks();
    if (allSceneRecords().length > sceneCapacity()) {
      state.project.splash.enabled = false;
      event.target.checked = false;
      alert("The current story is too large to reserve one bank for a splash screen.");
      return;
    }
    markDirty(); renderAll();
  });
  $("#splash-delay").addEventListener("change", (event) => {
    state.project.splash.delay_frames = Math.max(0, Math.min(255, Number(event.target.value) || 0));
    markDirty(); renderSplash();
  });
  $("#splash-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 128 * 1024) { alert("Splash ASM must be no larger than 128 KB."); event.target.value = ""; return; }
    const source = await file.text();
    const metadata = splashMetadata(source);
    if (!metadata) { alert("This file does not contain the expected playfield constants."); event.target.value = ""; return; }
    if (allSceneRecords().length > STORY_BANKS.length * MAX_PAGES_PER_BANK) {
      alert("The current story is too large to reserve one bank for a splash screen.");
      event.target.value = "";
      return;
    }
    state.project.splash.filename = file.name;
    state.project.splash.source = source;
    state.project.splash.metadata = metadata;
    state.project.splash.background_color = 0;
    state.project.splash.enabled = true;
    assignBanks(); markDirty(); renderAll();
  });
  $("#splash-clear").addEventListener("click", () => {
    state.project.splash = { enabled: false, filename: "", source: "", delay_frames: 120, background_color: 0, metadata: null };
    $("#splash-file").value = "";
    assignBanks(); markDirty(); renderAll();
  });

  $("#room-id").addEventListener("change", (event) => renameRoom(event.target.value.trim()));
  $("#scene-id").addEventListener("change", (event) => renameScene(event.target.value.trim()));
  $("#room-name").addEventListener("input", (event) => {
    const record = sceneRecord(state.selectedScene); record.room.name = event.target.value.slice(0, 48); markDirty(); renderWorld(); renderPageList(); $("#page-heading").textContent = `${record.room.name} · ${record.scene.name}`;
  });
  $("#scene-name").addEventListener("input", (event) => {
    const record = sceneRecord(state.selectedScene); record.scene.name = event.target.value.slice(0, 48); markDirty(); renderPageList(); $("#page-heading").textContent = `${record.room.name} · ${record.scene.name}`;
  });
  for (const field of ["x", "y"]) {
    $(`#room-${field}`).addEventListener("change", (event) => {
      const room = sceneRecord(state.selectedScene).room;
      const value = Number(event.target.value);
      room.position[field] = Number.isFinite(value) ? Math.max(20, Math.round(value)) : 20;
      event.target.value = room.position[field];
      markDirty(); renderWorld();
    });
  }
  window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
}

window.TextAdventureEditor = {
  getToken: () => state.token,
  isDirty: () => state.dirty,
  isStatic: () => STATIC_MODE,
  getProject: () => structuredClone(state.project),
};

if (STATIC_MODE) {
  document.body.classList.add("static-editor");
  $("#download-project").textContent = "Save config";
}

bindStaticEvents();
loadProject();
