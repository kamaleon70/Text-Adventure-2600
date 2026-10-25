param(
    [int]$Port = 8765,
    [switch]$NoBrowser,
    [string]$Python = "python",
    [string]$Stella = "C:\Program Files\Stella\Stella.exe"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$arguments = @((Join-Path $projectRoot "tools\editor_server.py"), "--port", $Port, "--stella", $Stella)
if ($NoBrowser) { $arguments += "--no-browser" }
& $Python @arguments
exit $LASTEXITCODE
