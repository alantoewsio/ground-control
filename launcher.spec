# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for Ground Control Launcher (Windows one-file exe).
# Build: .\scripts\build_launcher.ps1  (from repo root or via that script)

import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files

block_cipher = None

_repo = (os.environ.get("GROUND_CONTROL_LAUNCHER_REPO") or "").strip()
if _repo:
    repo_root = Path(_repo).resolve()
else:
    try:
        repo_root = Path(SPECPATH).resolve().parent  # type: ignore[name-defined]
    except NameError:
        repo_root = Path.cwd().resolve()

script = repo_root / "scripts" / "gc_tray_wrapper.py"
if not script.is_file():
    raise SystemExit(f"Launcher script not found: {script}")

# Tray / window icon at runtime: prefer web favicon (same pixels as browser tab).
_favicon_ico = repo_root / "static" / "favicon.ico"
_brand_ico = repo_root / "assets" / "ground_control_launcher.ico"

datas = collect_data_files("sv_ttk")
if _favicon_ico.is_file():
    datas.append((str(_favicon_ico), "static"))
elif _brand_ico.is_file():
    datas.append((str(_brand_ico), "assets"))
mpl = collect_all("matplotlib")
datas += mpl[0]
binaries = list(mpl[1])
matplotlib_hidden = list(mpl[2])

hiddenimports = matplotlib_hidden + [
    "PIL._tkinter_finder",
    "matplotlib.backends.backend_tkagg",
    "app",
    "app.config",
    "app.security_settings",
    "app.url_helpers",
    "dotenv",
    "pkg_resources",
    "certifi",
]
if sys.platform == "win32":
    hiddenimports.append("pystray._win32")
elif sys.platform == "darwin":
    hiddenimports.append("pystray._darwin")

a = Analysis(
    [str(script)],
    pathex=[str(repo_root)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

_console = (os.environ.get("GROUND_CONTROL_LAUNCHER_CONSOLE") or "").strip().lower() in (
    "1",
    "true",
    "yes",
)

_exe_icon = None
if sys.platform == "win32":
    if _favicon_ico.is_file():
        _exe_icon = str(_favicon_ico)
    elif _brand_ico.is_file():
        _exe_icon = str(_brand_ico)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="launcher",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=_console,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=_exe_icon,
)
