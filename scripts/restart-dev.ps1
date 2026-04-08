# Stops whatever is listening on Ground Control HTTP/HTTPS ports, then starts the app.
# Use when Ctrl+C misbehaves or you want a clean restart from another terminal.
# Port defaults match app/config.py; override with the same env vars you use to run the app.
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Resolve-HttpPort {
    foreach ($key in @("GROUND_CONTROL_HTTP_PORT", "GROUND_CONTROL_PORT", "PORT")) {
        $raw = [Environment]::GetEnvironmentVariable($key, "Process")
        if (-not $raw) { continue }
        $p = 0
        if ([int]::TryParse($raw.Trim(), [ref]$p) -and $p -ge 1 -and $p -le 65535) { return $p }
    }
    return 8000
}

function Resolve-HttpsPort {
    $raw = [Environment]::GetEnvironmentVariable("GROUND_CONTROL_HTTPS_PORT", "Process")
    if (-not $raw) { return 8443 }
    $p = 0
    if ([int]::TryParse($raw.Trim(), [ref]$p) -and $p -ge 1 -and $p -le 65535) { return $p }
    return 8443
}

function Stop-ListenersOnPort([int]$port) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

$httpPort = Resolve-HttpPort
$httpsPort = Resolve-HttpsPort
Write-Host "Stopping listeners on ports $httpPort (HTTP) and $httpsPort (HTTPS)..."
Stop-ListenersOnPort $httpPort
Stop-ListenersOnPort $httpsPort

Write-Host "Starting: uv run python main.py"
uv run python main.py
