"""Regression tests for browser build source preparation."""

from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from editor_server import expanded_bank_source
from story_model import StoryError


class BrowserBuildSourceTests(unittest.TestCase):
    def test_all_banks_are_self_contained(self) -> None:
        for bank in range(8):
            source = expanded_bank_source(bank)
            self.assertIn(f"BANK_ID equ {bank}", source)
            self.assertIsNone(re.search(r'^\s*include\s+"', source, re.IGNORECASE | re.MULTILINE))
            self.assertIn("processor 6502", source)

    def test_invalid_bank_is_rejected(self) -> None:
        with self.assertRaisesRegex(StoryError, "Invalid bank"):
            expanded_bank_source(8)

    def test_expanded_banks_assemble_to_4k_when_local_dasm_is_available(self) -> None:
        dasm = Path(r"C:\Projects\atari\utilities\dasm\dasm.exe")
        if not dasm.is_file():
            self.skipTest("local DASM is not installed")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for bank in range(8):
                source_path = root / f"bank{bank}.asm"
                binary_path = root / f"bank{bank}.bin"
                source_path.write_text(expanded_bank_source(bank), encoding="utf-8")
                result = subprocess.run(
                    [str(dasm), str(source_path), "-f3", "-v0", f"-o{binary_path}"],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(binary_path.stat().st_size, 4096)


if __name__ == "__main__":
    unittest.main()
