<#
.SYNOPSIS
    Build launcher.exe (Ground Control Launcher) with PyInstaller.

.DESCRIPTION
    Syncs tray + launcher-build dependencies, then runs PyInstaller using launcher.spec.
    Output: dist\launcher.exe

    After a successful build, the script stops any running Ground Control launcher instances
    (launcher.exe whose path is the repo root or dist copy), copies dist\launcher.exe to
    the repository root (overwriting launcher.exe there), then starts that copy in the
    background so the tray app runs from the correct working directory next to main.py.

.PARAMETER Console
    Build with a console window (stderr visible). Sets GROUND_CONTROL_LAUNCHER_CONSOLE for launcher.spec;
    PyInstaller does not allow --console when a .spec file is used.

.EXAMPLE
    .\scripts\build_launcher.ps1
#>
param(
    [switch]$Console
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Error "uv is required. Install from https://github.com/astral-sh/uv"
}

function Stop-GroundControlLauncherInstances {
    param(
        [string]$BuiltExecutable,
        [string]$RootExecutable
    )
    $targetPaths = [System.Collections.ArrayList]@()
    foreach ($candidate in @($RootExecutable, $BuiltExecutable)) {
        if (-not $candidate) { continue }
        try {
            $full = [System.IO.Path]::GetFullPath($candidate)
            $dup = $false
            foreach ($existing in $targetPaths) {
                if ([string]::Equals($full, $existing, [StringComparison]::OrdinalIgnoreCase)) {
                    $dup = $true
                    break
                }
            }
            if (-not $dup) { [void]$targetPaths.Add($full) }
        } catch {
            # ignore invalid paths
        }
    }
    if ($targetPaths.Count -eq 0) { return }

    $procs = Get-CimInstance Win32_Process -Filter "Name = 'launcher.exe'" -ErrorAction SilentlyContinue
    if (-not $procs) { return }
    foreach ($p in @($procs)) {
        $exePath = $p.ExecutablePath
        if (-not $exePath) { continue }
        try {
            $norm = [System.IO.Path]::GetFullPath($exePath)
        } catch {
            continue
        }
        $hit = $false
        foreach ($tp in $targetPaths) {
            if ([string]::Equals($norm, $tp, [StringComparison]::OrdinalIgnoreCase)) {
                $hit = $true
                break
            }
        }
        if ($hit) {
            Write-Host "Stopping running launcher (PID $($p.ProcessId)): $norm"
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "Repository: $RepoRoot"
Write-Host "Syncing dependencies (tray + launcher-build)..."
uv sync --group tray --group launcher-build

$specPath = Join-Path $RepoRoot "launcher.spec"
if (-not (Test-Path $specPath)) {
    Write-Error "Missing launcher.spec at $specPath"
}

$distPath = Join-Path $RepoRoot "dist"
$workPath = Join-Path $RepoRoot "build" "launcher"
New-Item -ItemType Directory -Force -Path $workPath | Out-Null

$env:GROUND_CONTROL_LAUNCHER_REPO = $RepoRoot
if ($Console) {
    $env:GROUND_CONTROL_LAUNCHER_CONSOLE = "1"
} else {
    Remove-Item Env:GROUND_CONTROL_LAUNCHER_CONSOLE -ErrorAction SilentlyContinue
}

# With a .spec file, PyInstaller does not accept --windowed/--console on the CLI.
$pyiArgs = @(
    "--clean",
    "--noconfirm",
    "--distpath", $distPath,
    "--workpath", $workPath,
    $specPath
)

Write-Host "Running PyInstaller..."
uv run pyinstaller @pyiArgs

$built = Join-Path $distPath "launcher.exe"
if (-not (Test-Path $built)) {
    Write-Error "Build failed: $built not found"
}

Write-Host "Built: $built"

$dest = Join-Path $RepoRoot "launcher.exe"
Write-Host "Stopping any running Ground Control launcher (repo root or dist)..."
Stop-GroundControlLauncherInstances -BuiltExecutable $built -RootExecutable $dest
Start-Sleep -Seconds 1

Copy-Item -Path $built -Destination $dest -Force
Write-Host "Copied to repo root (overwrite): $dest"

Write-Host "Starting launcher from repo root (background)..."
Start-Process -FilePath $dest -WorkingDirectory $RepoRoot | Out-Null

Write-Host ""
Write-Host "Done. Tray launcher should be running from the repository root."
