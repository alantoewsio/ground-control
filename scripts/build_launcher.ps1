<#
.SYNOPSIS
    Build launcher.exe (Ground Control Launcher) with PyInstaller.

.DESCRIPTION
    Syncs tray + launcher-build dependencies, then runs PyInstaller using launcher.spec.
    Output: dist\launcher.exe

    After building, copy launcher.exe to the repository root (same folder as main.py) so
    native/Docker commands and app.config resolve paths correctly. Use -CopyToRepoRoot.

.PARAMETER Console
    Build with a console window (stderr visible). Sets GROUND_CONTROL_LAUNCHER_CONSOLE for launcher.spec;
    PyInstaller does not allow --console when a .spec file is used.

.PARAMETER CopyToRepoRoot
    Copy dist\launcher.exe to the repo root as launcher.exe

.EXAMPLE
    .\scripts\build_launcher.ps1
    .\scripts\build_launcher.ps1 -CopyToRepoRoot
#>
param(
    [switch]$Console,
    [switch]$CopyToRepoRoot
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Error "uv is required. Install from https://github.com/astral-sh/uv"
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

if ($CopyToRepoRoot) {
    $dest = Join-Path $RepoRoot "launcher.exe"
    Copy-Item -Path $built -Destination $dest -Force
    Write-Host "Copied to repo root: $dest"
}

Write-Host ""
Write-Host "Run the launcher from the repository root (next to main.py), or set GROUND_CONTROL_REPO_ROOT."
