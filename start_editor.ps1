param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8765,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$editorRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot "editor"))
$indexPath = Join-Path $editorRoot "index.html"
if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
    throw "Editor entry point not found: $indexPath"
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".txt"  = "text/plain; charset=utf-8"
    ".md"   = "text/markdown; charset=utf-8"
    ".asm"  = "text/plain; charset=utf-8"
    ".inc"  = "text/plain; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".bin"  = "application/octet-stream"
}

function Send-HttpResponse {
    param(
        [Parameter(Mandatory)] [IO.Stream]$Stream,
        [Parameter(Mandatory)] [int]$StatusCode,
        [Parameter(Mandatory)] [string]$StatusText,
        [Parameter(Mandatory)] [byte[]]$Body,
        [Parameter(Mandatory)] [string]$ContentType,
        [switch]$HeadOnly
    )

    $header = "HTTP/1.1 $StatusCode $StatusText`r`n" +
        "Content-Type: $ContentType`r`n" +
        "Content-Length: $($Body.Length)`r`n" +
        "Cache-Control: no-store`r`n" +
        "X-Content-Type-Options: nosniff`r`n" +
        "Connection: close`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if (-not $HeadOnly -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
    $Stream.Flush()
}

$listener = $null
$boundPort = 0
$lastSocketError = $null
$maximumPort = [Math]::Min(65535, $Port + 20)
for ($candidatePort = $Port; $candidatePort -le $maximumPort; $candidatePort++) {
    $candidateListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidatePort)
    try {
        $candidateListener.Start()
        $listener = $candidateListener
        $boundPort = $candidatePort
        break
    }
    catch [Net.Sockets.SocketException] {
        $lastSocketError = $_.Exception
        $candidateListener.Stop()
    }
}

if ($null -eq $listener) {
    throw "Could not start the local editor server on ports $Port-$maximumPort. Last socket error: $($lastSocketError.Message)"
}

$url = "http://127.0.0.1:$boundPort/"

try {
    if ($boundPort -ne $Port) {
        Write-Warning "Port $Port was unavailable; using port $boundPort instead."
    }
    Write-Host "Text Adventure 2600 editor: $url"
    Write-Host "Press Ctrl+C to stop the local server."
    if (-not $NoBrowser) {
        Start-Process $url
    }

    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $null
        $reader = $null
        try {
            $client.ReceiveTimeout = 5000
            $client.SendTimeout = 5000
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }

            do { $headerLine = $reader.ReadLine() } while ($null -ne $headerLine -and $headerLine.Length -gt 0)
            $parts = $requestLine.Split(" ")
            if ($parts.Count -lt 2) {
                $body = [Text.Encoding]::UTF8.GetBytes("Bad request")
                Send-HttpResponse $stream 400 "Bad Request" $body "text/plain; charset=utf-8"
                continue
            }

            $method = $parts[0].ToUpperInvariant()
            if ($method -notin @("GET", "HEAD")) {
                $body = [Text.Encoding]::UTF8.GetBytes("Method not allowed")
                Send-HttpResponse $stream 405 "Method Not Allowed" $body "text/plain; charset=utf-8" -HeadOnly:($method -eq "HEAD")
                continue
            }

            $requestPath = ($parts[1] -split "\?", 2)[0]
            try { $requestPath = [Uri]::UnescapeDataString($requestPath) }
            catch {
                $body = [Text.Encoding]::UTF8.GetBytes("Bad request path")
                Send-HttpResponse $stream 400 "Bad Request" $body "text/plain; charset=utf-8" -HeadOnly:($method -eq "HEAD")
                continue
            }
            if ($requestPath -eq "/") { $requestPath = "/index.html" }

            $relativePath = $requestPath.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
            $filePath = [IO.Path]::GetFullPath((Join-Path $editorRoot $relativePath))
            $insideEditor = $filePath.StartsWith(
                $editorRoot + [IO.Path]::DirectorySeparatorChar,
                [StringComparison]::OrdinalIgnoreCase
            )
            if (-not $insideEditor -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                $body = [Text.Encoding]::UTF8.GetBytes("Not found")
                Send-HttpResponse $stream 404 "Not Found" $body "text/plain; charset=utf-8" -HeadOnly:($method -eq "HEAD")
                continue
            }

            $body = [IO.File]::ReadAllBytes($filePath)
            $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
            $contentType = $mimeTypes[$extension]
            if ([string]::IsNullOrEmpty($contentType)) { $contentType = "application/octet-stream" }
            Send-HttpResponse $stream 200 "OK" $body $contentType -HeadOnly:($method -eq "HEAD")
        }
        catch {
            Write-Warning "Request failed: $($_.Exception.Message)"
        }
        finally {
            if ($null -ne $reader) { $reader.Dispose() }
            if ($null -ne $stream) { $stream.Dispose() }
            $client.Dispose()
        }
    }
}
finally {
    if ($null -ne $listener) { $listener.Stop() }
}
