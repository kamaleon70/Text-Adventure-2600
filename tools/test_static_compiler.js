"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

const root = process.cwd();
eval(fs.readFileSync(path.join(root, "editor", "story_compiler.js"), "utf8"));
const project = JSON.parse(fs.readFileSync(path.join(root, "editor", "project.json"), "utf8"));
let { generated } = globalThis.TextAdventureStoryCompiler.generateSources(project);

function normalized(value) { return value.replaceAll("\\", "/").split("/").reduce((parts, part) => { if (!part || part === ".") return parts; if (part === "..") parts.pop(); else parts.push(part); return parts; }, []).join("/"); }
function expand(filename, stack = []) {
  const name = normalized(filename);
  if (stack.includes(name)) throw new Error(`recursive include: ${[...stack, name].join(" -> ")}`);
  const source = generated.get(name) ?? fs.readFileSync(path.join(root, ...name.split("/")), "utf8");
  return source.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*include\s+"([^"]+)"\s*(?:;.*)?$/i);
    if (!match) return line;
    return expand(normalized(`${path.posix.dirname(name)}/${match[1].replaceAll("\\", "/")}`), [...stack, name]);
  }).join("\n");
}

if (generated.size !== 25) throw new Error(`expected 25 generated files, got ${generated.size}`);
const dasm = process.env.DASM || "C:\\Projects\\atari\\utilities\\dasm\\dasm.exe";
if (fs.existsSync(dasm)) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "text-adventure-static-"));
  try {
    for (let bank = 0; bank < 8; bank += 1) {
      const sourcePath = path.join(temporary, `bank${bank}.asm`);
      const binaryPath = path.join(temporary, `bank${bank}.bin`);
      fs.writeFileSync(sourcePath, expand(`src/bank${bank}.asm`));
      const result = childProcess.spawnSync(dasm, [sourcePath, "-f3", "-v0", `-o${binaryPath}`], { encoding: "utf8" });
      if (result.status !== 0) throw new Error(`bank ${bank} failed\n${result.stdout}\n${result.stderr}`);
      if (fs.statSync(binaryPath).size !== 4096) throw new Error(`bank ${bank} is not 4096 bytes`);
    }
    for (const borderStyle of ["striped", "solid"]) {
      project.appearance.border_style = borderStyle;
      project.appearance.action_background_enabled = true;
      project.appearance.background_color = 0x02;
      project.appearance.border_color = 0x46;
      project.appearance.text_color = 0x0e;
      project.appearance.action_text_color = 0x1e;
      project.appearance.action_background_color = 0x84;
      project.rooms[0].scenes[0].appearance_overrides = {
        background_color: 0x22,
        text_color: 0x3e,
        action_background_enabled: true,
        action_background_color: 0x66,
        border_style: borderStyle === "solid" ? "striped" : "solid",
      };
      ({ generated } = globalThis.TextAdventureStoryCompiler.generateSources(project));
      const storyTables = generated.get("src/data/bank2_text.inc");
      if (!storyTables.includes("SceneBackgroundColors\n        dc.b $22")) throw new Error("scene background override was not generated");
      if (!storyTables.includes("SceneActionBackgroundColors\n        dc.b $66")) throw new Error("scene action-background override was not generated");
      const sourcePath = path.join(temporary, `${borderStyle}.asm`);
      const binaryPath = path.join(temporary, `${borderStyle}.bin`);
      fs.writeFileSync(sourcePath, expand("src/bank2.asm"));
      const result = childProcess.spawnSync(dasm, [sourcePath, "-f3", "-v0", `-o${binaryPath}`], { encoding: "utf8" });
      if (result.status !== 0) throw new Error(`${borderStyle} appearance failed\n${result.stdout}\n${result.stderr}`);
      if (fs.statSync(binaryPath).size !== 4096) throw new Error(`${borderStyle} appearance is not 4096 bytes`);
    }
    const capacityProject = {
      version: 2, title: "102 scene capacity", start_room: "room_0", flags: [], objects: [],
      appearance: { background_color: 0x82, border_color: 0x84, text_color: 0x0e, action_text_color: 0x0e, action_background_enabled: false, action_background_color: 0x24, border_style: "striped" },
      splash: { enabled: false, filename: "", source: "", delay_frames: 120, background_color: 0, metadata: null },
      rooms: Array.from({ length: 102 }, (_, index) => ({
        id: `room_${index}`, name: `Room ${index}`, position: { x: 20, y: 20 }, entry_scene: `scene_${index}`,
        exits: { north: null, east: index === 16 ? "room_17" : null, south: null, west: null }, variants: [],
        scenes: [{ id: `scene_${index}`, name: `Scene ${index}`, text: Array(10).fill(""), next: null, exit_overrides: {}, ending: index === 101, effects: {}, context_actions: [] }],
      })),
    };
    ({ generated } = globalThis.TextAdventureStoryCompiler.generateSources(capacityProject));
    if (!generated.get("src/data/logic_story.inc").includes("PageEndings")) throw new Error("ending-scene logic table was not generated");
    if (!generated.get("src/data/bank7_text.inc").includes("$80")) throw new Error("ending-scene renderer marker was not generated");
    for (let bank = 0; bank < 8; bank += 1) {
      const sourcePath = path.join(temporary, `capacity-bank${bank}.asm`);
      const binaryPath = path.join(temporary, `capacity-bank${bank}.bin`);
      fs.writeFileSync(sourcePath, expand(`src/bank${bank}.asm`));
      const result = childProcess.spawnSync(dasm, [sourcePath, "-f3", "-v3", `-o${binaryPath}`], { encoding: "utf8" });
      if (result.status !== 0) throw new Error(`102-scene bank ${bank} failed (status ${result.status})\n${result.stdout}\n${result.stderr}\n${result.error || ""}`);
      if (fs.statSync(binaryPath).size !== 4096) throw new Error(`102-scene bank ${bank} is not 4096 bytes`);
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
console.log("Static compiler assembled all F4 banks, both appearance modes, and the full 102-scene layout.");
