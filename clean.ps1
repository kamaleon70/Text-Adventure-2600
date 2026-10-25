$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDir = Join-Path $projectRoot "bin"

if (-not (Test-Path -LiteralPath $outputDir -PathType Container)) {
    return
}

$resolvedRoot = (Resolve-Path -LiteralPath $projectRoot).Path
$resolvedOutput = (Resolve-Path -LiteralPath $outputDir).Path
if (-not $resolvedOutput.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean an output directory outside the project."
}

Get-ChildItem -LiteralPath $resolvedOutput -File |
    Where-Object { $_.Extension -in '.bin', '.lst', '.sym' } |
    Remove-Item -Force

Write-Host "Removed generated build files from bin."
