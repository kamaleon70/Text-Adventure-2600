"""Loopback-only web editor for the Atari 2600 tiny text adventure."""

from __future__ import annotations

import argparse
import copy
import json
import re
import secrets
import subprocess
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from story_model import PROJECT_FILE, PROJECT_ROOT, StoryError, load_project, project_summary, save_project

STATIC_ROOT = PROJECT_ROOT / "editor"
BUILD_SCRIPT = PROJECT_ROOT / "build.ps1"
ROM_PATH = PROJECT_ROOT / "bin" / "text_adventure_f4.bin"
DEFAULT_STELLA = Path(r"C:\Program Files\Stella\Stella.exe")
MAX_REQUEST_BYTES = 512 * 1024
MAX_LOG_BYTES = 96 * 1024
SAVE_LOCK = threading.Lock()
ACTION_LABELS = {"build": "Build ROM", "run": "Build & run Stella"}
INCLUDE_PATTERN = re.compile(r'^\s*include\s+"([^"]+)"\s*(?:;.*)?$', re.IGNORECASE)


def expanded_bank_source(bank: int) -> str:
    """Return one self-contained bank source suitable for browser dasmjs."""
    if bank not in range(8):
        raise StoryError(f"Invalid bank number: {bank}")

    project_root = PROJECT_ROOT.resolve()

    def expand(path: Path, stack: tuple[Path, ...] = ()) -> str:
        resolved = path.resolve()
        try:
            resolved.relative_to(project_root)
        except ValueError as error:
            raise StoryError(f"Include escapes the project directory: {path}") from error
        if resolved in stack:
            chain = " -> ".join(item.name for item in (*stack, resolved))
            raise StoryError(f"Recursive assembly include: {chain}")
        if not resolved.is_file():
            raise StoryError(f"Assembly include was not found: {resolved.relative_to(project_root)}")

        output = [f"; browser include begin: {resolved.relative_to(project_root)}"]
        for line in resolved.read_text(encoding="utf-8").splitlines():
            match = INCLUDE_PATTERN.match(line)
            if match:
                include_path = match.group(1).replace("\\", "/")
                output.append(expand(resolved.parent / include_path, (*stack, resolved)))
            else:
                output.append(line)
        output.append(f"; browser include end: {resolved.relative_to(project_root)}")
        return "\n".join(output)

    return expand(PROJECT_ROOT / "src" / f"bank{bank}.asm") + "\n"


def dashboard_data(project_path: Path) -> dict[str, Any]:
    project = load_project(project_path)
    rom = None
    if ROM_PATH.exists():
        stat = ROM_PATH.stat()
        rom = {
            "path": str(ROM_PATH.relative_to(PROJECT_ROOT)),
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(timespec="seconds"),
        }
    return {"project": project, "summary": project_summary(project), "rom": rom}


