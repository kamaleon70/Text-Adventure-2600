param(
    [string]$Dasm = "C:\Projects\atari\utilities\dasm\dasm.exe",
    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = Join-Path $projectRoot "src"
$outputDir = Join-Path $projectRoot "bin"
$generator = Join-Path $projectRoot "tools\story_model.py"
$bankIds = 0..7

if (-not (Test-Path -LiteralPath $Dasm -PathType Leaf)) {
    throw "DASM was not found at '$Dasm'. Pass its path with: .\build.ps1 -Dasm <path>"
}

# Generate the eight F4 banks and split logic/text sources before assembling.
& $Python $generator
if ($LASTEXITCODE -ne 0) {
    throw "Story generation failed with exit code $LASTEXITCODE."
}

$storySources = @($bankIds | ForEach-Object { Join-Path $sourceDir "data\bank$($_)_story.inc" })
$pageTextSources = @(2..7 | ForEach-Object { Join-Path $sourceDir "data\bank$($_)_text.inc" })
$textSources = @((Join-Path $sourceDir "engine.asm")) + $pageTextSources

# The tiny-text builder always reads twelve native character bytes. Catching
# malformed rows here prevents it from reading into the following row/table.
foreach ($textSource in $textSources) {
    $lineNumber = 0
    foreach ($line in [IO.File]::ReadLines($textSource)) {
        $lineNumber++
        $match = [regex]::Match($line, '^\s*dc\.b\s+"([^"]*)"')
        if (-not $match.Success) { continue }

        $text = $match.Groups[1].Value
        if ($text.Length -ne 12) {
            throw "$textSource`:$lineNumber must contain exactly 12 characters; found $($text.Length): '$text'"
        }
        foreach ($character in $text.ToCharArray()) {
            $code = [int][char]$character
            if ($code -lt 41 -or $code -gt 91) {
                throw "$textSource`:$lineNumber contains unsupported '$character'. Use '[' for a blank."
            }
        }
    }
}

# Story pages are fixed records: ten rows in ROM, followed at display time by
# the engine-owned action row. Validate the record boundary as well as width.
foreach ($storySource in $pageTextSources) {
    $activePage = $null
    $pageRows = 0
    foreach ($line in [IO.File]::ReadLines($storySource)) {
        $pageMatch = [regex]::Match($line, '^\s*(Page\d+Text)\s*$')
        if ($pageMatch.Success) {
            if ($null -ne $activePage -and $pageRows -ne 10) {
                throw "$storySource page $activePage must have exactly 10 rows; found $pageRows."
            }
            $activePage = $pageMatch.Groups[1].Value
            $pageRows = 0
            continue
        }
        if ($null -ne $activePage -and $line -match '^\s*dc\.b\s+"') {
            $pageRows++
        }
    }
    if ($null -ne $activePage -and $pageRows -ne 10) {
        throw "$storySource page $activePage must have exactly 10 rows; found $pageRows."
    }
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Push-Location $sourceDir
try {
    foreach ($bank in $bankIds) {
        & $Dasm "bank$bank.asm" -f3 -v0 "-o$outputDir\bank$bank.bin" "-l$outputDir\bank$bank.lst" "-s$outputDir\bank$bank.sym"
        if ($LASTEXITCODE -ne 0) { throw "Bank $bank assembly failed with exit code $LASTEXITCODE." }
    }
}
finally {
    Pop-Location
}

# Indexed-indirect text reads gain a cycle when a string crosses a 256-byte
# boundary. Two 120-byte records fit safely at offsets $00 and $78.
foreach ($bank in $bankIds) {
    $symbolPath = Join-Path $outputDir "bank$bank.sym"
    $pageSymbols = Select-String -LiteralPath $symbolPath -Pattern '^Page[0-9]+Text\s+([0-9A-Fa-f]{4})\s'
    foreach ($pageSymbol in $pageSymbols) {
        $match = [regex]::Match($pageSymbol.Line, '^Page[0-9]+Text\s+([0-9A-Fa-f]{4})\s')
        $address = [Convert]::ToInt32($match.Groups[1].Value, 16)
        $offset = $address -band 0xFF
        if ($offset -notin @(0x00, 0x78)) {
            throw "$($pageSymbol.Line.Trim()) has unsafe text timing. Pages must start at offsets `$00 or `$78."
        }
    }
}

$bankSize = 4096
$rom = [byte[]]::new($bankSize * $bankIds.Count)
foreach ($bank in $bankIds) {
    $bankBytes = [IO.File]::ReadAllBytes((Join-Path $outputDir "bank$bank.bin"))
    if ($bankBytes.Length -ne $bankSize) {
        throw "Expected bank $bank to contain $bankSize bytes; got $($bankBytes.Length)."
    }
    [Array]::Copy($bankBytes, 0, $rom, $bank * $bankSize, $bankSize)
}

$romPath = Join-Path $outputDir "text_adventure_f4.bin"
[IO.File]::WriteAllBytes($romPath, $rom)
Write-Host "Built bin\text_adventure_f4.bin (32768 bytes, eight-bank F4 bankswitching)."
