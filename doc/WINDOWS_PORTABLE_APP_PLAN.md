# Portable Windows application plan

## Purpose

Create a free, downloadable Windows edition of **Text Adventure 2600** for the
existing itch.io page. The download should be a ZIP that users extract and run;
it should not require Python, a local web server, an installer, or administrator
rights.

This document is a proposal only. No desktop application work should begin
until the decisions near the end have been reviewed.

## Target user experience

The proposed download would be named similarly to:

```text
TextAdventure2600_0.3beta_Windows_x64.zip
```

After extracting it, the user would run `Text Adventure 2600.exe`. The desktop
edition should:

- work offline after extraction;
- present the same editor and example project as the itch.io edition;
- save and load project configuration files using normal Windows dialogs;
- build and save 32K F4 ROM files locally;
- run a built ROM in the integrated Javatari emulator;
- retain browser-style draft recovery in a private application-data directory;
- require no installation or administrator access;
- show the application version, licence, acknowledgements, and engine-page URL.

The browser edition would remain available. The Windows ZIP would be an
additional itch.io download, not a replacement.

## Recommended technology

Use **Tauri 2** with the Windows WebView2 runtime.

Tauri is free and is available under the MIT or Apache-2.0 licence. It can
embed the existing HTML, CSS, JavaScript, logo, Javatari interface, and editor
assets in a Windows executable. It does not require a Python server or expose a
localhost port.

Modern supported Windows systems normally have WebView2 available. The first
release should target Windows 10/11 x64. A later ARM64 build can be considered
only if users request it.

## Recommended architecture

The application should be divided into two parts:

```text
Tauri window / existing editor interface
             |
             | narrowly defined Tauri commands
             v
Native Rust application layer
  - project validation
  - story/source generation
  - ROM build orchestration
  - native Open/Save dialogs
  - draft and preference storage
             |
             v
Generated 32K F4 ROM / integrated Javatari
```

### Web interface

Reuse the current editor layout and behaviour wherever practical. The web
interface would continue to manage room editing, map dragging, previews,
playtesting controls, appearance configuration, and the user manual.

Browser-specific download and file-upload paths would be replaced with a small
desktop adapter that calls Tauri commands. Keeping this adapter separate will
allow the browser and desktop editions to share most of the frontend code.

### Native application layer

The native layer should eventually own the parts that are worth making less
immediately readable:

- project validation;
- conversion of project data into assembly tables;
- embedded engine/source templates;
- assembly invocation and construction of the final ROM;
- writing configuration and ROM files selected by the user.

This logic would be compiled into the executable. It would be substantially
less convenient to inspect than the current JavaScript files, although it
could still be reverse-engineered by a determined person.

## What can and cannot be protected

Packaging a web application never provides complete secrecy. The editor must
render HTML, CSS, and JavaScript in WebView2, so at least the interface code and
runtime data can potentially be inspected. Electron archives, Tauri embedded
assets, minification, and obfuscation are deterrents rather than security
boundaries.

Reasonable protection for this project would be:

- move important generation logic and source templates into compiled Rust;
- bundle and minify the remaining frontend JavaScript and CSS;
- build Rust in release mode with link-time optimisation and stripped symbols;
- disable development tools in production builds;
- expose only the minimum Tauri commands and filesystem permissions;
- avoid including raw development folders, tests, listings, or symbol files.

Encryption of embedded assets is not recommended. An offline application must
also contain the decryption key, so it adds complexity without providing real
protection.

The project licence and attribution requirement remain the primary protection
for the engine and generated games.

## Licensing gate

Licensing must be reviewed before publishing the ZIP. Tauri itself is suitable
for free distribution, but the desktop application would also contain or use
third-party components.

### dasmjs

The current browser assembler is dasmjs 6.0.1 and is distributed under
GPL-2.0. Its copyright notice, licence text, source-offer/source-distribution
requirements, and interaction with the combined desktop application must be
resolved before release. Merely hiding or compiling its files does not remove
those obligations.

Possible approaches to evaluate are:

1. Continue using dasmjs and distribute the materials required by its licence.
2. Keep DASM as a clearly separate bundled program/process, with its own licence
   and corresponding source information, if legal review confirms this layout.
3. Replace the assembler component with a dependency whose licence matches the
   intended desktop distribution.

This is a licensing decision, not only a technical choice. No plan should claim
that the complete desktop application is closed-source until it is resolved.

### Javatari

Confirm the exact licence and redistribution requirements for the bundled
Javatari version. Include its required notice and licence files in the ZIP. If
redistribution is not appropriate, the desktop editor can still build ROMs and
offer an external-emulator workflow.

### Project and generated-game licence

Include the Text Adventure 2600 licence and the required attribution wording:

```text
Created with Text Adventure 2600 by kamaleon70
https://kamaleon70.itch.io/text-adventures-2600
```

The application should display this in an About/Licence page, and the ZIP
should include `LICENSE.txt`, `NOTICE.txt`, and a short `README.txt`. Authors
retain ownership of their original stories, text, graphics, and other content.

## Proposed ZIP contents

The final portable archive should be simple:

```text
Text Adventure 2600.exe
README.txt
LICENSE.txt
NOTICE.txt
ThirdPartyLicenses/
  Tauri.txt
  dasmjs-or-DASM.txt
  Javatari.txt
```