class ActionRunner:
    def __init__(self, project_path: Path, stella_path: Path) -> None:
        self.project_path = project_path
        self.stella_path = stella_path
        self._lock = threading.Lock()
        self._next_id = 1
        self._job: dict[str, Any] = {
            "id": 0,
            "action": None,
            "label": None,
            "status": "idle",
            "started": None,
            "finished": None,
            "duration_seconds": None,
            "exit_code": None,
            "log": "No build action has run in this editor session.",
        }

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return copy.deepcopy(self._job)

    def is_running(self) -> bool:
        with self._lock:
            return self._job["status"] == "running"

    def start(self, action: str) -> dict[str, Any]:
        if action not in ACTION_LABELS:
            raise StoryError(f"Unknown action: {action}")
        with self._lock:
            if self._job["status"] == "running":
                raise StoryError("Another build action is already running")
            job_id = self._next_id
            self._next_id += 1
            self._job = {
                "id": job_id,
                "action": action,
                "label": ACTION_LABELS[action],
                "status": "running",
                "started": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "finished": None,
                "duration_seconds": None,
                "exit_code": None,
                "log": f"> {ACTION_LABELS[action]}\n",
            }
        threading.Thread(target=self._run, args=(job_id, action), daemon=True).start()
        return self.snapshot()

    def _append(self, job_id: int, value: str) -> None:
        with self._lock:
            if self._job["id"] == job_id:
                self._job["log"] = (self._job["log"] + value)[-MAX_LOG_BYTES:]

    def _run(self, job_id: int, action: str) -> None:
        start_time = time.monotonic()
        exit_code = -1
        try:
            command = [
                "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", str(BUILD_SCRIPT),
            ]
            process = subprocess.Popen(
                command,
                cwd=PROJECT_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
            if process.stdout is not None:
                for line in process.stdout:
                    self._append(job_id, line)
                process.stdout.close()
            exit_code = process.wait()
            if exit_code == 0 and action == "run":
                if not self.stella_path.is_file():
                    raise FileNotFoundError(f"Stella was not found at {self.stella_path}")
                rom_path = ROM_PATH.resolve()
                self._append(job_id, f"Launching: {self.stella_path} {rom_path}\n")
                launcher = subprocess.Popen(
                    [str(self.stella_path), str(rom_path)],
                    cwd=self.stella_path.parent,
                    close_fds=True,
                    creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
                )
                time.sleep(0.5)
                launch_code = launcher.poll()
                if launch_code not in (None, 0):
                    raise RuntimeError(f"Stella exited immediately with code {launch_code}")
                self._append(job_id, f"Stella launch accepted (PID {launcher.pid}).\n")
        except Exception as error:  # Keep failures visible in the Build tab.
            self._append(job_id, f"Action failed: {error}\n")
            exit_code = -1
        finished = datetime.now(timezone.utc)
        with self._lock:
            if self._job["id"] == job_id:
                self._job.update({
                    "status": "succeeded" if exit_code == 0 else "failed",
                    "finished": finished.isoformat(timespec="seconds"),
                    "duration_seconds": round(time.monotonic() - start_time, 2),
                    "exit_code": exit_code,
                })


class EditorHandler(BaseHTTPRequestHandler):
    project_path: Path
    editor_token: str
    action_runner: ActionRunner

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"editor: {self.address_string()} - {fmt % args}")

    def _send(self, status: HTTPStatus, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self' data: blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self' 'unsafe-inline' https://cdn.skypack.dev https://esm.sh https://cdn.jsdelivr.net; "
            "connect-src 'self' data: blob: https://cdn.skypack.dev https://esm.sh https://cdn.jsdelivr.net",
        )
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        self._send(status, "application/json; charset=utf-8", json.dumps(payload).encode("utf-8"))

    def _authorized(self) -> bool:
        return self.headers.get("X-Text-Adventure-Editor") == self.editor_token

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/project":
            try:
                self._json(HTTPStatus.OK, {
                    "ok": True,
                    "data": dashboard_data(self.project_path),
                    "editor_token": self.editor_token,
                })
            except (StoryError, OSError) as error:
                self._json(HTTPStatus.UNPROCESSABLE_ENTITY, {"ok": False, "error": str(error)})
            return
        if path == "/api/action":
            if not self._authorized():
                self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Invalid editor token"})
                return
            self._json(HTTPStatus.OK, {"ok": True, "job": self.action_runner.snapshot()})
            return
        if path == "/api/browser-sources":
            if not self._authorized():
                self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Invalid editor token"})
                return
            try:
                # Loading validates that the generated files correspond to a valid project.
                load_project(self.project_path)
                self._json(HTTPStatus.OK, {
                    "ok": True,
                    "format": "F4",
                    "banks": [expanded_bank_source(bank) for bank in range(8)],
                })
            except (StoryError, OSError) as error:
                self._json(HTTPStatus.UNPROCESSABLE_ENTITY, {"ok": False, "error": str(error)})
            return

        files = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/index.html": ("index.html", "text/html; charset=utf-8"),
            "/styles.css": ("styles.css", "text/css; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
            "/manual_guides.js": ("manual_guides.js", "text/javascript; charset=utf-8"),
            "/static_mode.js": ("static_mode.js", "text/javascript; charset=utf-8"),
            "/story_compiler.js": ("story_compiler.js", "text/javascript; charset=utf-8"),
            "/source_bundle.js": ("source_bundle.js", "text/javascript; charset=utf-8"),
            "/browser_build.js": ("browser_build.js", "text/javascript; charset=utf-8"),
            "/javatari.js": ("javatari.js", "text/javascript; charset=utf-8"),
        }
        target = files.get(path)
        if target is None:
            self._send(HTTPStatus.NOT_FOUND, "text/plain; charset=utf-8", b"Not found")
            return
        filename, content_type = target
        self._send(HTTPStatus.OK, content_type, (STATIC_ROOT / filename).read_bytes())

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path not in {"/api/save", "/api/action"}:
            self._send(HTTPStatus.NOT_FOUND, "text/plain; charset=utf-8", b"Not found")
            return
        if not self._authorized():
            self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Invalid editor token"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "error": "Invalid request size"})
            return
        try:
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            if path == "/api/action":
                if not isinstance(request, dict) or set(request) != {"action"}:
                    raise StoryError("Action request must contain exactly one action")
                job = self.action_runner.start(request["action"])
                self._json(HTTPStatus.ACCEPTED, {"ok": True, "job": job})
                return
            if self.action_runner.is_running():
                raise StoryError("Wait for the build action to finish before saving")
            with SAVE_LOCK:
                project = save_project(request, self.project_path)
            self._json(HTTPStatus.OK, {
                "ok": True,
                "data": dashboard_data(self.project_path),
                "project": project,
                "editor_token": self.editor_token,
            })
        except (StoryError, json.JSONDecodeError, OSError, TypeError) as error:
            self._json(HTTPStatus.UNPROCESSABLE_ENTITY, {"ok": False, "error": str(error)})


def serve(
    project_path: Path = PROJECT_FILE,
    host: str = "127.0.0.1",
    port: int = 8765,
    open_browser: bool = True,
    stella_path: Path = DEFAULT_STELLA,
) -> None:
    load_project(project_path)
    runner = ActionRunner(project_path, stella_path)
    handler = type("TinyTextEditorHandler", (EditorHandler,), {
        "project_path": project_path,
        "editor_token": secrets.token_urlsafe(24),
        "action_runner": runner,
    })
    server = ThreadingHTTPServer((host, port), handler)
    url = f"http://{host}:{server.server_port}/"
    print(f"Tiny Text Adventure editor: {url}")
    print("Loopback-only local editor; press Ctrl+C to stop.")
    if open_browser:
        threading.Timer(0.35, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEditor stopped.")
    finally:
        server.server_close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=PROJECT_FILE)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--stella", type=Path, default=DEFAULT_STELLA)
    args = parser.parse_args()
    serve(args.project, args.host, args.port, not args.no_browser, args.stella)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
