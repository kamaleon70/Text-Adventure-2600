param(
    [string]$OutputPath = "dist\text_adventure_editor_itch.zip"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$output = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
if (-not $output.StartsWith($projectRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "OutputPath must stay inside the project directory."
}

& node (Join-Path $projectRoot "tools\build_browser_source_bundle.js")
if ($LASTEXITCODE -ne 0) { throw "Could not generate the browser assembly source bundle." }

$stage = Join-Path ([IO.Path]::GetTempPath()) ("text-adventure-itch-" + [guid]::NewGuid().ToString("N"))
try {
    New-Item -ItemType Directory -Path $stage | Out-Null
    foreach ($file in @("index.html", "styles.css", "app.js", "manual_guides.js", "browser_build.js", "story_compiler.js", "source_bundle.js", "dasm.js", "dasm.LICENSE.txt", "javatari.js", "javatari.LICENSE.txt", "project.json", "logomauro.png")) {
        Copy-Item -LiteralPath (Join-Path $projectRoot "editor\$file") -Destination (Join-Path $stage $file)
    }
    Copy-Item -LiteralPath (Join-Path $projectRoot "itch\static_mode.js") -Destination (Join-Path $stage "static_mode.js")
    foreach ($file in @("README.md", "NOTICE.md", "LICENSE.txt", "LICENSING.md", "ROM_OUTPUT_EXCEPTION.md")) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $stage $file)
    }

    $outputDirectory = Split-Path -Parent $output
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $output -CompressionLevel Optimal
    Write-Host "Created $output"
}
finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
