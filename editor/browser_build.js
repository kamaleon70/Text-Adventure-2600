(function () {
"use strict";

let dasmPromise = null;
let lastRom = null;

const $ = (selector) => document.querySelector(selector);

function setOutput(message, status = "running") {
  $("#job-output").textContent = message;
  const badge = $("#job-status");
  badge.textContent = status === "succeeded" ? "Succeeded" : status === "failed" ? "Failed" : "Building";
  badge.className = `badge ${status === "succeeded" ? "saved" : status}`;
}

function setButtonsDisabled(disabled) {
  const dirty = window.TextAdventureEditor?.isDirty?.() || false;
  document.querySelectorAll(".engine-action, .browser-build-action").forEach((button) => { button.disabled = disabled || dirty; });
}

async function loadDasm() {
  if (dasmPromise) return dasmPromise;
  dasmPromise = Promise.resolve().then(() => {
    setOutput("Starting the bundled dasmjs compiler ...");
    const dasm = window.TextAdventureDasm;
    if (typeof dasm !== "function") {
      dasmPromise = null;
      throw new Error("The bundled dasm.js script did not initialize.");
    }
    return dasm;
  });
  return dasmPromise;
}

function normalizeBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data);
  if (data && typeof data === "object") {
    const values = Object.values(data);
    if (values.length && values.every((value) => Number.isFinite(Number(value)))) return new Uint8Array(values);
  }
  return null;
}

function diagnosticText(result) {
  const fields = ["output", "stdout", "stderr", "error"];
  return fields.flatMap((field) => {
    const value = result?.[field];
    if (value == null || value === "") return [];
    return [`--- ${field} ---`, Array.isArray(value) ? value.join("\n") : String(value)];
  }).join("\n");
}

function compileFailed(result, bytes) {
  if (!bytes || bytes.length !== 4096) return true;
  const diagnostics = diagnosticText(result);
  if (/fatal assembly error|source is not resolvable|\berror:|assembly error|label mismatch|unknown mnemonic/i.test(diagnostics)) return true;
  if (Object.prototype.hasOwnProperty.call(result || {}, "success") && result.success === false && !/\bComplete\./i.test(String(result.output || ""))) return true;
  if (Object.prototype.hasOwnProperty.call(result || {}, "exitStatus") && Number(result.exitStatus) !== 0 && !/\bComplete\./i.test(String(result.output || ""))) return true;
  return false;
}

async function fetchSources() {
  if (window.TextAdventureEditor?.isStatic?.()) return buildStaticSources();
  const token = window.TextAdventureEditor?.getToken?.();
  if (!token) throw new Error("The editor session is not ready. Reload the page and try again.");
  const response = await fetch("/api/browser-sources", { headers: { "X-Text-Adventure-Editor": token }, cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not prepare browser assembly sources");
  if (!Array.isArray(payload.banks) || payload.banks.length !== 8) throw new Error("The server returned an invalid bank set");
  return payload.banks;
}

function normalizePath(path) {
  const output = [];
  for (const part of String(path).replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") output.pop(); else output.push(part);
  }
  return output.join("/");
}

function resolveInclude(path, includePath) {
  const base = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  return normalizePath(base + includePath);
}

async function buildStaticSources() {
  const compiler = window.TextAdventureStoryCompiler;
  if (!compiler) throw new Error("The browser story compiler did not load.");
  const { generated } = compiler.generateSources(window.TextAdventureEditor.getProject());
  const cache = new Map();
  const readSource = async (path) => {
    const normalized = normalizePath(path);
    if (generated.has(normalized)) return generated.get(normalized);
    const bundled = window.TextAdventureSourceFiles?.[normalized];
    if (typeof bundled === "string") return bundled;
    if (window.TextAdventureEditor?.isStatic?.()) {
      throw new Error(`Bundled assembly source is missing: ${normalized}`);
    }
    if (!cache.has(normalized)) {
      const sourceRoot = window.TEXT_ADVENTURE_2600_SOURCE_ROOT ?? "../";
      cache.set(normalized, fetch(`${sourceRoot}${normalized}`, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error(`Could not load source file: ${normalized}`);
        return response.text();
      }));
    }
    return cache.get(normalized);
  };
  const expand = async (path, stack = []) => {
    const normalized = normalizePath(path);
    if (stack.includes(normalized)) throw new Error(`Recursive assembly include: ${[...stack, normalized].join(" -> ")}`);
    const source = await readSource(normalized);
    const output = [`; browser include begin: ${normalized}`];
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*include\s+"([^"]+)"\s*(?:;.*)?$/i);
      output.push(match ? await expand(resolveInclude(normalized, match[1]), [...stack, normalized]) : line);
    }
    output.push(`; browser include end: ${normalized}`);
    return output.join("\n");
  };
  return Promise.all(Array.from({ length: 8 }, (_, bank) => expand(`src/bank${bank}.asm`)));
}

