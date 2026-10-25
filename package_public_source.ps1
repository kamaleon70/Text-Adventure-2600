param(
    [string]$OutputPath = "dist\TextAdventure2600-0.3beta-public-source.zip"
)

$ErrorActionPreference = "Stop"
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$output = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
$distRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot "dist"))
if (-not $output.StartsWith($distRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "OutputPath must be a file below the project's dist directory."
}

& node (Join-Path $projectRoot "tools\build_browser_source_bundle.js")
if ($LASTEXITCODE -ne 0) { throw "Could not regenerate editor/source_bundle.js." }

$tempRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ("ta2600-public-" + [guid]::NewGuid().ToString("N"))))
$stage = Join-Path $tempRoot "TextAdventure2600-0.3beta-source"

function Copy-ProjectFile([string]$relativePath) {
    $source = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing public file: $relativePath" }
    $destination = Join-Path $stage $relativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
}

function Copy-ProjectDirectory([string]$relativePath) {
    $source = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Missing public directory: $relativePath" }
    $destination = Join-Path $stage $relativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Recurse
}

try {
    New-Item -ItemType Directory -Path $stage | Out-Null

    @(
        ".gitignore",
        "README.md",
        "NOTICE.md",
        "LICENSE.txt",
        "LICENSING.md",
        "ROM_OUTPUT_EXCEPTION.md",
        "build.ps1",
        "clean.ps1",
        "start_editor.ps1",
        "package_itch_editor.ps1",
        "package_public_source.ps1"
    ) | ForEach-Object { Copy-ProjectFile $_ }

    @("assets", "doc", "editor", "itch", "third_party") |
        ForEach-Object { Copy-ProjectDirectory $_ }

    Get-ChildItem -LiteralPath (Join-Path $projectRoot "tools") -File |
        ForEach-Object { Copy-ProjectFile ("tools\" + $_.Name) }

    @("vcs.h", "macro.h", "xmacro.h") |
        ForEach-Object { Copy-ProjectFile ("lib\" + $_) }

    @("abb.asm", "abbAssymMirror.asm") |
        ForEach-Object { Copy-ProjectFile ("reference\" + $_) }

    @(
        "bank0.asm", "bank1.asm", "bank2.asm", "bank3.asm",
        "bank4.asm", "bank5.asm", "bank6.asm", "bank7.asm",
        "boot.asm", "engine.asm", "splash.asm", "tiny_font.inc"
    ) | ForEach-Object { Copy-ProjectFile ("src\" + $_) }

    @(
        "bank0_context_labels.inc", "bank0_story.inc",
        "bank1_context_labels.inc", "bank1_story.inc",
        "bank2_context_labels.inc", "bank2_story.inc", "bank2_text.inc",
        "bank3_context_labels.inc", "bank3_story.inc", "bank3_text.inc",
        "bank4_context_labels.inc", "bank4_story.inc", "bank4_text.inc",
        "bank5_context_labels.inc", "bank5_story.inc", "bank5_text.inc",
        "bank6_context_labels.inc", "bank6_story.inc", "bank6_text.inc",
        "bank7_context_labels.inc", "bank7_story.inc", "bank7_text.inc",
        "logic_story.inc", "splash_art.inc", "splash_config.inc"
    ) | ForEach-Object { Copy-ProjectFile ("src\data\" + $_) }

    $thirdPartyStage = [IO.Path]::GetFullPath((Join-Path $stage "third_party"))
    $forbidden = Get-ChildItem -LiteralPath $stage -Recurse -Force | Where-Object {
        $itemPath = [IO.Path]::GetFullPath($_.FullName)
        $isUpstreamTestMaterial = $itemPath.StartsWith(
            $thirdPartyStage + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase
        )
        $_.Name -in @(".git", "__pycache__", "stella.sqlite3") -or
        (-not $isUpstreamTestMaterial -and $_.Extension -in @(".bin", ".lst", ".sym", ".pyc"))
    }
    if ($forbidden) {
        throw "Generated/private files entered the public stage: $($forbidden.FullName -join ', ')"
    }

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $output) | Out-Null
    if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
    Compress-Archive -LiteralPath $stage -DestinationPath $output -CompressionLevel Optimal
    Write-Host "Created $output"
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
        $systemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
        if (-not $resolvedTemp.StartsWith($systemTemp, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove unexpected temporary path: $resolvedTemp"
        }
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}
