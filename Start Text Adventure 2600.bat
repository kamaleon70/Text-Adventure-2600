@echo off
setlocal
cd /d "%~dp0"

echo Starting Text Adventure 2600...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_editor.ps1"

if errorlevel 1 (
    echo.
    echo The editor could not be started. Please read README_OFFLINE.txt.
    pause
)