async function buildRom() {
  if (!window.TextAdventureEditor?.isStatic?.() && window.TextAdventureEditor?.isDirty?.()) throw new Error("Save the project before building.");
  setButtonsDisabled(true);
  try {
    setOutput("Preparing eight self-contained bank sources ...");
    const [sources, dasm] = await Promise.all([fetchSources(), loadDasm()]);
    const rom = new Uint8Array(32768);
    const logs = [];
    for (let bank = 0; bank < sources.length; bank += 1) {
      setOutput(`Compiling F4 bank ${bank + 1} of 8 with dasmjs ...`);
      const result = dasm(sources[bank], { format: 3, quick: false, machine: "atari2600" });
      const bytes = normalizeBytes(result?.data);
      const diagnostics = diagnosticText(result);
      if (diagnostics) logs.push(`BANK ${bank}\n${diagnostics}`);
      if (compileFailed(result, bytes)) {
        throw new Error(`Bank ${bank} did not produce a valid 4096-byte image.\n\n${diagnostics || "No DASM diagnostics were returned."}`);
      }
      rom.set(bytes, bank * 4096);
    }
    lastRom = rom;
    setOutput(`Browser build succeeded.\n\n8 banks × 4096 bytes = ${rom.length} bytes\nCartridge format: F4${logs.length ? `\n\n${logs.join("\n\n")}` : ""}`, "succeeded");
    return rom;
  } finally { setButtonsDisabled(false); }
}

function downloadRom(rom) {
  const url = URL.createObjectURL(new Blob([rom], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url; link.download = "textadventure2600.bin"; document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function runJavatari(rom) {
  const dataUrl = `data:application/octet-stream;base64,${bytesToBase64(rom)}`;
  const frame = document.createElement("iframe");
  frame.className = "javatari-frame";
  frame.title = "Javatari emulator";
  frame.allow = "fullscreen; gamepad; autoplay";
  frame.srcdoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<base href="${new URL(".", location.href).href}">
<style>html,body,#javatari-screen{width:100%;height:100%;margin:0;background:#080a09;overflow:hidden}</style>
</head>
<body>
<div id="javatari-screen"></div>
<script>
window.CodeSnap2600_ROM_URL=${JSON.stringify(dataUrl)};
window.CodeSnap2600_ROM_FORMAT="F4";
window.CodeSnap2600_ROM_NAME="Text Adventure 2600";
window.CodeSnap2600_AUTO_START=true;
window.CodeSnap2600_SCREEN_ELEMENT_ID="javatari-screen";
window.CodeSnap2600_SCREEN_CONSOLE_PANEL_DISABLED=false;
window.CodeSnap2600_SCREEN_DEFAULT_SCALE=-1;
window.CodeSnap2600_SCREEN_CRT_MODE=0;

// CodeSnap configures both its patched bundle globals and Javatari's normal
// public configuration before loading the emulator. Do the same here.
window.Javatari=window.Javatari||{};
Javatari.CARTRIDGE_URL=window.CodeSnap2600_ROM_URL;
Javatari.CARTRIDGE_FORMAT="F4";
Javatari.AUTO_START=true;
Javatari.SCREEN_ELEMENT_ID="javatari-screen";
Javatari.SCREEN_CONSOLE_PANEL_DISABLED=false;
Javatari.SCREEN_DEFAULT_SCALE=-1;
Javatari.SCREEN_CRT_MODE=0;
<\/script>
<script src="./javatari.js"><\/script>
</body>
</html>`;
  const host = $("#javatari-host");
  host.replaceChildren(frame);
  $("#javatari-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function perform(mode) {
  try {
    const rom = await buildRom();
    if (mode === "download") downloadRom(rom);
    else runJavatari(rom);
  } catch (error) {
    console.error(error);
    setOutput(`Browser build failed.\n\n${error.message || error}`, "failed");
  }
}

$("#build-download")?.addEventListener("click", () => perform("download"));
$("#build-javatari")?.addEventListener("click", () => perform("run"));
$("#close-javatari")?.addEventListener("click", () => {
  const message = document.createElement("p");
  message.className = "emulator-placeholder";
  message.innerHTML = "Choose <strong>Build &amp; run Javatari</strong> to start the cartridge.";
  $("#javatari-host").replaceChildren(message);
});

window.TextAdventureBrowserBuild = { buildRom, getLastRom: () => lastRom };

})();