Additional DLLs or resources should be included only if the selected Tauri
build requires them. Development source, raw assembly templates, tests, and
build scripts should not be copied into the user ZIP unless a licence requires
their distribution. Licence-required source can be supplied as a separate
clearly labelled archive or source link when permitted.

## Implementation phases

### Phase 0 — decisions and licence audit

- Confirm whether the goal is casual deterrence or a genuinely proprietary
  native core.
- Audit dasmjs, Javatari, the Atari include files, the font/example ancestry,
  and all other redistributed components.
- Decide whether the downloadable edition may build commercial as well as free
  games under the existing attribution requirement.
- Decide whether an unsigned first release is acceptable.

Deliverable: a written go/no-go decision and an approved third-party licence
list. No application binary is published during this phase.

### Phase 1 — disposable Tauri proof of concept

- Create an isolated Tauri project without changing the production itch build.
- Open the existing static editor inside a Tauri window.
- Confirm map editing, manual pages, appearance previews, and Javatari display.
- Confirm that the app launches from an extracted folder without Python or a
  localhost server.
- Measure executable size and startup time.

This prototype may temporarily use the current JavaScript compiler only to
prove compatibility. It is not the protected or publishable build.

Deliverable: a local proof-of-concept ZIP for testing, not for itch.io.

### Phase 2 — desktop file integration

- Add native Open/Save dialogs for configuration files.
- Add a native Save dialog for generated `.bin` files.
- Store autosave data and preferences under the user's application-data folder.
- Keep the browser edition's existing file behaviour unchanged through a
  browser/desktop adapter.
- Add an About/Licence screen with version and attribution information.

Deliverable: a functional offline editor with the current compilation path.

### Phase 3 — native core and reduced source exposure

- Port project validation and story-table generation from JavaScript to Rust.
- Embed required engine templates in the compiled native resources.
- Define a small command interface such as `validate_project`, `build_rom`,
  `save_project`, and `open_project`.
- Return structured errors to the editor so build messages remain useful.
- Remove duplicate sensitive JavaScript and raw source files from the packaged
  frontend after parity tests pass.

Deliverable: a release-mode application in which the important project and ROM
generation logic is native code.

### Phase 4 — packaging and verification

- Add a reproducible `build_portable.ps1` script.
- Produce a versioned x64 ZIP under `dist/`.
- Test the extracted application from a clean directory and a standard Windows
  user account.
- Verify offline operation with network access disabled.
- Build and compare ROM output against the browser editor for the same config.
- Run generated ROMs in integrated Javatari and current Stella.
- Scan the archive to ensure it contains no development-only files.
- Verify all required licence and notice files.

Deliverable: `TextAdventure2600_<version>_Windows_x64.zip` ready for private
itch.io testing.

### Phase 5 — limited itch.io release

- Upload the ZIP as an additional Windows download.
- Mark it as free and label it clearly as a beta/experimental offline edition.
- Keep the browser `Run Game` edition available.
- Explain that Windows SmartScreen may warn about an unsigned application.
- Ask a small group to test launch, save/load, build/download, Javatari, and
  antivirus false positives before announcing it widely.

## Verification checklist

The desktop edition is ready only when all of the following pass:

- Launches after extracting the ZIP to a normal user-owned folder.
- Does not require Python, Node.js, Rust, DASM installation, or administrator
  rights on the user's machine.
- Does not open a localhost server or require an internet connection.
- Loads the included example and restores a local draft.
- Saves and reloads configurations without data loss.
- Builds an exactly 32,768-byte F4 ROM.
- Produces the same ROM as the browser edition for the same normalized project.
- Runs the ROM correctly in integrated Javatari and current Stella.
- Retains stable 262-scanline output and the existing ending/restart behaviour.
- Preserves map connections at different Windows scaling and application zoom
  levels.
- Includes accurate version, licence, attribution, and third-party notices.
- Contains no raw development files unless required for licence compliance.

## Expected limitations

- The first release would be Windows x64 only.
- An unsigned executable can trigger Windows SmartScreen warnings. Code signing
  is optional but normally costs money.
- WebView2 is a Windows runtime dependency; the portable package should detect
  and explain its absence rather than fail silently.
- A portable application cannot guarantee that users will never inspect or
  reverse-engineer its contents.
- Changes to shared editor behaviour must continue to be tested in both the
  browser and desktop editions.

## Decisions required before implementation

1. **Protection level:** quick wrapper of the current editor, or the recommended
   hybrid with a native Rust build core?
2. **Assembler:** keep dasmjs with full GPL compliance, use a separate DASM
   process if appropriate, or investigate an alternative?
3. **Emulator:** confirm that the current Javatari build can be redistributed in
   the Windows ZIP under acceptable terms.
4. **Signing:** release an unsigned beta first, or obtain a Windows code-signing
   certificate?
5. **Release scope:** Windows 10/11 x64 only for the first portable version?

## Recommendation

Proceed first with Phase 0. If the licensing audit permits the intended model,
build the small Phase 1 compatibility prototype and evaluate it before porting
any compiler logic. For a public release, prefer the hybrid Tauri/Rust design
over a simple wrapper: it provides a genuine offline application and makes the
important engine logic less casually accessible while preserving most of the
working editor.

