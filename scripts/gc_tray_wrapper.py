#!/usr/bin/env python3
"""
Ground Control Launcher (Windows, macOS, Linux): system tray UI to start/stop Ground Control.

The **launcher** hosts a dashboard with **Sun Valley** (``sv-ttk``) styling, follows
Windows/macOS light or dark app setting (polled periodically), and includes Charts plus a
Console with ANSI-colored output when the child emits escape sequences (``FORCE_COLOR=1``,
``PYTHONUNBUFFERED=1``).

Runs in the repository root context. **Native** mode stops listeners on the configured
HTTP/HTTPS ports (matching scripts/restart-dev.ps1), then launches ``uv run python main.py``
(or ``python main.py`` when ``uv`` is unavailable). **Docker** mode: **Start** runs ``docker compose up -d`` (no image build). **Restart** runs
``docker compose restart`` on the service. Use **Rebuild** for ``docker compose build`` plus
``up -d --force-recreate``; the console shows ``docker compose logs -f`` output.

Install launcher extras: ``uv sync --group tray``
Run: ``uv run --group tray python scripts/gc_tray_wrapper.py``

Optional **Start at login**: Windows uses HKCU ``...\\CurrentVersion\\Run``;
macOS installs ``~/Library/LaunchAgents/com.groundcontrol.tray.plist`` and runs ``launchctl bootstrap``.

**Close dashboard:** the window close button minimizes to the tray; hold **Ctrl** (Windows / Linux with X11)
or **Command** (macOS) while clicking close to **quit the launcher** entirely.

**Update:** when the checkout is a Git repo with an upstream, the dashboard polls ``git fetch`` periodically;
if the remote branch is ahead of ``HEAD``, an **Update** control (left of the theme toggle) enables and runs
``git pull --ff-only`` then ``scripts/build_launcher.ps1`` (Windows PowerShell, or ``pwsh`` elsewhere).
"""

from __future__ import annotations

import collections
import ctypes
import dataclasses
import json
import math
import os
import webbrowser
import plistlib
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# --- repo on path (for app.config port helpers) ---
def _resolve_repo_root() -> Path:
    env = (os.environ.get("GROUND_CONTROL_REPO_ROOT") or "").strip()
    if env:
        return Path(env).resolve()
    if getattr(sys, "frozen", False):
        # PyInstaller onefile/onedir: keep launcher.exe in the repository root (next to main.py).
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


_REPO_ROOT = _resolve_repo_root()
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
if getattr(sys, "frozen", False):
    os.environ.setdefault("GROUND_CONTROL_BASE_DIR", str(_REPO_ROOT))

import matplotlib

matplotlib.use("TkAgg")

import matplotlib.dates as mdates
import matplotlib.gridspec as gridspec
import matplotlib.pyplot as plt
import psutil
import pystray
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from PIL import Image, ImageDraw, ImageFont, ImageTk
from pystray import Menu, MenuItem

from app import config as gc_config
from app.docker_secrets import (
    DOCKER_LE_SECRET_FILE_NAMES,
    DOCKER_SECRET_SPECS,
    DockerSecretSpec,
)
from app.letsencrypt_plugins import DNS_PLUGIN_SPECS, DnsPluginField, PLUGIN_BY_ID
from app.letsencrypt_service import format_dns_credentials_ini_content, parse_dns_credentials_ini_values

# Leading symbols / emoji for tray menu (pystray has no per-item icon API on most platforms).
_TRAY_MENU_OPEN = f"{chr(0x1F4CA)} Open dashboard"
_TRAY_MENU_START = "\u25B6 Start"
_TRAY_MENU_STOP = "\u25FC Stop"
_TRAY_MENU_RESTART = "\u21BB Restart"
_TRAY_MENU_QUIT = "\u2715 Quit Launcher"

_AUTOSTART_WIN_REG_NAME = "GroundControlTray"
_AUTOSTART_MAC_LABEL = "com.groundcontrol.tray"
_AUTOSTART_MAC_PLIST = Path.home() / "Library/LaunchAgents" / f"{_AUTOSTART_MAC_LABEL}.plist"

_SETTINGS_PATH = _REPO_ROOT / ".gc_tray_settings.json"
_DOCKER_COMPOSE_FILE = _REPO_ROOT / "docker-compose.yml"
_DOCKER_COMPOSE_SERVICE = "ground-control"
_DOCKER_LOCAL_IMAGE = "ground-control:local"
_DOCKER_SECRETS_DIR = _REPO_ROOT / ".gc_docker_secrets"

# Toolbar run-mode radios show "Native" / "Docker"; tooltips carry the full descriptions.
_RUN_MODE_TOOLTIP_NATIVE = "Run natively (Python / uv on this machine)"
_RUN_MODE_TOOLTIP_DOCKER = (
    "Run in Docker (Start: compose up — no build; Restart: compose restart; Rebuild: build + recreate)"
)
_TOOLTIP_RESTART = "Restart without rebuilding (Docker: compose restart; native: stop then start)"
_TOOLTIP_DOCKER_REBUILD = (
    "Rebuild image and recreate container (compose build + up --force-recreate). "
    "Only enabled in Docker run mode."
)
_TOOLTIP_UPDATE = (
    "Pull the latest changes from GitHub and rebuild the launcher (restarts the tray app when done)"
)
_GIT_FETCH_TIMEOUT_SEC = 120.0
_GIT_UPDATE_POLL_INTERVAL_MS = 300_000


def _parse_docker_inspect_started_at(raw: str) -> float | None:
    """Parse ``docker inspect`` ``.State.StartedAt`` (RFC3339 / nanoseconds) to UTC epoch seconds."""
    s = (raw or "").strip()
    if not s or s.startswith("0001-01-01"):
        return None
    if s.endswith("Z"):
        s = s[:-1]
    main, sep, frac = s.partition(".")
    if not sep:
        try:
            dt = datetime.strptime(main, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            return None
        return dt.timestamp()
    digits = re.sub(r"[^\d].*", "", frac)
    if not digits:
        digits = "0"
    frac6 = (digits + "000000")[:6]
    try:
        dt = datetime.strptime(f"{main}.{frac6}", "%Y-%m-%dT%H:%M:%S.%f").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return dt.timestamp()


def _format_uptime_duration(total_seconds: float) -> str:
    sec = max(0, int(total_seconds))
    d, sec = divmod(sec, 86400)
    h, sec = divmod(sec, 3600)
    m, s = divmod(sec, 60)
    parts: list[str] = []
    if d:
        parts.append(f"{d}d")
    if h or d:
        parts.append(f"{h}h")
    if m or h or d:
        parts.append(f"{m}m")
    parts.append(f"{s}s")
    return " ".join(parts)


def _docker_le_dns_field_maskable(f: DnsPluginField) -> bool:
    """True for password entries and text fields that hold keys/tokens (not hostnames or usernames)."""
    if f.input_type == "password":
        return True
    if f.input_type != "text":
        return False
    k = f.key.lower()
    return ("_key" in k or "_secret" in k or "_token" in k) and "endpoint" not in k


# Avoid blocking the Tk thread with repeated ``docker compose ps`` / ``psutil.net_connections`` scans
# (tray menu refresh, dashboard buttons, and status tick each re-query service state).
_RUNTIME_PROBE_CACHE_TTL_SEC = 2.5


def _x11_control_modifier_down() -> bool:
    """True if either Control key appears pressed (X11 only; Wayland returns False)."""
    if sys.platform not in ("linux", "freebsd", "openbsd", "netbsd"):
        return False
    try:
        x = ctypes.CDLL("libX11.so.6")
    except OSError:
        try:
            x = ctypes.CDLL("libX11.so")
        except OSError:
            return False

    XOpenDisplay = x.XOpenDisplay
    XOpenDisplay.argtypes = [ctypes.c_char_p]
    XOpenDisplay.restype = ctypes.c_void_p
    XCloseDisplay = x.XCloseDisplay
    XCloseDisplay.argtypes = [ctypes.c_void_p]
    XCloseDisplay.restype = ctypes.c_int
    XQueryKeymap = x.XQueryKeymap
    XQueryKeymap.argtypes = [ctypes.c_void_p, ctypes.c_char * 32]
    XQueryKeymap.restype = ctypes.c_int
    XKeysymToKeycode = x.XKeysymToKeycode
    XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    XKeysymToKeycode.restype = ctypes.c_ubyte

    disp = XOpenDisplay(None)
    if not disp:
        return False
    try:
        for keysym in (0xFFE3, 0xFFE4):  # XK_Control_L, XK_Control_R
            kc = int(XKeysymToKeycode(disp, keysym))
            if kc == 0:
                continue
            keymap = (ctypes.c_char * 32)()
            XQueryKeymap(disp, keymap)
            byte_i, bit_i = kc // 8, kc % 8
            if byte_i >= 32:
                continue
            cell = keymap[byte_i]
            b = cell if isinstance(cell, int) else ord(cell)
            if b & (1 << bit_i):
                return True
        return False
    finally:
        XCloseDisplay(disp)


def _control_or_command_held_for_window_close() -> bool:
    """Detect Ctrl (Windows/Linux X11) or Command (macOS) for dashboard close → quit."""
    if sys.platform == "win32":
        user32 = ctypes.windll.user32
        return bool(
            (user32.GetAsyncKeyState(0xA2) & 0x8000)
            or (user32.GetAsyncKeyState(0xA3) & 0x8000)  # VK_LCONTROL, VK_RCONTROL
        )
    if sys.platform == "darwin":
        try:
            import AppKit  # type: ignore[import-untyped]
        except ImportError:
            return False
        try:
            flags = int(AppKit.NSEvent.modifierFlags())
            return bool(flags & AppKit.NSEventModifierFlagCommand)
        except (AttributeError, TypeError, ValueError):
            return False
    return _x11_control_modifier_down()


def _read_postgres_password_from_dotenv_file() -> str | None:
    env_path = _REPO_ROOT / ".env"
    if not env_path.is_file():
        return None
    try:
        text = env_path.read_text(encoding="utf-8")
    except OSError:
        return None
    prefixes = ("GC_POSTGRES_PASSWORD=", "GROUND_CONTROL_POSTGRES_PASSWORD=")
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        for pref in prefixes:
            if s.startswith(pref):
                val = s.split("=", 1)[1].strip().strip('"').strip("'")
                return val or None
    return None


def _migrate_postgres_password_secret_from_dotenv() -> None:
    """If the Postgres secret file is empty, copy a password from project ``.env`` once.

    Older setups used ``GC_POSTGRES_PASSWORD`` in ``.env`` with compose interpolation; migrating
    into ``.gc_docker_secrets/`` keeps existing volumes reachable without embedding passwords in YAML.
    """
    secret_path = _DOCKER_SECRETS_DIR / "ground_control_postgres_password"
    try:
        if secret_path.read_text(encoding="utf-8").strip():
            return
    except OSError:
        return
    val = _read_postgres_password_from_dotenv_file()
    if not val:
        return
    try:
        secret_path.write_text(val + "\n", encoding="utf-8")
    except OSError:
        pass


def _sync_postgres_secret_from_host_environ() -> None:
    """If the secret file is still empty, copy from the host environment (Launcher loads ``.env`` via app.config)."""
    secret_path = _DOCKER_SECRETS_DIR / "ground_control_postgres_password"
    try:
        if secret_path.read_text(encoding="utf-8").strip():
            return
    except OSError:
        return
    for key in ("GROUND_CONTROL_POSTGRES_PASSWORD", "GC_POSTGRES_PASSWORD"):
        val = (os.environ.get(key) or "").strip()
        if val:
            try:
                secret_path.write_text(val + "\n", encoding="utf-8")
            except OSError:
                pass
            return


def _ensure_docker_secrets_stub_files() -> None:
    """Ensure compose secret file paths exist (empty = no override in the container)."""
    _DOCKER_SECRETS_DIR.mkdir(parents=True, exist_ok=True)
    # If this path is a directory (e.g. mistaken mkdir), Compose mounts a dir and the app sees an
    # empty password. Replace with a regular file so the secret mounts correctly.
    _pg_secret = _DOCKER_SECRETS_DIR / "ground_control_postgres_password"
    try:
        if _pg_secret.is_dir():
            shutil.rmtree(_pg_secret)
    except OSError:
        pass
    for spec in DOCKER_SECRET_SPECS:
        p = _DOCKER_SECRETS_DIR / spec.file_name
        if not p.exists():
            p.write_bytes(b"")
    for name in DOCKER_LE_SECRET_FILE_NAMES:
        p = _DOCKER_SECRETS_DIR / name
        if not p.exists():
            p.write_bytes(b"")
    _migrate_postgres_password_secret_from_dotenv()
    _sync_postgres_secret_from_host_environ()


def _docker_compose_publish_env() -> dict[str, str]:
    """Align host port mapping with HTTP/HTTPS secret files."""
    _ensure_docker_secrets_stub_files()
    http_p, https_p = 8000, 8443
    try:
        raw = (_DOCKER_SECRETS_DIR / "ground_control_http_port").read_text(encoding="utf-8").strip()
        if raw.isdigit():
            http_p = int(raw)
    except OSError:
        pass
    try:
        raw = (_DOCKER_SECRETS_DIR / "ground_control_https_port").read_text(encoding="utf-8").strip()
        if raw.isdigit():
            https_p = int(raw)
    except OSError:
        pass
    return {
        "GC_PUBLISH_HTTP": str(http_p),
        "GC_CONTAINER_HTTP": str(http_p),
        "GC_PUBLISH_HTTPS": str(https_p),
        "GC_CONTAINER_HTTPS": str(https_p),
    }


def _load_tray_settings() -> dict[str, Any]:
    try:
        with open(_SETTINGS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (OSError, json.JSONDecodeError, TypeError):
        pass
    return {"run_mode": "native"}


def _save_tray_settings(data: dict[str, Any]) -> None:
    try:
        with open(_SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except OSError:
        pass


def _docker_compose_argv(*args: str) -> list[str] | None:
    if not shutil.which("docker"):
        return None
    return ["docker", "compose", "-f", str(_DOCKER_COMPOSE_FILE), *args]


def _parse_docker_mem_usage_mib(mem_field: str) -> float:
    """First number in docker stats MemUsage (e.g. '120MiB / 512MiB' -> 120)."""
    part = (mem_field or "").strip().split("/", 1)[0].strip()
    m = re.match(r"^([\d.]+)\s*([KMGT]?i?B)$", part, re.IGNORECASE)
    if not m:
        try:
            return float(part)
        except ValueError:
            return 0.0
    val = float(m.group(1))
    u = m.group(2).lower()
    if u in ("gib", "gb"):
        return val * 1024.0
    if u in ("mib", "mb"):
        return val
    if u in ("kib", "kb"):
        return val / 1024.0
    if u == "b":
        return val / (1024.0 * 1024.0)
    return val


def _tray_wrapper_argv() -> list[str]:
    """Argv to start the Ground Control Launcher (absolute paths where required)."""
    repo = str(_REPO_ROOT.resolve())
    script_rel = "scripts/gc_tray_wrapper.py"
    uv_bin = shutil.which("uv")
    if uv_bin:
        return [uv_bin, "run", "--project", repo, "--group", "tray", "python", script_rel]
    return [sys.executable, str((_REPO_ROOT / "scripts" / "gc_tray_wrapper.py").resolve())]


def autostart_supported() -> bool:
    return sys.platform in ("win32", "darwin")


def _autostart_enabled() -> bool:
    if sys.platform == "win32":
        return _windows_autostart_enabled()
    if sys.platform == "darwin":
        return _macos_autostart_enabled()
    return False


def _autostart_set_enabled(enable: bool) -> None:
    if not autostart_supported():
        raise OSError("Start at login is only supported on Windows and macOS.")
    if enable:
        argv = _tray_wrapper_argv()
        if sys.platform == "win32":
            _windows_autostart_enable(subprocess.list2cmdline(argv))
        else:
            _macos_autostart_enable(argv)
    elif sys.platform == "win32":
        _windows_autostart_disable()
    else:
        _macos_autostart_disable()


def _windows_autostart_enabled() -> bool:
    import winreg

    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ) as key:
            try:
                val, _ = winreg.QueryValueEx(key, _AUTOSTART_WIN_REG_NAME)
            except OSError:
                return False
    except OSError:
        return False
    val_l = str(val).lower()
    return "gc_tray_wrapper" in val_l or str(_REPO_ROOT.resolve()).lower() in val_l


def _windows_autostart_enable(command: str) -> None:
    import winreg

    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
        winreg.SetValueEx(key, _AUTOSTART_WIN_REG_NAME, 0, winreg.REG_SZ, command)


def _windows_autostart_disable() -> None:
    import winreg

    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
        try:
            winreg.DeleteValue(key, _AUTOSTART_WIN_REG_NAME)
        except FileNotFoundError:
            pass


def _macos_autostart_enabled() -> bool:
    if not _AUTOSTART_MAC_PLIST.is_file():
        return False
    try:
        with open(_AUTOSTART_MAC_PLIST, "rb") as f:
            data = plistlib.load(f)
        if data.get("Label") != _AUTOSTART_MAC_LABEL:
            return False
        args = data.get("ProgramArguments") or []
        return any("gc_tray_wrapper" in str(a) for a in args)
    except (OSError, TypeError, plistlib.InvalidFileException):
        return False


def _macos_launchctl(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["launchctl", *args],
        capture_output=True,
        text=True,
        check=check,
    )


def _macos_autostart_enable(argv: list[str]) -> None:
    _AUTOSTART_MAC_PLIST.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, object] = {
        "Label": _AUTOSTART_MAC_LABEL,
        "ProgramArguments": argv,
        "WorkingDirectory": str(_REPO_ROOT.resolve()),
        "RunAtLoad": True,
    }
    uid = str(os.getuid())
    domain = f"gui/{uid}"
    with open(_AUTOSTART_MAC_PLIST, "wb") as f:
        plistlib.dump(payload, f)
    _macos_launchctl("bootout", domain, _AUTOSTART_MAC_LABEL, check=False)
    _macos_launchctl("bootout", domain, str(_AUTOSTART_MAC_PLIST), check=False)
    r = _macos_launchctl("bootstrap", domain, str(_AUTOSTART_MAC_PLIST), check=False)
    if r.returncode != 0:
        r2 = _macos_launchctl("load", "-w", str(_AUTOSTART_MAC_PLIST), check=False)
        if r2.returncode != 0:
            msg = (r.stderr or r.stdout or r2.stderr or r2.stdout or "").strip()
            raise OSError(msg or "launchctl could not load the LaunchAgent (try: log out and back in).")


def _macos_autostart_disable() -> None:
    uid = str(os.getuid())
    domain = f"gui/{uid}"
    _macos_launchctl("bootout", domain, _AUTOSTART_MAC_LABEL, check=False)
    _macos_launchctl("bootout", domain, str(_AUTOSTART_MAC_PLIST), check=False)
    try:
        _AUTOSTART_MAC_PLIST.unlink(missing_ok=True)
    except OSError:
        pass


@dataclasses.dataclass
class Sample:
    ts: datetime
    cpu_percent: float  # % of total host logical CPU capacity (100% = all cores busy)
    ram_mb: float
    thread_count: int
    source: str = "native"  # "native" | "docker"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_listen_ports() -> tuple[int, int]:
    """Match restart-dev.ps1: HTTP from env chain, HTTPS from GROUND_CONTROL_HTTPS_PORT."""
    return gc_config.http_listen_port(), gc_config.https_listen_port()


def _web_management_browser_url() -> str:
    """``https://`` URL using configured TLS hostname (Security) and HTTPS listen port (saved state or env default)."""
    from app.security_settings import load_security_ui_state, primary_tls_hostname
    from app.url_helpers import https_admin_url_for_firewall

    st = load_security_ui_state()
    host = primary_tls_hostname(st).strip() or "127.0.0.1"
    if host in ("0.0.0.0", "::", "*"):
        host = "127.0.0.1"
    port = st.https_port if st.https_port is not None else gc_config.https_listen_port()
    return https_admin_url_for_firewall(host, port)


def _host_logical_cpu_count() -> int:
    """Logical CPUs on this machine (launcher host). Used to normalize CPU charts."""
    try:
        n = psutil.cpu_count(logical=True)
    except (OSError, RuntimeError):
        n = None
    return n if isinstance(n, int) and n > 0 else 1


def _cpu_percent_of_total_capacity(raw_core_style_percent: float) -> float:
    """
    psutil per-process and docker stats CPUPerc use “100% = one full logical core”
    (values may exceed 100% on multi-core). Convert to % of total host CPU capacity.
    """
    return raw_core_style_percent / _host_logical_cpu_count()


def _pids_listening_on_port(port: int) -> set[int]:
    pids: set[int] = set()
    try:
        for conn in psutil.net_connections(kind="inet"):
            if conn.status != psutil.CONN_LISTEN:
                continue
            if conn.laddr is None or conn.laddr.port != port:
                continue
            if conn.pid is not None:
                pids.add(conn.pid)
    except (psutil.AccessDenied, PermissionError):
        pass
    return pids


def _kill_process_tree(pid: int) -> None:
    try:
        proc = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return
    children = proc.children(recursive=True)
    for c in children:
        try:
            c.kill()
        except psutil.NoSuchProcess:
            pass
    try:
        proc.kill()
    except psutil.NoSuchProcess:
        pass


def _stop_listeners_on_ports(ports: tuple[int, ...]) -> None:
    for port in ports:
        for pid in _pids_listening_on_port(port):
            _kill_process_tree(pid)


def _windows_subprocess_creationflags(*, new_process_group: bool = False) -> int:
    """Hide console windows for CLI tools (docker, uv) when the launcher is windowed."""
    if sys.platform != "win32":
        return 0
    flags = int(getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if new_process_group:
        flags |= int(getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0))
    return flags


def _subprocess_no_window_kw() -> dict[str, int]:
    """Kwargs for ``subprocess.run`` / ``Popen`` on Windows only (``creationflags`` is invalid on POSIX)."""
    if sys.platform != "win32":
        return {}
    cf = _windows_subprocess_creationflags()
    return {"creationflags": cf} if cf else {}


def _git_remote_has_newer_commits(repo: Path) -> tuple[bool, str]:
    """``git fetch`` from ``origin`` and return whether ``@{upstream}`` is ahead of ``HEAD``.

    On failure (not a repo, no upstream, network error), returns ``(False, reason)``.
    """
    if not shutil.which("git"):
        return False, "git not on PATH"
    try:
        r = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "--is-inside-work-tree"],
            capture_output=True,
            text=True,
            timeout=15,
            **_subprocess_no_window_kw(),
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, str(e)
    if r.returncode != 0 or (r.stdout or "").strip().lower() != "true":
        return False, "not a git checkout"
    try:
        fe = subprocess.run(
            ["git", "-C", str(repo), "fetch", "origin", "--prune"],
            capture_output=True,
            text=True,
            timeout=_GIT_FETCH_TIMEOUT_SEC,
            **_subprocess_no_window_kw(),
        )
    except subprocess.TimeoutExpired:
        return False, "git fetch timed out"
    except OSError as e:
        return False, str(e)
    if fe.returncode != 0:
        err = (fe.stderr or fe.stdout or "").strip()
        return False, (err[:400] if err else "git fetch failed")
    ur = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--verify", "HEAD@{upstream}"],
        capture_output=True,
        text=True,
        timeout=15,
        **_subprocess_no_window_kw(),
    )
    if ur.returncode != 0:
        return False, "no upstream tracking branch"
    cnt = subprocess.run(
        ["git", "-C", str(repo), "rev-list", "--count", "HEAD..@{upstream}"],
        capture_output=True,
        text=True,
        timeout=15,
        **_subprocess_no_window_kw(),
    )
    if cnt.returncode != 0:
        return False, "could not compare to upstream"
    try:
        n = int((cnt.stdout or "").strip())
    except ValueError:
        return False, "bad rev-list output"
    return n > 0, ""


def _build_launch_command() -> list[str]:
    """Argv to start Ground Control (``main.py``). Cwd is always ``_REPO_ROOT`` when spawned.

    When frozen (``launcher.exe``), ``sys.executable`` is the launcher itself — never use it as
    the Python interpreter or each Start spawns another tray instance (console storm).
    """
    main_py = _REPO_ROOT / "main.py"
    if not main_py.is_file():
        raise FileNotFoundError(f"main.py not found under repository root: {_REPO_ROOT}")

    if getattr(sys, "frozen", False):
        for cand in (
            _REPO_ROOT / ".venv" / "Scripts" / "python.exe",
            _REPO_ROOT / ".venv" / "bin" / "python",
        ):
            if cand.is_file():
                return [str(cand), str(main_py)]
        py_exe = shutil.which("python") or shutil.which("python3") or shutil.which("py")
        if py_exe:
            return [py_exe, str(main_py)]
        if shutil.which("uv"):
            return ["uv", "run", "python", "main.py"]
        raise RuntimeError(
            "Cannot start Ground Control from the bundled launcher: no interpreter found. "
            f"Create {_REPO_ROOT / '.venv'} (e.g. uv sync), add Python to PATH, or install uv."
        )

    if shutil.which("uv"):
        return ["uv", "run", "python", "main.py"]
    return [sys.executable, str(main_py)]


try:
    _PIL_LANCZOS = Image.Resampling.LANCZOS
    _PIL_BICUBIC = Image.Resampling.BICUBIC
except AttributeError:
    _PIL_LANCZOS = Image.LANCZOS
    _PIL_BICUBIC = Image.BICUBIC

# Supersample status icons in PIL, then LANCZOS downscale for smooth edges (Tk Canvas is not anti-aliased).
_STATUS_ICON_SUPER = 5
_STATUS_ICON_DISPLAY = 32
# Hourglass status: drain then rotate 180° so sand returns to the top before looping.
_STATUS_HOURGLASS_DRAIN_FRAMES = 6
_STATUS_HOURGLASS_ROTATE_FRAMES = 6
_STATUS_HOURGLASS_ANIM_FRAME_COUNT = (
    _STATUS_HOURGLASS_DRAIN_FRAMES + _STATUS_HOURGLASS_ROTATE_FRAMES
)


def _status_y_transform(y: float, h: float, flip: bool) -> float:
    return h - y if flip else y


def _hg_x_left_upper(
    y: float, cx: float, y_top: float, y_waist: float, wx_top: float, wx_waist: float
) -> float:
    dy = y_waist - y_top
    if abs(dy) < 1e-6:
        return cx - wx_top
    t = (y - y_top) / dy
    return cx - (wx_top + (wx_waist - wx_top) * t)


def _hg_x_right_upper(
    y: float, cx: float, y_top: float, y_waist: float, wx_top: float, wx_waist: float
) -> float:
    dy = y_waist - y_top
    if abs(dy) < 1e-6:
        return cx + wx_top
    t = (y - y_top) / dy
    return cx + (wx_top + (wx_waist - wx_top) * t)


def _hg_x_left_lower(
    y: float, cx: float, y_waist: float, y_bot: float, wx_waist: float, wx_bot: float
) -> float:
    dy = y_bot - y_waist
    if abs(dy) < 1e-6:
        return cx - wx_waist
    t = (y - y_waist) / dy
    return cx - (wx_waist + (wx_bot - wx_waist) * t)


def _hg_x_right_lower(
    y: float, cx: float, y_waist: float, y_bot: float, wx_waist: float, wx_bot: float
) -> float:
    dy = y_bot - y_waist
    if abs(dy) < 1e-6:
        return cx + wx_waist
    t = (y - y_waist) / dy
    return cx + (wx_waist + (wx_bot - wx_waist) * t)


def _pil_line_smooth(
    d: ImageDraw.ImageDraw,
    xy: list[tuple[float, float]],
    *,
    fill: tuple[int, int, int, int],
    width: int,
) -> None:
    try:
        d.line(xy, fill=fill, width=width, joint="curve")
    except TypeError:
        d.line(xy, fill=fill, width=width)


def _render_status_running_rgba(
    out_w: int = _STATUS_ICON_DISPLAY,
    out_h: int = _STATUS_ICON_DISPLAY,
    *,
    supersample: int = _STATUS_ICON_SUPER,
) -> Image.Image:
    s = supersample
    W, H = out_w * s, out_h * s
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = W / 2.0, H / 2.0
    r = min(W, H) / 2.0 - 2.0 * s
    ow = max(1, int(1 * s))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(34, 197, 94, 255), outline=(21, 128, 61, 255), width=ow)
    lw = max(2, int(2.25 * s))
    _pil_line_smooth(
        d,
        [(cx - 4 * s, cy), (cx - 1 * s, cy + 3 * s), (cx + 5 * s, cy - 4 * s)],
        fill=(254, 252, 232, 255),
        width=lw,
    )
    return im.resize((out_w, out_h), _PIL_LANCZOS)


def _render_status_stopped_rgba(
    out_w: int = _STATUS_ICON_DISPLAY,
    out_h: int = _STATUS_ICON_DISPLAY,
    *,
    supersample: int = _STATUS_ICON_SUPER,
) -> Image.Image:
    s = supersample
    W, H = out_w * s, out_h * s
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = W / 2.0, H / 2.0
    r = min(W, H) / 2.0 - 2.0 * s
    ow = max(1, int(1 * s))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(220, 38, 38, 255), outline=(153, 27, 27, 255), width=ow)
    r2 = max(3.0 * s, r * 0.4)
    pts: list[tuple[float, float]] = []
    for k in range(8):
        ang = math.pi / 8.0 + k * math.pi / 4.0
        pts.append((cx + r2 * math.cos(ang), cy + r2 * math.sin(ang)))
    d.polygon(pts, fill=(254, 242, 242, 255), outline=(254, 242, 242, 255))
    return im.resize((out_w, out_h), _PIL_LANCZOS)


def _draw_hourglass_sand_and_outline(
    d: ImageDraw.ImageDraw,
    *,
    cx: float,
    cy: float,
    r: float,
    s: int,
    p: float,
    flip_y: bool,
    h_f: float,
) -> None:
    """Sand fill level p in [0,1] and frame outline; optional vertical mirror."""
    y_top = cy - r * 0.52
    y_waist = cy
    y_bot = cy + r * 0.52
    wx_top = r * 0.36
    wx_waist = r * 0.11
    wx_bot = wx_top

    def ty(y: float) -> float:
        return _status_y_transform(y, h_f, flip_y)

    outline = (113, 63, 18, 255)
    sand = (146, 64, 14, 255)
    lw = max(2, int(2 * s))

    y_surf = y_top + p * (y_waist - y_top)
    if p < 0.04:
        d.polygon(
            [
                (cx - wx_top, ty(y_top)),
                (cx + wx_top, ty(y_top)),
                (cx + wx_waist, ty(y_waist)),
                (cx - wx_waist, ty(y_waist)),
            ],
            fill=sand,
        )
    elif y_surf < y_waist - 0.5:
        xl = _hg_x_left_upper(y_surf, cx, y_top, y_waist, wx_top, wx_waist)
        xr = _hg_x_right_upper(y_surf, cx, y_top, y_waist, wx_top, wx_waist)
        d.polygon(
            [
                (xl, ty(y_surf)),
                (xr, ty(y_surf)),
                (cx + wx_waist, ty(y_waist)),
                (cx - wx_waist, ty(y_waist)),
            ],
            fill=sand,
        )

    y_bs = y_waist + p * (y_bot - y_waist)
    if p > 0.96:
        d.polygon(
            [
                (cx - wx_waist, ty(y_waist)),
                (cx + wx_waist, ty(y_waist)),
                (cx + wx_bot, ty(y_bot)),
                (cx - wx_bot, ty(y_bot)),
            ],
            fill=sand,
        )
    elif y_bs > y_waist + 0.5:
        xl2 = _hg_x_left_lower(y_bs, cx, y_waist, y_bot, wx_waist, wx_bot)
        xr2 = _hg_x_right_lower(y_bs, cx, y_waist, y_bot, wx_waist, wx_bot)
        d.polygon(
            [
                (cx - wx_waist, ty(y_waist)),
                (cx + wx_waist, ty(y_waist)),
                (xr2, ty(y_bs)),
                (xl2, ty(y_bs)),
            ],
            fill=sand,
        )

    yt, yw, yb = ty(y_top), ty(y_waist), ty(y_bot)
    d.line([(cx - wx_top, yt), (cx + wx_top, yt)], fill=outline, width=lw)
    d.line([(cx - wx_bot, yb), (cx + wx_bot, yb)], fill=outline, width=lw)
    _pil_line_smooth(d, [(cx - wx_top, yt), (cx - wx_waist, yw)], fill=outline, width=lw)
    _pil_line_smooth(d, [(cx + wx_top, yt), (cx + wx_waist, yw)], fill=outline, width=lw)
    _pil_line_smooth(d, [(cx - wx_waist, yw), (cx - wx_bot, yb)], fill=outline, width=lw)
    _pil_line_smooth(d, [(cx + wx_waist, yw), (cx + wx_bot, yb)], fill=outline, width=lw)


def _render_status_hourglass_rgba(
    frame: int,
    out_w: int = _STATUS_ICON_DISPLAY,
    out_h: int = _STATUS_ICON_DISPLAY,
    *,
    supersample: int = _STATUS_ICON_SUPER,
) -> Image.Image:
    """Yellow disk + hourglass: sand drains, then glass rotates 180° so sand is on top again.

    Uses flat top/bottom rims and a narrow waist so the silhouette reads as bulbs, not a diamond.
    """
    s = supersample
    W, H = int(out_w * s), int(out_h * s)
    h_f = float(H)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = W / 2.0, H / 2.0
    r = min(W, H) / 2.0 - 2.0 * s
    ow = max(1, int(1 * s))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(234, 179, 8, 255), outline=(202, 138, 4, 255), width=ow)

    n_drain = _STATUS_HOURGLASS_DRAIN_FRAMES
    n_rot = _STATUS_HOURGLASS_ROTATE_FRAMES
    total = _STATUS_HOURGLASS_ANIM_FRAME_COUNT
    sub = frame % total

    if sub < n_drain:
        denom = max(n_drain - 1, 1)
        p = min(sub, n_drain - 1) / denom
        _draw_hourglass_sand_and_outline(
            d, cx=cx, cy=cy, r=r, s=s, p=p, flip_y=False, h_f=h_f
        )
    else:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dl = ImageDraw.Draw(layer)
        _draw_hourglass_sand_and_outline(
            dl, cx=cx, cy=cy, r=r, s=s, p=1.0, flip_y=False, h_f=h_f
        )
        rf = sub - n_drain
        rden = max(n_rot - 1, 1)
        angle_deg = (min(rf, n_rot - 1) / rden) * 180.0
        layer = layer.rotate(
            angle_deg,
            resample=_PIL_BICUBIC,
            center=(cx, cy),
            expand=False,
            fillcolor=(0, 0, 0, 0),
        )
        im = Image.alpha_composite(im, layer)

    return im.resize((out_w, out_h), _PIL_LANCZOS)


def _make_dashboard_toolbar_photos(master: Any) -> tuple[Any, Any, Any, Any]:
    """Small RGBA icons for ttk toolbar; supersampled in PIL then LANCZOS downscaled for smooth edges."""
    out = 18
    s = 4
    W = out * s
    photos: list[Any] = []
    for kind in ("start", "stop", "restart", "rebuild"):
        im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        if kind == "start":
            d.polygon([(3 * s, 2 * s), (3 * s, 16 * s), (15 * s, 9 * s)], fill=(34, 197, 94, 255))
        elif kind == "stop":
            d.rounded_rectangle((3 * s, 3 * s, 15 * s, 15 * s), radius=2 * s, fill=(239, 68, 68, 255))
        elif kind == "restart":
            d.arc((2 * s, 2 * s, 16 * s, 16 * s), start=45, end=305, fill=(59, 130, 246, 255), width=max(2, int(2 * s)))
            d.polygon([(12 * s, 3 * s), (15 * s, 6 * s), (12 * s, 8 * s)], fill=(59, 130, 246, 255))
        else:
            # Restart arc (amber) + stacked lines = rebuild from source
            d.arc((2 * s, 2 * s, 16 * s, 16 * s), start=45, end=305, fill=(245, 158, 11, 255), width=max(2, int(2 * s)))
            d.polygon([(12 * s, 3 * s), (15 * s, 6 * s), (12 * s, 8 * s)], fill=(245, 158, 11, 255))
            lw = max(2, int(1.5 * s))
            d.line([(4 * s, 14 * s), (10 * s, 14 * s)], fill=(251, 191, 36, 255), width=lw)
            d.line([(5 * s, 11 * s), (10 * s, 11 * s)], fill=(252, 211, 77, 255), width=lw)
        im_small = im.resize((out, out), _PIL_LANCZOS)
        photos.append(ImageTk.PhotoImage(im_small, master=master))
    return photos[0], photos[1], photos[2], photos[3]


def _make_console_chrome_photos(master: Any, *, dark: bool) -> tuple[Any, Any]:
    """Clear + copy icons for the console tab (18px, matches dashboard toolbar style)."""
    out = 18
    s = 4
    W = out * s
    line = (203, 213, 225, 255) if dark else (51, 65, 85, 255)
    dim = (148, 163, 184, 255) if dark else (100, 116, 139, 255)
    lw = max(2, int(2 * s))

    im_clear = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    dc = ImageDraw.Draw(im_clear)
    # Wastebasket outline
    dc.line([(6 * s, 5 * s), (14 * s, 5 * s)], fill=line, width=lw)
    dc.line([(6 * s, 5 * s), (5 * s, 17 * s), (15 * s, 17 * s), (14 * s, 5 * s)], fill=line, width=lw)
    dc.line([(8 * s, 8 * s), (8 * s, 15 * s)], fill=dim, width=max(1, int(1.25 * s)))
    dc.line([(12 * s, 8 * s), (12 * s, 15 * s)], fill=dim, width=max(1, int(1.25 * s)))

    im_copy = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    dp = ImageDraw.Draw(im_copy)
    # Rear sheet
    dp.rounded_rectangle((3 * s, 6 * s, 12 * s, 16 * s), radius=s, outline=line, width=lw)
    # Front sheet
    dp.rounded_rectangle((6 * s, 3 * s, 15 * s, 13 * s), radius=s, outline=line, width=lw)
    dp.line([(9 * s, 6 * s), (13 * s, 6 * s)], fill=dim, width=max(1, int(s)))
    dp.line([(9 * s, 8 * s), (13 * s, 8 * s)], fill=dim, width=max(1, int(s)))

    c_small = im_clear.resize((out, out), _PIL_LANCZOS)
    p_small = im_copy.resize((out, out), _PIL_LANCZOS)
    return ImageTk.PhotoImage(c_small, master=master), ImageTk.PhotoImage(p_small, master=master)


def _make_tray_image(size: int = 64) -> Image.Image:
    img = Image.new("RGBA", (size, size), (24, 26, 32, 255))
    draw = ImageDraw.Draw(img)
    margin = size // 8
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=size // 8,
        outline=(80, 200, 120, 255),
        width=max(2, size // 16),
    )
    text = "GC"
    try:
        font = ImageFont.truetype("segoeui.ttf", size=int(size * 0.28))
    except OSError:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size=int(size * 0.28))
        except OSError:
            font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2, (size - th) / 2 - size // 32),
        text,
        fill=(120, 220, 160, 255),
        font=font,
    )
    return img


def system_prefers_dark_mode() -> bool:
    """Best-effort match to Windows / macOS app theme. Defaults to dark elsewhere."""
    if sys.platform == "win32":
        import winreg

        try:
            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                0,
                winreg.KEY_READ,
            ) as k:
                v, _ = winreg.QueryValueEx(k, "AppsUseLightTheme")
            return int(v) == 0
        except OSError:
            return True
    if sys.platform == "darwin":
        r = subprocess.run(
            ["defaults", "read", "-g", "AppleInterfaceStyle"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if r.returncode != 0:
            return False
        return "Dark" in r.stdout
    return True


@dataclasses.dataclass
class AnsiSgrState:
    fg_hex: str | None = None
    bold: bool = False


def _parse_sgr_nums(seq: str) -> list[int]:
    if not seq.strip():
        return [0]
    out: list[int] = []
    for part in seq.split(";"):
        part = part.strip()
        if part == "":
            out.append(0)
            continue
        try:
            out.append(int(part))
        except ValueError:
            nums = re.findall(r"\d+", part)
            out.append(int(nums[0]) if nums else 0)
    return out


def _ansi256_to_hex(n: int) -> str:
    n = max(0, min(255, int(n)))
    if n < 16:
        tbl = (
            "#000000",
            "#cd3131",
            "#0dbc79",
            "#e5e510",
            "#2472c8",
            "#bc3fbc",
            "#11a8cd",
            "#e5e5e5",
            "#666666",
            "#f14c4c",
            "#23d18b",
            "#f5f543",
            "#3b8eea",
            "#d670d6",
            "#29b8db",
            "#ffffff",
        )
        return tbl[n]
    if 16 <= n <= 231:
        v = n - 16

        def cv(x: int) -> int:
            return 0 if x == 0 else 55 + 40 * (x - 1)

        r, g, b = v // 36, (v // 6) % 6, v % 6
        return f"#{cv(r):02x}{cv(g):02x}{cv(b):02x}"
    gry = 8 + 10 * (n - 232)
    gry = max(0, min(255, gry))
    return f"#{gry:02x}{gry:02x}{gry:02x}"


def _ansi_standard_fg(code: int, *, dark_bg: bool) -> str:
    """Map SGR 30-37 / 90-97 to hex for dark or light console background."""
    if dark_bg:
        d30 = (
            "#71717a",
            "#f87171",
            "#4ade80",
            "#fbbf24",
            "#60a5fa",
            "#e879f9",
            "#22d3ee",
            "#f4f4f5",
        )
        d90 = (
            "#52525b",
            "#fca5a5",
            "#86efac",
            "#fde047",
            "#93c5fd",
            "#f0abfc",
            "#67e8f9",
            "#ffffff",
        )
    else:
        d30 = (
            "#18181b",
            "#b91c1c",
            "#15803d",
            "#a16207",
            "#1d4ed8",
            "#a21caf",
            "#0e7490",
            "#3f3f46",
        )
        d90 = (
            "#09090b",
            "#991b1b",
            "#166534",
            "#854d0e",
            "#1e40af",
            "#86198f",
            "#155e75",
            "#27272a",
        )
    if 30 <= code <= 37:
        return d30[code - 30]
    if 90 <= code <= 97:
        return d90[code - 90]
    return d30[7]


def _ensure_rgb_tag(tw: Any, rgb_tags: set[str], hex_color: str) -> str:
    key = hex_color.lower()
    name = f"cons_rgb_{key[1:]}"
    if name not in rgb_tags:
        tw.tag_configure(name, foreground=key)
        rgb_tags.add(name)
    return name


def _ansi_apply_params(
    params: list[int],
    st: AnsiSgrState,
    *,
    dark_console: bool,
) -> None:
    i = 0
    while i < len(params):
        p = params[i]
        if p == 0:
            st.fg_hex = None
            st.bold = False
            i += 1
            continue
        if p == 1:
            st.bold = True
            i += 1
            continue
        if p == 22:
            st.bold = False
            i += 1
            continue
        if p == 39:
            st.fg_hex = None
            i += 1
            continue
        if 30 <= p <= 37 or 90 <= p <= 97:
            st.fg_hex = _ansi_standard_fg(p, dark_bg=dark_console)
            i += 1
            continue
        if p == 38 and i + 1 < len(params):
            if params[i + 1] == 2 and i + 4 < len(params):
                r, g, b = params[i + 2], params[i + 3], params[i + 4]
                st.fg_hex = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
                i += 5
                continue
            if params[i + 1] == 5 and i + 2 < len(params):
                st.fg_hex = _ansi256_to_hex(params[i + 2])
                i += 3
                continue
        i += 1


def _ansi_tags_for_state(
    st: AnsiSgrState,
    tw: Any,
    rgb_tags: set[str],
) -> tuple[str, ...]:
    tags: list[str] = []
    if st.fg_hex:
        tags.append(_ensure_rgb_tag(tw, rgb_tags, st.fg_hex))
    else:
        tags.append("cons_fg_base")
    if st.bold:
        tags.append("cons_bold")
    return tuple(tags)


def ansi_feed(
    carry: str,
    chunk: str,
    st: AnsiSgrState,
    tw: Any,
    rgb_tags: set[str],
    *,
    dark_console: bool,
) -> tuple[list[tuple[str, tuple[str, ...]]], str]:
    """Split *chunk* (plus *carry*) into text segments with Tk text tags; honor ANSI SGR."""
    buf = carry + chunk
    out: list[tuple[str, tuple[str, ...]]] = []
    i = 0
    lit_start = 0
    n = len(buf)

    def flush_lit(end: int) -> None:
        nonlocal lit_start
        if end > lit_start:
            tags = _ansi_tags_for_state(st, tw, rgb_tags)
            out.append((buf[lit_start:end], tags))
        lit_start = end

    while i < n:
        if buf[i] == "\x1b":
            if i + 1 < n and buf[i + 1] == "[":
                flush_lit(i)
                j = i + 2
                p0 = j
                while j < n and not ("\x40" <= buf[j] <= "\x7e"):
                    j += 1
                if j >= n:
                    return out, buf[i:]
                cmd = buf[j]
                param_str = buf[p0:j]
                j += 1
                if cmd == "m":
                    _ansi_apply_params(_parse_sgr_nums(param_str), st, dark_console=dark_console)
                i = j
                lit_start = i
                continue
            if i + 1 < n and buf[i + 1] == "]":
                flush_lit(i)
                j = i + 2
                while j < n:
                    if buf[j] == "\x07":
                        j += 1
                        break
                    if buf[j] == "\x1b" and j + 1 < n and buf[j + 1] == "\\":
                        j += 2
                        break
                    j += 1
                i = j
                lit_start = i
                continue
            if i + 1 >= n:
                return out, buf[i:]
        i += 1
    flush_lit(n)
    return out, ""


class GcTrayApp:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._child: subprocess.Popen[str] | None = None
        self._docker_logs_proc: subprocess.Popen[str] | None = None
        self._starting = False
        self._stopping = False
        _st = _load_tray_settings()
        rm = str(_st.get("run_mode") or "native").lower()
        self._run_mode: str = "docker" if rm == "docker" else "native"
        self._metrics_stop = threading.Event()
        self._samples: collections.deque[Sample] = collections.deque(maxlen=1440)
        self._last_tree_pid: int | None = None

        import tkinter as tk

        import sv_ttk

        self._tk = tk
        self._ui_dark = system_prefers_dark_mode()
        self._root = tk.Tk()
        self._root.withdraw()
        self._root.title("Ground Control Launcher")
        sv_ttk.set_theme("dark" if self._ui_dark else "light")

        self._console_ansi_carry = ""
        self._ansi_state = AnsiSgrState()
        self._console_rgb_tags: set[str] = set()
        if sys.platform == "win32":
            self._console_mono = ("Consolas", 10)
        elif sys.platform == "darwin":
            self._console_mono = ("Menlo", 11)
        else:
            self._console_mono = ("Courier", 10)

        self._dash_win: tk.Toplevel | None = None
        self._notebook = None
        self._status_bar: Any = None
        self._status_bar_label: Any = None
        self._docker_uptime_cid: str | None = None
        self._docker_uptime_started_wall: float | None = None
        self._fig = None
        self._ax_main = None
        self._ax_spark_cpu = None
        self._ax_spark_ram = None
        self._ax_spark_thr = None
        self._chart_focus: str = "cpu"
        self._charts_stats_footer: Any = None
        self._stat_footer_widgets: dict[str, tuple[Any, Any]] = {}
        self._canvas = None
        self._console_text = None
        self._chart_job: str | None = None
        self._log_lines: collections.deque[str] = collections.deque(maxlen=25_000)
        self._log_lines_lock = threading.Lock()
        self._theme_user_pinned: bool = False
        self._btn_theme: Any = None
        self._btn_update: Any = None
        self._git_update_available: bool = False
        self._git_update_apply_in_progress: bool = False
        self._git_fetch_thread_running: bool = False
        self._git_fetch_lock = threading.Lock()
        self._git_update_poll_job: str | None = None
        self._lnk_web_mgmt: Any = None
        self._status_canvas: Any = None
        self._status_label: Any = None
        self._status_job: str | None = None
        self._status_anim_job: str | None = None
        self._status_anim_frame: int = 0
        self._status_photo: Any = None
        self._run_mode_var: Any = None
        self._autostart_var: Any = None
        self._settings_run_fr: Any = None
        self._docker_secrets_fr: Any = None
        self._settings_canvas: Any = None
        self._settings_scroll_inner: Any = None
        self._settings_vsb: Any = None
        self._settings_canvas_window_id: int | None = None
        self._settings_scroll_job: str | None = None
        self._docker_secrets_body: Any = None
        self._docker_secret_entries: dict[str, Any] = {}
        self._docker_secret_combos: dict[str, Any] = {}
        self._docker_secret_texts: dict[str, Any] = {}
        self._docker_secret_plain: dict[str, str] = {}
        self._docker_secret_reveal: dict[str, bool] = {}
        self._docker_cert_source_combo: Any = None
        self._docker_le_outer: Any = None
        self._docker_le_validation: Any = None
        self._docker_le_email: Any = None
        self._docker_le_plugin: Any = None
        self._docker_le_dns_inner: Any = None
        self._docker_le_cred_widgets: dict[str, Any] = {}
        self._docker_le_google_text: Any = None
        self._docker_le_google_reveal: bool = False
        self._docker_le_google_plain: str = ""
        self._docker_settings_ttk: Any = None
        self._docker_settings_fr: Any = None
        self._btn_delete_docker_image: Any = None
        self._photo_btn_start: Any = None
        self._photo_btn_stop: Any = None
        self._photo_btn_restart: Any = None
        self._photo_btn_rebuild: Any = None
        self._photo_console_clear: Any = None
        self._photo_console_copy: Any = None
        self._console_copy_tooltip_job: str | None = None
        self._console_copy_tooltip_win: Any = None
        self._btn_console_clear: Any = None
        self._btn_console_copy: Any = None
        self._docker_cid_cache_deadline: float = 0.0
        self._docker_cid_cached: str | None = None
        self._ports_in_use_cache_deadline: float = 0.0
        self._ports_in_use_cached: bool = False
        self._ports_in_use_cache_key: tuple[int, int] | None = None

        self._metrics_thread = threading.Thread(target=self._metrics_loop, name="gc-metrics", daemon=True)
        self._metrics_thread.start()

        image = _make_tray_image()
        self._icon = pystray.Icon(
            "ground_control_launcher",
            image,
            "Ground Control Launcher",
            menu=self._build_menu(),
        )

    # --- state for UI ---
    def _http_https_ports(self) -> tuple[int, int]:
        return _resolve_listen_ports()

    def _invalidate_runtime_probe_cache(self) -> None:
        self._docker_cid_cache_deadline = 0.0
        self._ports_in_use_cache_deadline = 0.0
        self._docker_uptime_cid = None
        self._docker_uptime_started_wall = None

    def _ports_in_use(self, *, force: bool = False) -> bool:
        http_p, https_p = self._http_https_ports()
        key = (http_p, https_p)
        now = time.monotonic()
        if (
            not force
            and now < self._ports_in_use_cache_deadline
            and self._ports_in_use_cache_key == key
        ):
            return self._ports_in_use_cached
        busy = bool(_pids_listening_on_port(http_p) or _pids_listening_on_port(https_p))
        self._ports_in_use_cached = busy
        self._ports_in_use_cache_key = key
        self._ports_in_use_cache_deadline = now + _RUNTIME_PROBE_CACHE_TTL_SEC
        return busy

    def _child_running(self) -> bool:
        if self._child is None:
            return False
        return self._child.poll() is None

    def _docker_container_id_uncached(self) -> str | None:
        argv = _docker_compose_argv("ps", "-q", _DOCKER_COMPOSE_SERVICE)
        if not argv or not _DOCKER_COMPOSE_FILE.is_file():
            return None
        try:
            r = subprocess.run(
                argv,
                cwd=_REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=90,
                **_subprocess_no_window_kw(),
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        cid = (r.stdout or "").strip().splitlines()
        return cid[0].strip() if cid else None

    def _docker_container_id(self, *, force: bool = False) -> str | None:
        now = time.monotonic()
        if not force and now < self._docker_cid_cache_deadline:
            return self._docker_cid_cached
        cid = self._docker_container_id_uncached()
        self._docker_cid_cached = cid
        self._docker_cid_cache_deadline = now + _RUNTIME_PROBE_CACHE_TTL_SEC
        return cid

    def _docker_container_running(self, *, force: bool = False) -> bool:
        return bool(self._docker_container_id(force=force))

    def _stop_docker_logs_pump(self) -> None:
        p = self._docker_logs_proc
        self._docker_logs_proc = None
        if p is None or p.poll() is not None:
            return
        try:
            p.terminate()
            p.wait(timeout=8)
        except (OSError, subprocess.TimeoutExpired):
            try:
                p.kill()
            except OSError:
                pass

    def _ensure_docker_log_stream(self) -> None:
        if self._docker_logs_proc is not None and self._docker_logs_proc.poll() is None:
            return
        if not self._docker_container_running():
            return
        argv = _docker_compose_argv("logs", "-f", _DOCKER_COMPOSE_SERVICE)
        if not argv:
            return
        try:
            self._docker_logs_proc = subprocess.Popen(
                argv,
                cwd=_REPO_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                text=True,
                bufsize=1,
                encoding="utf-8",
                errors="replace",
                **_subprocess_no_window_kw(),
            )
        except OSError as e:
            self._enqueue_log_note(f"\n=== Could not attach Docker logs: {e} ===\n")
            return
        threading.Thread(
            target=self._pump_child_log,
            args=(self._docker_logs_proc,),
            name="gc-docker-log",
            daemon=True,
        ).start()

    def _docker_stats_sample(self) -> tuple[float, float] | None:
        cid = self._docker_container_id()
        if not cid:
            return None
        try:
            r = subprocess.run(
                ["docker", "stats", cid, "--no-stream", "--format", "{{.CPUPerc}}\t{{.MemUsage}}"],
                cwd=_REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=90,
                **_subprocess_no_window_kw(),
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        line = (r.stdout or "").strip().splitlines()
        if not line:
            return None
        parts = line[0].split("\t", 1)
        if len(parts) < 2:
            return None
        cpu_s, mem_s = parts[0].strip(), parts[1].strip()
        try:
            cpu = float(cpu_s.rstrip("%").strip() or 0)
        except ValueError:
            cpu = 0.0
        ram = _parse_docker_mem_usage_mib(mem_s)
        cpu = _cpu_percent_of_total_capacity(cpu)
        return cpu, ram

    def _docker_up_thread(self, *, rebuild: bool) -> None:
        try:
            if not _docker_compose_argv():
                self._schedule(lambda: self._finish_docker_start(False, "docker compose not available (install Docker / add to PATH)."))
                return
            build_argv = _docker_compose_argv("build", _DOCKER_COMPOSE_SERVICE)
            up_recreate_argv = _docker_compose_argv("up", "-d", "--force-recreate", _DOCKER_COMPOSE_SERVICE)
            up_argv = _docker_compose_argv("up", "-d", _DOCKER_COMPOSE_SERVICE)
            if rebuild:
                if not build_argv or not up_recreate_argv:
                    self._schedule(lambda: self._finish_docker_start(False, "docker compose not available (install Docker / add to PATH)."))
                    return
            elif not up_argv:
                self._schedule(lambda: self._finish_docker_start(False, "docker compose not available (install Docker / add to PATH)."))
                return
            _ensure_docker_secrets_stub_files()
            try:
                pg_secret_text = (
                    (_DOCKER_SECRETS_DIR / "ground_control_postgres_password").read_text(encoding="utf-8").strip()
                )
            except OSError:
                pg_secret_text = ""
            if not pg_secret_text:
                self._schedule(
                    lambda: self._finish_docker_start(
                        False,
                        "PostgreSQL password is missing: open Settings → Docker secrets, set "
                        "'PostgreSQL password' (use Generate if needed), click Save Docker secrets, then start again. "
                        "Or add your password to .gc_docker_secrets/ground_control_postgres_password. "
                        "If the password is only in .env as GROUND_CONTROL_POSTGRES_PASSWORD or "
                        "GC_POSTGRES_PASSWORD, restart the Launcher once so it can copy it into that file.",
                    )
                )
                return
            env = os.environ.copy()
            env.update(_docker_compose_publish_env())
            run_kw: dict[str, Any] = {
                "cwd": _REPO_ROOT,
                "capture_output": True,
                "text": True,
                "env": env,
                **_subprocess_no_window_kw(),
            }
            b_tail = ""
            if rebuild:
                r_b = subprocess.run(build_argv, timeout=1200, **run_kw)
                b_tail = "\n".join(x for x in ((r_b.stdout or "").strip(), (r_b.stderr or "").strip()) if x)
                if r_b.returncode != 0:
                    msg = b_tail or ("docker compose build exited with code %s" % r_b.returncode)
                    self._schedule(lambda m=msg: self._finish_docker_start(False, m))
                    return
                up_use = up_recreate_argv
            else:
                up_use = up_argv
            r_u = subprocess.run(up_use, timeout=600, **run_kw)
            u_tail = "\n".join(x for x in ((r_u.stdout or "").strip(), (r_u.stderr or "").strip()) if x)
            ok = r_u.returncode == 0
            msg = "\n\n".join(x for x in (b_tail, u_tail) if x) if ok else (u_tail or b_tail or ("docker compose up exited with code %s" % r_u.returncode))
            self._schedule(lambda ok=ok, msg=msg: self._finish_docker_start(ok, msg))
        except Exception as e:  # noqa: BLE001
            self._schedule(lambda e=e: self._finish_docker_start(False, str(e)))

    def _finish_docker_start(self, ok: bool, message: str) -> None:
        self._invalidate_runtime_probe_cache()
        with self._lock:
            self._starting = False
        if ok:
            self._reset_console_ansi()
            self._enqueue_log_note(
                f"\n=== Ground Control (Docker) started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} "
                "(compose logs below) ===\n"
            )
            self._ensure_docker_log_stream()
        else:
            self._enqueue_log_note(f"\n=== Docker compose failed: {message} ===\n")
        self._refresh_dashboard_buttons()
        self._update_status_indicator()

    def _finish_docker_restart_only(self, ok: bool, message: str) -> None:
        self._invalidate_runtime_probe_cache()
        with self._lock:
            self._starting = False
        if ok:
            self._reset_console_ansi()
            self._enqueue_log_note(
                f"\n=== Docker service restarted at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} "
                "(compose logs below) ===\n"
            )
            self._ensure_docker_log_stream()
        else:
            self._enqueue_log_note(f"\n=== Docker compose restart failed: {message} ===\n")
        self._refresh_dashboard_buttons()
        self._update_status_indicator()

    def _docker_restart_thread(self) -> None:
        try:
            argv = _docker_compose_argv("restart", _DOCKER_COMPOSE_SERVICE)
            if not argv:
                self._schedule(
                    lambda: self._finish_docker_restart_only(False, "docker compose not available (install Docker / add to PATH).")
                )
                return
            env = os.environ.copy()
            env.update(_docker_compose_publish_env())
            r = subprocess.run(
                argv,
                cwd=_REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=300,
                env=env,
                **_subprocess_no_window_kw(),
            )
            tail = "\n".join(x for x in ((r.stdout or "").strip(), (r.stderr or "").strip()) if x)
            ok = r.returncode == 0
            msg = tail or ("docker compose restart exited with code %s" % r.returncode)
            self._schedule(lambda ok=ok, msg=msg: self._finish_docker_restart_only(ok, msg))
        except Exception as e:  # noqa: BLE001
            self._schedule(lambda e=e: self._finish_docker_restart_only(False, str(e)))

    def _service_running_for_status(self) -> bool:
        """True if HTTP/HTTPS listeners exist or our native child / compose service is up."""
        if self._child_running():
            return True
        if self._docker_container_running():
            return True
        return self._ports_in_use()

    def _status_tuple(self) -> tuple[str, str]:
        """Return (state_key, title) for the dashboard status label and icon."""
        with self._lock:
            stopping = self._stopping
            starting = self._starting
        if stopping:
            return "stopping", "Stopping"
        if starting:
            return "starting", "Starting"
        if self._service_running_for_status():
            return "running", "Running"
        return "stopped", "Stopped"

    def _cancel_status_animation(self) -> None:
        if self._status_anim_job is None:
            return
        try:
            self._root.after_cancel(self._status_anim_job)
        except self._tk.TclError:
            pass
        self._status_anim_job = None
        self._status_anim_frame = 0

    def _set_status_canvas_from_pil(self, pil_im: Image.Image) -> None:
        cnv = self._status_canvas
        if cnv is None:
            return
        try:
            if not cnv.winfo_exists():
                return
        except self._tk.TclError:
            return
        self._status_photo = ImageTk.PhotoImage(pil_im, master=self._root)
        cnv.delete("all")
        w, h = int(cnv["width"]), int(cnv["height"])
        cnv.create_image(w // 2, h // 2, image=self._status_photo, anchor="center")

    def _draw_status_static_icon(self, state_key: str) -> None:
        if state_key == "running":
            self._set_status_canvas_from_pil(_render_status_running_rgba())
        else:
            self._set_status_canvas_from_pil(_render_status_stopped_rgba())

    def _ensure_status_animation_running(self) -> None:
        if self._status_anim_job is not None:
            return
        self._status_animation_tick()

    def _status_animation_tick(self) -> None:
        self._status_anim_job = None
        if self._dash_win is None:
            return
        try:
            if not self._dash_win.winfo_exists() or not self._dash_win.winfo_viewable():
                return
        except self._tk.TclError:
            return
        sk, _ = self._status_tuple()
        if sk not in ("starting", "stopping"):
            return
        cnv = self._status_canvas
        if cnv is None:
            return
        try:
            if not cnv.winfo_exists():
                return
        except self._tk.TclError:
            return
        try:
            self._set_status_canvas_from_pil(_render_status_hourglass_rgba(self._status_anim_frame))
        except (self._tk.TclError, OSError, ValueError):
            pass
        self._status_anim_frame = (self._status_anim_frame + 1) % _STATUS_HOURGLASS_ANIM_FRAME_COUNT
        self._status_anim_job = self._root.after(120, self._status_animation_tick)

    def _docker_started_wall_for_uptime(self) -> float | None:
        cid = self._docker_container_id()
        if not cid:
            self._docker_uptime_cid = None
            self._docker_uptime_started_wall = None
            return None
        if cid == self._docker_uptime_cid and self._docker_uptime_started_wall is not None:
            return self._docker_uptime_started_wall
        try:
            r = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.StartedAt}}", cid],
                cwd=_REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=30,
                **_subprocess_no_window_kw(),
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        ts = _parse_docker_inspect_started_at((r.stdout or "").strip())
        if ts is None:
            return None
        self._docker_uptime_cid = cid
        self._docker_uptime_started_wall = ts
        return ts

    def _native_child_started_wall(self) -> float | None:
        with self._lock:
            c = self._child
            ok = c is not None and c.poll() is None
            pid = c.pid if ok else None
        if pid is None:
            return None
        try:
            return float(psutil.Process(pid).create_time())
        except (psutil.NoSuchProcess, psutil.AccessDenied, OSError, ValueError):
            return None

    def _uptime_start_wall(self) -> float | None:
        state_key, _ = self._status_tuple()
        if state_key in ("starting", "stopping"):
            return None
        if not self._service_running_for_status():
            return None
        if self._docker_container_running():
            return self._docker_started_wall_for_uptime()
        return self._native_child_started_wall()

    def _update_status_bar(self) -> None:
        lab = self._status_bar_label
        if lab is None:
            return
        try:
            if not lab.winfo_exists():
                return
        except self._tk.TclError:
            return
        state_key, _title = self._status_tuple()
        if state_key == "stopped":
            lab.configure(text="")
            return
        if state_key == "starting":
            lab.configure(text="Starting…")
            return
        if state_key == "stopping":
            lab.configure(text="Stopping…")
            return
        start = self._uptime_start_wall()
        if start is None:
            lab.configure(text="Running · uptime unavailable")
            return
        elapsed = max(0.0, time.time() - start)
        lab.configure(text=f"Uptime: {_format_uptime_duration(elapsed)}")

    def _update_status_indicator(self) -> None:
        cnv = self._status_canvas
        lab = self._status_label
        if cnv is None or lab is None:
            self._update_status_bar()
            return
        try:
            if not cnv.winfo_exists() or not lab.winfo_exists():
                self._update_status_bar()
                return
        except self._tk.TclError:
            self._update_status_bar()
            return
        state_key, title = self._status_tuple()
        lab.configure(text=title)
        if state_key in ("starting", "stopping"):
            self._ensure_status_animation_running()
        else:
            self._cancel_status_animation()
            self._draw_status_static_icon(state_key)
        self._update_status_bar()

    def _status_refresh_tick(self) -> None:
        if self._dash_win is not None:
            try:
                if self._dash_win.winfo_exists() and self._dash_win.winfo_viewable():
                    self._update_status_indicator()
            except self._tk.TclError:
                pass
        self._status_job = self._root.after(1000, self._status_refresh_tick)

    def _can_start(self) -> bool:
        with self._lock:
            if self._starting or self._stopping:
                return False
            mode = self._run_mode
            child_on = self._child_running()
        if mode == "docker":
            return not self._docker_container_running()
        return not child_on

    def _can_stop(self) -> bool:
        with self._lock:
            if self._starting or self._stopping:
                return False
        return self._child_running() or self._docker_container_running() or self._ports_in_use()

    def _can_restart(self) -> bool:
        with self._lock:
            if self._starting or self._stopping:
                return False
        return self._service_running_for_status()

    def _can_rebuild_docker(self) -> bool:
        with self._lock:
            if self._starting or self._stopping:
                return False
            if self._run_mode != "docker":
                return False
        if not _DOCKER_COMPOSE_FILE.is_file():
            return False
        return bool(_docker_compose_argv())

    def _build_menu(self) -> Menu:
        return Menu(
            MenuItem(_TRAY_MENU_OPEN, self._menu_open_charts, default=True),
            Menu.SEPARATOR,
            MenuItem(
                _TRAY_MENU_START,
                self._menu_start,
                enabled=lambda _: self._can_start(),
            ),
            MenuItem(
                _TRAY_MENU_STOP,
                self._menu_stop,
                enabled=lambda _: self._can_stop(),
            ),
            MenuItem(
                _TRAY_MENU_RESTART,
                self._menu_restart,
                enabled=lambda _: self._can_restart(),
            ),
            Menu.SEPARATOR,
            MenuItem(_TRAY_MENU_QUIT, self._menu_quit),
        )

    def _schedule(self, fn: object) -> None:
        self._root.after(0, fn)  # type: ignore[arg-type]

    def _git_update_poll_loop(self) -> None:
        self._start_git_update_check()
        self._git_update_poll_job = self._root.after(_GIT_UPDATE_POLL_INTERVAL_MS, self._git_update_poll_loop)

    def _start_git_update_check(self) -> None:
        if not shutil.which("git"):
            self._git_update_available = False
            self._schedule(self._apply_git_update_button_state)
            return
        with self._git_fetch_lock:
            if self._git_fetch_thread_running:
                return
            self._git_fetch_thread_running = True

        def work() -> None:
            has_newer, _detail = _git_remote_has_newer_commits(_REPO_ROOT)

            def done() -> None:
                with self._git_fetch_lock:
                    self._git_fetch_thread_running = False
                self._git_update_available = has_newer
                self._apply_git_update_button_state()

            self._schedule(done)

        threading.Thread(target=work, name="gc-git-fetch", daemon=True).start()

    def _apply_git_update_button_state(self) -> None:
        btn = self._btn_update
        if btn is None:
            return
        try:
            if not btn.winfo_exists():
                return
        except self._tk.TclError:
            return
        if self._git_update_apply_in_progress:
            btn.configure(state=self._tk.DISABLED)
            return
        btn.configure(
            state=(self._tk.NORMAL if self._git_update_available else self._tk.DISABLED),
        )

    def _launcher_build_argv(self) -> list[str] | None:
        ps1 = _REPO_ROOT / "scripts" / "build_launcher.ps1"
        if not ps1.is_file():
            return None
        if sys.platform == "win32":
            return [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(ps1),
            ]
        pwsh = shutil.which("pwsh")
        if not pwsh:
            return None
        return [pwsh, "-NoProfile", "-File", str(ps1)]

    def _launcher_build_popen_kw(self) -> dict[str, Any]:
        if sys.platform == "win32" and hasattr(subprocess, "CREATE_NEW_CONSOLE"):
            return {"creationflags": int(subprocess.CREATE_NEW_CONSOLE)}
        return {}

    def _on_update_click(self) -> None:
        if not self._git_update_available or self._git_update_apply_in_progress:
            return
        from tkinter import messagebox

        if self._dash_win is None:
            return
        if not messagebox.askokcancel(
            "Update launcher",
            "Pull the latest changes from GitHub and rebuild the launcher?\n\n"
            "The launcher will restart when the build finishes.",
            parent=self._dash_win,
        ):
            return
        self._git_update_apply_in_progress = True
        self._apply_git_update_button_state()

        def work() -> None:
            try:
                pull = subprocess.run(
                    ["git", "-C", str(_REPO_ROOT), "pull", "--ff-only"],
                    capture_output=True,
                    text=True,
                    timeout=300,
                    **_subprocess_no_window_kw(),
                )
            except (OSError, subprocess.TimeoutExpired) as e:

                def err_ui() -> None:
                    self._git_update_apply_in_progress = False
                    messagebox.showerror("Git pull failed", str(e), parent=self._dash_win)
                    self._apply_git_update_button_state()
                    self._start_git_update_check()

                self._schedule(err_ui)
                return

            def after_pull() -> None:
                if pull.returncode != 0:
                    self._git_update_apply_in_progress = False
                    err = (pull.stderr or pull.stdout or "").strip()
                    messagebox.showerror(
                        "Git pull failed",
                        (err[:1200] if err else "Unknown error"),
                        parent=self._dash_win,
                    )
                    self._apply_git_update_button_state()
                    self._start_git_update_check()
                    return
                self._enqueue_log_note("\n=== Pulled latest from GitHub; starting launcher build ===\n")
                argv = self._launcher_build_argv()
                if argv is None:
                    self._git_update_apply_in_progress = False
                    messagebox.showerror(
                        "Build",
                        "Could not run scripts/build_launcher.ps1 (missing script or PowerShell / pwsh).",
                        parent=self._dash_win,
                    )
                    self._apply_git_update_button_state()
                    return
                try:
                    subprocess.Popen(argv, cwd=str(_REPO_ROOT), **self._launcher_build_popen_kw())
                except OSError as e:
                    self._git_update_apply_in_progress = False
                    messagebox.showerror("Build", str(e), parent=self._dash_win)
                    self._apply_git_update_button_state()

            self._schedule(after_pull)

        threading.Thread(target=work, name="gc-git-pull", daemon=True).start()

    def _refresh_tray_menu(self) -> None:
        """pystray does not always re-run dynamic *enabled* callables when the menu opens; refresh explicitly."""
        icon = self._icon
        if icon is None:
            return
        try:
            icon.update_menu()
        except Exception:
            pass

    def _tray_menu_refresh_loop(self) -> None:
        self._root.after(2500, self._tray_menu_refresh_loop)
        self._refresh_tray_menu()

    def _menu_open_charts(self, icon: pystray.Icon | None = None, item: pystray.MenuItem | None = None) -> None:
        self._schedule(self._show_dashboard)

    def _menu_start(self, icon: pystray.Icon | None = None, item: pystray.MenuItem | None = None) -> None:
        self._schedule(self.start_gc)

    def _menu_stop(self, icon: pystray.Icon | None = None, item: pystray.MenuItem | None = None) -> None:
        self._schedule(self.stop_gc)

    def _menu_restart(self, icon: pystray.Icon | None = None, item: pystray.MenuItem | None = None) -> None:
        self._schedule(self.restart_gc)

    def _menu_quit(self, icon: pystray.Icon | None = None, item: pystray.MenuItem | None = None) -> None:
        self._schedule(self._quit_all)

    def _quit_all(self) -> None:
        """Exit the Ground Control Launcher process (stops Ground Control, removes the launcher icon, ends Tk)."""
        if self._git_update_poll_job is not None:
            try:
                self._root.after_cancel(self._git_update_poll_job)
            except self._tk.TclError:
                pass
            self._git_update_poll_job = None
        self.stop_gc()
        self._metrics_stop.set()
        if self._icon:
            self._icon.stop()
        self._root.quit()

    def _spawn_gc_locked(self) -> None:
        cmd = _build_launch_command()
        creationflags = 0
        preexec_fn = None
        if sys.platform == "win32":
            creationflags = _windows_subprocess_creationflags(new_process_group=True)
        else:
            preexec_fn = os.setsid  # type: ignore[assignment]

        env = os.environ.copy()
        env.setdefault("PYTHONUNBUFFERED", "1")
        env.setdefault("FORCE_COLOR", "1")
        env.pop("NO_COLOR", None)
        # Help libraries that gate ANSI on TERM (in addition to FORCE_COLOR).
        env.setdefault("TERM", "xterm-256color")

        self._child = subprocess.Popen(
            cmd,
            cwd=_REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            env=env,
            creationflags=creationflags,
            preexec_fn=preexec_fn,
            text=True,
            bufsize=1,
            encoding="utf-8",
            errors="replace",
        )
        self._last_tree_pid = self._child.pid
        threading.Thread(
            target=self._pump_child_log,
            args=(self._child,),
            name="gc-child-log",
            daemon=True,
        ).start()

    def _pump_child_log(self, proc: subprocess.Popen[str]) -> None:
        out = proc.stdout
        if out is None:
            return
        try:
            for line in iter(out.readline, ""):
                if self._metrics_stop.is_set():
                    break
                with self._log_lines_lock:
                    self._log_lines.append(line)
        finally:
            try:
                out.close()
            except OSError:
                pass

    def _enqueue_log_note(self, text: str) -> None:
        with self._log_lines_lock:
            self._log_lines.append(text)

    def _drain_log_queue_loop(self) -> None:
        self._root.after(100, self._drain_log_queue_loop)
        self._append_console_from_queue()

    def _append_console_from_queue(self) -> None:
        tw = self._console_text
        if tw is None:
            return
        dw = self._dash_win
        if dw is not None:
            try:
                if dw.winfo_exists() and not dw.winfo_viewable():
                    return
            except self._tk.TclError:
                pass
        try:
            if not tw.winfo_exists():
                return
        except self._tk.TclError:
            return
        with self._log_lines_lock:
            if not self._log_lines:
                return
            take = min(2000, len(self._log_lines))
            chunks = [self._log_lines.popleft() for _ in range(take)]
        dark_console = self._ui_dark
        for raw in chunks:
            segs, self._console_ansi_carry = ansi_feed(
                self._console_ansi_carry,
                raw,
                self._ansi_state,
                tw,
                self._console_rgb_tags,
                dark_console=dark_console,
            )
            for text, tags in segs:
                if text:
                    tw.insert(self._tk.END, text, tags)
        tw.see(self._tk.END)
        self._trim_console_if_needed(tw)

    def _trim_console_if_needed(self, tw: Any) -> None:
        try:
            end_line = int(str(tw.index("end-1c")).split(".", 1)[0])
        except (self._tk.TclError, ValueError):
            return
        if end_line > 12_000:
            tw.delete("1.0", "3000.0")

    def _reset_console_ansi(self) -> None:
        self._console_ansi_carry = ""
        self._ansi_state = AnsiSgrState()
        self._console_rgb_tags.clear()

    def _configure_console_chrome(self, tw: Any) -> None:
        if self._ui_dark:
            bg, ins = "#0a0a0a", "#fafafa"
            base_fg = "#e4e4e7"
            sel_bg, sel_fg = "#3f3f46", "#fafafa"
        else:
            bg, ins = "#ffffff", "#18181b"
            base_fg = "#27272a"
            sel_bg, sel_fg = "#e4e4e7", "#18181b"
        tw.configure(
            bg=bg,
            fg=base_fg,
            insertbackground=ins,
            selectbackground=sel_bg,
            selectforeground=sel_fg,
            highlightthickness=0,
            borderwidth=0,
            padx=6,
            pady=6,
        )
        tw.tag_configure("cons_fg_base", foreground=base_fg)
        mf = self._console_mono
        tw.tag_configure("cons_bold", font=(mf[0], mf[1], "bold"))

    def _refresh_console_chrome_icons(self) -> None:
        b_clear = self._btn_console_clear
        b_copy = self._btn_console_copy
        if b_clear is None or b_copy is None:
            return
        try:
            if not b_clear.winfo_exists() or not b_copy.winfo_exists():
                return
        except self._tk.TclError:
            return
        self._photo_console_clear, self._photo_console_copy = _make_console_chrome_photos(
            self._root, dark=self._ui_dark
        )
        try:
            b_clear.configure(image=self._photo_console_clear)
            b_copy.configure(image=self._photo_console_copy)
        except self._tk.TclError:
            pass

    def _cancel_console_copy_tooltip(self) -> None:
        if self._console_copy_tooltip_job is not None:
            try:
                self._root.after_cancel(self._console_copy_tooltip_job)
            except self._tk.TclError:
                pass
            self._console_copy_tooltip_job = None
        tip = self._console_copy_tooltip_win
        self._console_copy_tooltip_win = None
        if tip is not None:
            try:
                if tip.winfo_exists():
                    tip.destroy()
            except self._tk.TclError:
                pass

    def _show_console_copied_tooltip(self) -> None:
        self._cancel_console_copy_tooltip()
        anchor = self._btn_console_copy
        dw = self._dash_win
        tk = self._tk
        if anchor is None or dw is None:
            return
        try:
            if not anchor.winfo_exists() or not dw.winfo_exists():
                return
        except tk.TclError:
            return
        if self._ui_dark:
            bg_tip, fg_tip = "#27272a", "#f4f4f5"
        else:
            bg_tip, fg_tip = "#e4e4e7", "#18181b"
        tip = tk.Toplevel(dw)
        tip.wm_overrideredirect(True)
        try:
            tip.attributes("-topmost", True)
        except tk.TclError:
            pass
        tip.configure(bg=bg_tip)
        ff = self._charts_ui_font()
        lbl = tk.Label(
            tip,
            text="Copied to clipboard",
            bg=bg_tip,
            fg=fg_tip,
            font=(ff, 9),
            padx=10,
            pady=6,
        )
        lbl.pack()
        tip.update_idletasks()
        tw_w = tip.winfo_reqwidth()
        ax = anchor.winfo_rootx()
        ay = anchor.winfo_rooty()
        x = ax + anchor.winfo_width() - tw_w
        y = ay + anchor.winfo_height() + 4
        tip.geometry(f"+{max(0, int(x))}+{max(0, int(y))}")
        self._console_copy_tooltip_win = tip
        self._console_copy_tooltip_job = self._root.after(2600, self._cancel_console_copy_tooltip)

    def _bind_hover_tooltip(self, widget: Any, text: str) -> None:
        """Show a short-delay hover tooltip (theme-aware) anchored under ``widget``."""
        tk = self._tk
        state: dict[str, Any] = {"job": None, "win": None}

        def cancel(_e: Any = None) -> None:
            j = state["job"]
            if j is not None:
                try:
                    self._root.after_cancel(j)
                except tk.TclError:
                    pass
                state["job"] = None
            tw = state["win"]
            if tw is not None:
                try:
                    if tw.winfo_exists():
                        tw.destroy()
                except tk.TclError:
                    pass
                state["win"] = None

        def show() -> None:
            state["job"] = None
            try:
                if not widget.winfo_exists():
                    return
            except tk.TclError:
                return
            dw = self._dash_win
            if dw is None:
                return
            try:
                if not dw.winfo_exists():
                    return
            except tk.TclError:
                return
            if self._ui_dark:
                bg_tip, fg_tip = "#27272a", "#f4f4f5"
            else:
                bg_tip, fg_tip = "#e4e4e7", "#18181b"
            tip = tk.Toplevel(dw)
            tip.wm_overrideredirect(True)
            try:
                tip.attributes("-topmost", True)
            except tk.TclError:
                pass
            tip.configure(bg=bg_tip)
            ff = self._charts_ui_font()
            lbl = tk.Label(
                tip,
                text=text,
                bg=bg_tip,
                fg=fg_tip,
                font=(ff, 9),
                padx=10,
                pady=6,
                justify=tk.LEFT,
                wraplength=360,
            )
            lbl.pack()
            tip.update_idletasks()
            tw_w = tip.winfo_reqwidth()
            ax = widget.winfo_rootx()
            ay = widget.winfo_rooty()
            x = ax
            y = ay + widget.winfo_height() + 4
            sw = dw.winfo_screenwidth()
            if x + tw_w > sw - 8:
                x = max(0, sw - tw_w - 8)
            tip.geometry(f"+{max(0, int(x))}+{max(0, int(y))}")
            state["win"] = tip

        def on_enter(_e: Any = None) -> None:
            cancel()
            state["job"] = self._root.after(450, show)

        def on_leave(_e: Any = None) -> None:
            cancel()

        widget.bind("<Enter>", on_enter)
        widget.bind("<Leave>", on_leave)

    def _on_console_clear_click(self) -> None:
        tw = self._console_text
        if tw is None:
            return
        try:
            if not tw.winfo_exists():
                return
        except self._tk.TclError:
            return
        self._reset_console_ansi()
        with self._log_lines_lock:
            self._log_lines.clear()
        try:
            tw.delete("1.0", self._tk.END)
        except self._tk.TclError:
            pass

    def _on_console_copy_click(self) -> None:
        tw = self._console_text
        if tw is None:
            return
        try:
            if not tw.winfo_exists():
                return
            body = tw.get("1.0", "end-1c")
        except self._tk.TclError:
            return
        self._root.clipboard_clear()
        self._root.clipboard_append(body)
        try:
            self._root.update_idletasks()
        except self._tk.TclError:
            pass
        self._show_console_copied_tooltip()

    def _apply_os_theme(self, dark: bool) -> None:
        import sv_ttk

        self._ui_dark = dark
        sv_ttk.set_theme("dark" if dark else "light")
        if self._console_text is not None:
            try:
                if self._console_text.winfo_exists():
                    self._configure_console_chrome(self._console_text)
            except self._tk.TclError:
                pass
        self._refresh_console_chrome_icons()
        self._configure_dashboard_window()
        self._configure_notebook_tabs()
        self._style_charts_stats_footer()
        self._style_web_management_link()
        self._apply_figure_chrome()
        self._update_theme_toggle_button()
        self._redraw_charts_if_visible()

    def _dashboard_window_bg(self) -> str:
        return "#1c1c1e" if self._ui_dark else "#f3f3f5"

    def _configure_dashboard_window(self) -> None:
        w = self._dash_win
        if w is None:
            return
        try:
            if not w.winfo_exists():
                return
        except self._tk.TclError:
            return
        bg = self._dashboard_window_bg()
        w.configure(bg=bg)
        try:
            w.configure(highlightbackground=bg, highlightcolor=bg, highlightthickness=1)
        except self._tk.TclError:
            pass
        if self._status_canvas is not None:
            try:
                if self._status_canvas.winfo_exists():
                    self._status_canvas.configure(bg=bg)
            except self._tk.TclError:
                pass
        if self._settings_canvas is not None:
            try:
                if self._settings_canvas.winfo_exists():
                    self._settings_canvas.configure(bg=bg)
            except self._tk.TclError:
                pass
        self._style_web_management_link()

    def _configure_notebook_tabs(self) -> None:
        from tkinter import ttk

        st = ttk.Style()
        nb_bg = self._dashboard_window_bg()
        if self._ui_dark:
            tab_sel = "#ffffff"
            tab_fg = "#f4f4f5"
            tab_dim = "#a8a8b0"
        else:
            tab_sel = "#0f172a"
            tab_fg = "#334155"
            tab_dim = "#64748b"
        tab_map = [
            ("selected", tab_sel),
            ("active", tab_fg),
            ("!selected", tab_dim),
        ]
        bg_map = [("selected", nb_bg), ("!selected", nb_bg), ("active", nb_bg)]
        for nb_name, tab_name in (
            ("TNotebook", "TNotebook.Tab"),
            ("SunValley.TNotebook", "SunValley.TNotebook.Tab"),
        ):
            try:
                st.configure(nb_name, background=nb_bg)
                st.configure(tab_name, background=nb_bg, padding=[12, 5])
                st.map(tab_name, foreground=tab_map, background=bg_map)
            except self._tk.TclError:
                continue

    def _update_theme_toggle_button(self) -> None:
        btn = self._btn_theme
        if btn is None:
            return
        try:
            if not btn.winfo_exists():
                return
        except self._tk.TclError:
            return
        glyph = "\u2600" if self._ui_dark else "\u263e"
        btn.configure(text=glyph)

    def _style_web_management_link(self) -> None:
        from tkinter import font as tkfont

        w = self._lnk_web_mgmt
        if w is None:
            return
        try:
            if not w.winfo_exists():
                return
        except self._tk.TclError:
            return
        bg = self._dashboard_window_bg()
        fg = "#60a5fa" if self._ui_dark else "#2563eb"
        fn = tkfont.Font(family=self._charts_ui_font(), size=9, underline=True)
        try:
            w.configure(bg=bg, fg=fg, font=fn)
        except self._tk.TclError:
            pass

    def _on_web_management_click(self, _event: Any = None) -> None:
        try:
            webbrowser.open(_web_management_browser_url())
        except OSError:
            pass

    def _on_theme_toggle_click(self) -> None:
        self._theme_user_pinned = True
        self._apply_os_theme(not self._ui_dark)

    def _on_theme_context_menu(self, event: Any) -> None:
        m = self._tk.Menu(self._dash_win, tearoff=0)
        m.add_command(label="Use system appearance", command=self._use_system_appearance)
        try:
            m.tk_popup(event.x_root, event.y_root)
        finally:
            m.grab_release()

    def _use_system_appearance(self) -> None:
        self._theme_user_pinned = False
        try:
            self._apply_os_theme(system_prefers_dark_mode())
        except OSError:
            pass

    def _sync_os_theme_on_show(self) -> None:
        if self._theme_user_pinned:
            return
        try:
            want = system_prefers_dark_mode()
        except OSError:
            return
        if want != self._ui_dark:
            self._apply_os_theme(want)

    def _poll_os_theme_loop(self) -> None:
        self._root.after(12000, self._poll_os_theme_loop)
        if self._theme_user_pinned:
            return
        try:
            want = system_prefers_dark_mode()
        except OSError:
            return
        if want != self._ui_dark:
            self._schedule(lambda w=want: self._apply_os_theme(w))

    def start_gc(self) -> None:
        with self._lock:
            if self._starting or self._stopping:
                return
            mode = self._run_mode
            if mode == "native" and self._child_running():
                return
        if mode == "docker":
            with self._lock:
                self._starting = True
            self._refresh_dashboard_buttons()
            self._update_status_indicator()
            self._enqueue_log_note("\n=== Starting Ground Control (Docker, compose up — no image build) ===\n")
            threading.Thread(
                target=lambda: self._docker_up_thread(rebuild=False),
                name="gc-docker-up",
                daemon=True,
            ).start()
            return

        with self._lock:
            self._starting = True
        started = False
        try:
            http_p, https_p = self._http_https_ports()
            _stop_listeners_on_ports((http_p, https_p))
            with self._lock:
                self._spawn_gc_locked()
            started = True
        except OSError as e:
            self._enqueue_log_note(f"\n=== Failed to start Ground Control: {e} ===\n")
        finally:
            with self._lock:
                self._starting = False
        if started:
            self._reset_console_ansi()
            self._enqueue_log_note(
                f"\n=== Ground Control started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} "
                "(output captured below) ===\n"
            )
        self._invalidate_runtime_probe_cache()
        self._refresh_dashboard_buttons()
        self._update_status_indicator()

    def stop_gc(self) -> None:
        with self._lock:
            if self._starting:
                return
            mode = self._run_mode
            child = self._child
            self._child = None
            self._stopping = True
        self._stop_docker_logs_pump()
        self._enqueue_log_note("\n=== Stopping Ground Control ===\n")
        http_p, https_p = self._http_https_ports()
        try:
            if mode == "docker":
                argv = _docker_compose_argv("stop", _DOCKER_COMPOSE_SERVICE)
                if argv:
                    try:
                        subprocess.run(
                            argv,
                            cwd=_REPO_ROOT,
                            capture_output=True,
                            text=True,
                            timeout=180,
                            **_subprocess_no_window_kw(),
                        )
                    except (OSError, subprocess.TimeoutExpired):
                        pass
            else:
                if child is not None and child.poll() is None:
                    _kill_process_tree(child.pid)
                    try:
                        child.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        pass
                _stop_listeners_on_ports((http_p, https_p))
        finally:
            self._last_tree_pid = None
            with self._lock:
                self._stopping = False
        self._invalidate_runtime_probe_cache()
        self._refresh_dashboard_buttons()
        self._update_status_indicator()

    def restart_gc(self) -> None:
        """Native: stop then start. Docker: ``docker compose restart`` (no image rebuild)."""
        with self._lock:
            if self._starting or self._stopping:
                return
            mode = self._run_mode
        if mode == "docker":
            if not self._docker_container_running(force=True):
                return
            with self._lock:
                self._starting = True
            self._refresh_dashboard_buttons()
            self._update_status_indicator()
            self._enqueue_log_note("\n=== Docker compose restart (no image rebuild) ===\n")
            threading.Thread(target=self._docker_restart_thread, name="gc-docker-restart", daemon=True).start()
            return
        self.stop_gc()
        self.start_gc()

    def docker_rebuild_gc(self) -> None:
        """Docker only: ``docker compose build`` then ``up -d --force-recreate``."""
        with self._lock:
            if self._starting or self._stopping:
                return
            if self._run_mode != "docker":
                return
        with self._lock:
            self._starting = True
        self._refresh_dashboard_buttons()
        self._update_status_indicator()
        self._enqueue_log_note("\n=== Rebuilding Docker image and recreating container ===\n")
        threading.Thread(
            target=lambda: self._docker_up_thread(rebuild=True),
            name="gc-docker-rebuild",
            daemon=True,
        ).start()

    def _tree_metrics(self, root_pid: int) -> tuple[float, float, int]:
        """Return (cpu % of total host capacity, rss_mb sum, thread count) for root and descendants."""
        try:
            root = psutil.Process(root_pid)
        except psutil.NoSuchProcess:
            return 0.0, 0.0, 0
        procs = [root, *root.children(recursive=True)]
        rss = 0
        threads = 0
        for p in procs:
            try:
                rss += p.memory_info().rss
                threads += p.num_threads()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        for p in procs:
            try:
                p.cpu_percent(interval=None)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        time.sleep(0.2)
        cpu = 0.0
        for p in procs:
            try:
                cpu += p.cpu_percent(interval=None)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        cpu = _cpu_percent_of_total_capacity(cpu)
        return cpu, rss / (1024 * 1024), threads

    def _metrics_target_pid(self) -> int | None:
        with self._lock:
            ch = self._child
            if ch is not None and ch.poll() is None:
                return ch.pid
            if self._last_tree_pid is not None:
                return self._last_tree_pid
        for p in _resolve_listen_ports():
            pids = _pids_listening_on_port(p)
            if pids:
                return next(iter(pids))
        return None

    def _metrics_loop(self) -> None:
        while not self._metrics_stop.wait(timeout=60.0):
            with self._lock:
                mode = self._run_mode
            if mode == "docker" and self._docker_container_running():
                stats = self._docker_stats_sample()
                if stats is not None:
                    cpu, ram = stats
                    with self._lock:
                        self._samples.append(Sample(_utcnow(), cpu, ram, 0, source="docker"))
                    self._schedule(self._redraw_charts_if_visible)
                continue
            pid = self._metrics_target_pid()
            if pid is None:
                continue
            cpu, ram, thr = self._tree_metrics(pid)
            with self._lock:
                self._samples.append(Sample(_utcnow(), cpu, ram, thr, source="native"))
            self._schedule(self._redraw_charts_if_visible)

    def _show_dashboard(self) -> None:
        if self._dash_win is not None and self._dash_win.winfo_exists():
            self._sync_os_theme_on_show()
            self._dash_win.deiconify()
            self._dash_win.lift()
            self._dash_win.focus_force()
            self._start_git_update_check()
            self._refresh_dashboard_buttons()
            self._update_status_indicator()
            if autostart_supported() and self._autostart_var is not None:
                self._autostart_var.set(_autostart_enabled())
            if self._run_mode_var is not None:
                with self._lock:
                    self._run_mode_var.set(self._run_mode)
                self._sync_settings_docker_section()
            if self._status_job is None:
                self._status_job = self._root.after(0, self._status_refresh_tick)
            with self._lock:
                mode_show = self._run_mode
            if mode_show == "docker" and self._docker_container_running():
                self._ensure_docker_log_stream()
            return

        from tkinter import ttk

        self._sync_os_theme_on_show()

        win = self._tk.Toplevel(self._root)
        self._dash_win = win
        win.title("Ground Control Launcher — Dashboard")
        win.geometry("860x720")
        win.protocol("WM_DELETE_WINDOW", self._on_dashboard_wm_delete)

        top_bar = ttk.Frame(win)
        top_bar.pack(side=self._tk.TOP, fill=self._tk.X, padx=10, pady=(10, 4))
        left_top = ttk.Frame(top_bar)
        left_top.pack(side=self._tk.LEFT, fill=self._tk.X, expand=True)

        status_wrap = ttk.Frame(left_top)
        status_wrap.pack(side=self._tk.LEFT, padx=(0, 10))
        self._status_canvas = self._tk.Canvas(
            status_wrap,
            width=_STATUS_ICON_DISPLAY,
            height=_STATUS_ICON_DISPLAY,
            highlightthickness=0,
            borderwidth=0,
            bg=self._dashboard_window_bg(),
        )
        self._status_canvas.pack(side=self._tk.LEFT, padx=(0, 6))
        self._status_label = ttk.Label(status_wrap, text="Stopped")
        self._status_label.pack(side=self._tk.LEFT)

        btn_row = ttk.Frame(left_top)
        btn_row.pack(side=self._tk.LEFT, fill=self._tk.X, expand=True)
        theme_wrap = ttk.Frame(top_bar)
        theme_wrap.pack(side=self._tk.RIGHT)
        self._lnk_web_mgmt = self._tk.Label(
            theme_wrap,
            text="Web management",
            cursor="hand2",
        )
        self._lnk_web_mgmt.pack(side=self._tk.LEFT, padx=(0, 10))
        self._lnk_web_mgmt.bind("<Button-1>", self._on_web_management_click)
        self._style_web_management_link()
        self._btn_theme = ttk.Button(
            theme_wrap,
            text="\u2600",
            width=3,
            command=self._on_theme_toggle_click,
        )
        self._btn_theme.pack(side=self._tk.RIGHT)
        self._btn_theme.bind("<Button-3>", self._on_theme_context_menu)
        self._btn_theme.bind("<Control-Button-1>", self._on_theme_context_menu)
        self._btn_update = ttk.Button(
            theme_wrap,
            text="Update",
            command=self._on_update_click,
            state=self._tk.DISABLED,
        )
        self._btn_update.pack(side=self._tk.RIGHT, padx=(0, 6))
        self._bind_hover_tooltip(self._btn_update, _TOOLTIP_UPDATE)

        if self._photo_btn_start is None:
            (
                self._photo_btn_start,
                self._photo_btn_stop,
                self._photo_btn_restart,
                self._photo_btn_rebuild,
            ) = _make_dashboard_toolbar_photos(self._root)
        self._btn_start = ttk.Button(
            btn_row,
            text="Start",
            image=self._photo_btn_start,
            compound=self._tk.LEFT,
            command=self.start_gc,
        )
        self._btn_stop = ttk.Button(
            btn_row,
            text="Stop",
            image=self._photo_btn_stop,
            compound=self._tk.LEFT,
            command=self.stop_gc,
        )
        self._btn_restart = ttk.Button(
            btn_row,
            text="Restart",
            image=self._photo_btn_restart,
            compound=self._tk.LEFT,
            command=self.restart_gc,
        )
        self._btn_rebuild = ttk.Button(
            btn_row,
            text="Restart+rebuild",
            image=self._photo_btn_rebuild,
            compound=self._tk.LEFT,
            command=self.docker_rebuild_gc,
        )
        for b in (self._btn_start, self._btn_stop, self._btn_restart, self._btn_rebuild):
            b.pack(side=self._tk.LEFT, padx=(0, 6))
        self._bind_hover_tooltip(self._btn_restart, _TOOLTIP_RESTART)
        self._bind_hover_tooltip(self._btn_rebuild, _TOOLTIP_DOCKER_REBUILD)

        if self._run_mode_var is None:
            self._run_mode_var = self._tk.StringVar(value=self._run_mode)
            self._run_mode_var.trace_add("write", lambda *_a: self._sync_settings_docker_section())
        mode_fr = ttk.Frame(btn_row)
        mode_fr.pack(side=self._tk.LEFT, padx=(12, 0))
        rb_native = ttk.Radiobutton(
            mode_fr,
            text="Native",
            value="native",
            variable=self._run_mode_var,
            command=self._on_run_mode_changed,
        )
        rb_native.pack(side=self._tk.LEFT, padx=(0, 4))
        rb_docker = ttk.Radiobutton(
            mode_fr,
            text="Docker",
            value="docker",
            variable=self._run_mode_var,
            command=self._on_run_mode_changed,
        )
        rb_docker.pack(side=self._tk.LEFT)
        self._bind_hover_tooltip(rb_native, _RUN_MODE_TOOLTIP_NATIVE)
        self._bind_hover_tooltip(rb_docker, _RUN_MODE_TOOLTIP_DOCKER)

        notebook = ttk.Notebook(win)
        self._notebook = notebook

        charts_tab = ttk.Frame(notebook)
        console_tab = ttk.Frame(notebook)
        settings_tab = ttk.Frame(notebook)
        notebook.add(charts_tab, text="Charts")
        notebook.add(console_tab, text="Console")
        notebook.add(settings_tab, text="Settings")
        notebook.bind("<<NotebookTabChanged>>", self._on_notebook_tab_changed)

        self._status_bar = ttk.Frame(win)
        self._status_bar_label = ttk.Label(self._status_bar, text="", anchor="w")
        self._status_bar_label.pack(side=self._tk.LEFT, fill=self._tk.X, padx=6, pady=4)
        status_sep = ttk.Separator(win, orient="horizontal")
        self._status_bar.pack(side=self._tk.BOTTOM, fill=self._tk.X, padx=8, pady=(0, 8))
        status_sep.pack(side=self._tk.BOTTOM, fill=self._tk.X, padx=8, pady=0)
        notebook.pack(side=self._tk.TOP, fill=self._tk.BOTH, expand=True, padx=8, pady=(0, 6))

        settings_pad = ttk.Frame(settings_tab)
        settings_pad.pack(fill=self._tk.BOTH, expand=True, padx=4, pady=4)
        bg_set = self._dashboard_window_bg()
        sc_canvas = self._tk.Canvas(settings_pad, highlightthickness=0, bg=bg_set)
        settings_vsb = ttk.Scrollbar(settings_pad, orient="vertical", command=sc_canvas.yview)
        sc_canvas.configure(yscrollcommand=settings_vsb.set)
        settings_inner = ttk.Frame(sc_canvas)
        settings_win_id = sc_canvas.create_window((0, 0), window=settings_inner, anchor="nw")
        self._settings_canvas = sc_canvas
        self._settings_scroll_inner = settings_inner
        self._settings_canvas_window_id = settings_win_id
        self._settings_vsb = settings_vsb

        def _inner_cfg(_e: Any = None) -> None:
            self._queue_settings_scroll_sync()

        settings_inner.bind("<Configure>", _inner_cfg)
        sc_canvas.bind("<Configure>", self._settings_on_canvas_configure)
        sc_canvas.pack(side=self._tk.LEFT, fill=self._tk.BOTH, expand=True)
        settings_vsb.pack(side=self._tk.RIGHT, fill=self._tk.Y)

        def _set_canvas_wheel(e: Any) -> None:
            c = self._settings_canvas
            if c is None:
                return
            try:
                if sys.platform == "darwin":
                    c.yview_scroll(int(-1 * e.delta), "units")
                else:
                    c.yview_scroll(int(-1 * (e.delta / 120)), "units")
            except self._tk.TclError:
                pass

        def _set_canvas_wheel_lx(e: Any) -> None:
            c = self._settings_canvas
            if c is None:
                return
            try:
                c.yview_scroll(-1 if e.num == 4 else 1, "units")
            except self._tk.TclError:
                pass

        sc_canvas.bind("<MouseWheel>", _set_canvas_wheel)
        if sys.platform.startswith("linux"):
            sc_canvas.bind("<Button-4>", _set_canvas_wheel_lx)
            sc_canvas.bind("<Button-5>", _set_canvas_wheel_lx)

        settings_outer = ttk.Frame(settings_inner)
        settings_outer.pack(fill=self._tk.X, expand=False, padx=8, pady=8)
        run_fr = ttk.LabelFrame(settings_outer, text="How Ground Control runs")
        run_fr.pack(fill=self._tk.X, pady=(0, 12))
        self._settings_run_fr = run_fr
        ttk.Label(
            run_fr,
            text="Requires Docker Desktop / Engine and docker compose. Stop Ground Control before switching.",
            wraplength=640,
        ).pack(anchor="w", padx=8, pady=8)

        self._build_docker_secrets_section(settings_outer, ttk)

        self._docker_settings_fr = ttk.LabelFrame(settings_outer, text="Docker image")
        ttk.Label(
            self._docker_settings_fr,
            text=(
                f"Stop the container if it is running, remove that container, and delete the image "
                f"'{_DOCKER_LOCAL_IMAGE}'. Named volumes (database files on the Docker volume) are not removed. "
                "Starting again will rebuild the image."
            ),
            wraplength=640,
        ).pack(anchor="w", padx=8, pady=(8, 4))
        self._btn_delete_docker_image = ttk.Button(
            self._docker_settings_fr,
            text="Delete Docker image…",
            command=self._on_delete_docker_image_click,
        )
        self._btn_delete_docker_image.pack(anchor="w", padx=8, pady=(0, 8))

        if autostart_supported():
            auto_fr = ttk.LabelFrame(settings_outer, text="Login")
            auto_fr.pack(fill=self._tk.X, pady=(0, 8))
            self._autostart_var = self._tk.BooleanVar(value=_autostart_enabled())
            auto_label = "Start at login"
            ttk.Checkbutton(
                auto_fr,
                text=auto_label,
                variable=self._autostart_var,
                command=self._on_autostart_toggle,
            ).pack(anchor="w", padx=8, pady=8)
        else:
            self._autostart_var = None

        self._sync_settings_docker_section()
        self._settings_bind_mousewheel_recursive(settings_inner)
        self._root.after_idle(self._flush_settings_scroll_sync)

        chart_outer = ttk.Frame(charts_tab)
        chart_outer.pack(fill=self._tk.BOTH, expand=True, padx=2, pady=2)

        self._fig = plt.figure(figsize=(7.2, 4.1), dpi=88)
        gs = gridspec.GridSpec(
            3,
            2,
            figure=self._fig,
            width_ratios=[0.22, 1.0],
            height_ratios=[1, 1, 1],
            wspace=0.16,
            hspace=0.14,
            left=0.05,
            right=0.99,
            top=0.91,
            bottom=0.11,
        )
        self._ax_spark_cpu = self._fig.add_subplot(gs[0, 0])
        self._ax_spark_ram = self._fig.add_subplot(gs[1, 0])
        self._ax_spark_thr = self._fig.add_subplot(gs[2, 0])
        self._ax_main = self._fig.add_subplot(gs[:, 1])
        self._chart_focus = "cpu"
        self._apply_figure_chrome()
        self._charts_stats_footer = self._tk.Frame(chart_outer)
        # Pack footer to BOTTOM first so it stays visible; canvas packed after only gets
        # remaining height (avoids mpl min height pushing stats off a 640px-tall window).
        self._charts_stats_footer.pack(side=self._tk.BOTTOM, fill=self._tk.X, pady=(4, 2))
        self._build_charts_stats_footer()
        self._canvas = FigureCanvasTkAgg(self._fig, master=chart_outer)
        self._canvas.get_tk_widget().pack(side=self._tk.TOP, fill=self._tk.BOTH, expand=True)
        self._canvas.mpl_connect("button_press_event", self._on_chart_canvas_click)

        console_wrap = ttk.Frame(console_tab)
        console_wrap.pack(fill=self._tk.BOTH, expand=True, padx=6, pady=6)
        console_wrap.grid_rowconfigure(1, weight=1)
        console_wrap.grid_columnconfigure(0, weight=1)

        chrome_fr = ttk.Frame(console_wrap)
        chrome_fr.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 4))
        chrome_inner = ttk.Frame(chrome_fr)
        chrome_inner.pack(side=self._tk.RIGHT)

        self._photo_console_clear, self._photo_console_copy = _make_console_chrome_photos(
            self._root, dark=self._ui_dark
        )
        self._btn_console_clear = ttk.Button(
            chrome_inner,
            image=self._photo_console_clear,
            width=2,
            command=self._on_console_clear_click,
        )
        self._btn_console_clear.pack(side=self._tk.LEFT, padx=(0, 4))
        self._btn_console_copy = ttk.Button(
            chrome_inner,
            image=self._photo_console_copy,
            width=2,
            command=self._on_console_copy_click,
        )
        self._btn_console_copy.pack(side=self._tk.LEFT)

        cscroll = ttk.Scrollbar(console_wrap)
        cscroll.grid(row=1, column=1, sticky="ns")
        self._console_text = self._tk.Text(
            console_wrap,
            height=14,
            wrap=self._tk.CHAR,
            font=self._console_mono,
            yscrollcommand=cscroll.set,
        )
        self._console_text.grid(row=1, column=0, sticky="nsew")
        cscroll.config(command=self._console_text.yview)
        self._configure_console_chrome(self._console_text)

        self._configure_dashboard_window()
        self._configure_notebook_tabs()
        self._update_theme_toggle_button()
        self._refresh_dashboard_buttons()
        self._redraw_charts()
        self._schedule_chart_refresh()
        self._status_job = self._root.after(0, self._status_refresh_tick)
        self._update_status_indicator()
        with self._lock:
            mode_new = self._run_mode
        if mode_new == "docker" and self._docker_container_running():
            self._ensure_docker_log_stream()
        self._start_git_update_check()

    def _on_dashboard_wm_delete(self) -> None:
        """Close button: minimize to tray; Ctrl/Cmd + close quits the launcher."""
        if _control_or_command_held_for_window_close():
            self._quit_all()
            return
        self._hide_dashboard()

    def _hide_dashboard(self) -> None:
        self._cancel_console_copy_tooltip()
        if self._settings_scroll_job is not None:
            try:
                self._root.after_cancel(self._settings_scroll_job)
            except self._tk.TclError:
                pass
            self._settings_scroll_job = None
        if self._chart_job is not None:
            try:
                self._root.after_cancel(self._chart_job)
            except self._tk.TclError:
                pass
            self._chart_job = None
        if self._status_job is not None:
            try:
                self._root.after_cancel(self._status_job)
            except self._tk.TclError:
                pass
            self._status_job = None
        self._cancel_status_animation()
        if self._dash_win is not None:
            self._dash_win.withdraw()

    def _schedule_chart_refresh(self) -> None:
        def tick() -> None:
            if self._dash_win is None or not self._dash_win.winfo_exists():
                self._chart_job = None
                return
            try:
                visible = self._dash_win.winfo_viewable()
            except self._tk.TclError:
                self._chart_job = None
                return
            if visible:
                if self._charts_tab_selected():
                    self._redraw_charts()
                try:
                    if self._dash_win is not None and self._dash_win.winfo_viewable():
                        self._refresh_dashboard_buttons()
                except self._tk.TclError:
                    pass
            self._chart_job = self._root.after(5000, tick)

        self._chart_job = self._root.after(5000, tick)

    def _on_autostart_toggle(self) -> None:
        from tkinter import messagebox

        if not autostart_supported() or self._autostart_var is None:
            return
        want = self._autostart_var.get()
        try:
            _autostart_set_enabled(want)
        except OSError as e:
            self._autostart_var.set(not want)
            messagebox.showerror("Start at login", str(e) or "Could not update start-at-login setting.")

    def _on_run_mode_changed(self) -> None:
        from tkinter import messagebox

        if self._run_mode_var is None:
            return
        want = self._run_mode_var.get()
        if want not in ("native", "docker"):
            return
        if self._service_running_for_status():
            self._run_mode_var.set(self._run_mode)
            messagebox.showinfo(
                "Run mode",
                "Stop Ground Control before switching between native and Docker.",
            )
            return
        with self._lock:
            self._run_mode = want
        merged = _load_tray_settings()
        merged["run_mode"] = want
        _save_tray_settings(merged)
        self._sync_settings_docker_section()
        self._refresh_dashboard_buttons()

    def _read_docker_secret_disk_text(self, file_name: str) -> str:
        p = _DOCKER_SECRETS_DIR / file_name
        try:
            raw = p.read_text(encoding="utf-8").replace("\r\n", "\n")
        except OSError:
            return ""
        while raw.endswith("\n"):
            raw = raw[:-1]
        return raw

    def _fill_docker_secret_text_widget(self, spec: DockerSecretSpec) -> None:
        tk = self._tk
        txt = self._docker_secret_texts.get(spec.file_name)
        if txt is None:
            return
        plain = self._docker_secret_plain.get(spec.file_name) or ""
        txt.configure(state=tk.NORMAL)
        txt.delete("1.0", tk.END)
        if spec.sensitive and not self._docker_secret_reveal.get(spec.file_name):
            if plain:
                cap = 4000
                mask = "\u2022" * min(len(plain), cap)
                if len(plain) > cap:
                    mask += "\n\u2026"
                txt.insert("1.0", mask)
            txt.configure(state=tk.DISABLED)
        else:
            txt.insert("1.0", plain)

    def _toggle_docker_secret_visibility(self, spec: DockerSecretSpec) -> None:
        tk = self._tk
        revealed = self._docker_secret_reveal.get(spec.file_name, False)
        if spec.field_kind == "multiline" and spec.sensitive:
            txt = self._docker_secret_texts.get(spec.file_name)
            if txt is not None and revealed:
                self._docker_secret_plain[spec.file_name] = txt.get("1.0", "end-1c")
        self._docker_secret_reveal[spec.file_name] = not revealed
        if spec.field_kind == "multiline":
            self._fill_docker_secret_text_widget(spec)
        else:
            ent = self._docker_secret_entries.get(spec.file_name)
            if ent is not None and spec.sensitive:
                show = "" if self._docker_secret_reveal.get(spec.file_name) else "*"
                try:
                    ent.configure(show=show)
                except tk.TclError:
                    pass

    def _toggle_docker_le_google_visibility(self) -> None:
        tk = self._tk
        txt = self._docker_le_google_text
        if txt is None:
            return
        if self._docker_le_google_reveal:
            self._docker_le_google_plain = txt.get("1.0", "end-1c")
        self._docker_le_google_reveal = not self._docker_le_google_reveal
        txt.configure(state=tk.NORMAL)
        txt.delete("1.0", tk.END)
        if self._docker_le_google_reveal:
            txt.insert("1.0", self._docker_le_google_plain)
        else:
            p = self._docker_le_google_plain
            if p:
                cap = 4000
                mask = "\u2022" * min(len(p), cap)
                if len(p) > cap:
                    mask += "\n\u2026"
                txt.insert("1.0", mask)
            txt.configure(state=tk.DISABLED)

    def _toggle_docker_le_cred_entry_visibility(self, key: str) -> None:
        w = self._docker_le_cred_widgets.get(key)
        if w is None:
            return
        try:
            show = str(w.cget("show") or "")
        except self._tk.TclError:
            return
        try:
            w.configure(show="" if show == "*" else "*")
        except self._tk.TclError:
            pass

    def _docker_le_pack_after_cert_row(self) -> None:
        """Place the Let's Encrypt frame directly under the certificate source row."""
        outer = self._docker_le_outer
        anchor = getattr(self, "_docker_row_cert_source", None)
        if outer is None:
            return
        try:
            outer.pack_forget()
        except self._tk.TclError:
            pass
        if (self._docker_cert_source_combo.get() or "").strip().lower() != "letsencrypt":
            return
        try:
            if anchor is not None and anchor.winfo_exists():
                outer.pack(fill=self._tk.X, padx=8, pady=(0, 8), after=anchor)
            else:
                outer.pack(fill=self._tk.X, padx=8, pady=(0, 8))
        except self._tk.TclError:
            pass

    def _on_docker_cert_source_changed(self, *_a: Any) -> None:
        self._docker_le_pack_after_cert_row()
        val = (self._docker_cert_source_combo.get() or "").strip().lower()
        if val == "letsencrypt":
            vm = (self._docker_le_validation.get() or "").strip().lower()
            self._docker_set_le_dns_rows_visible(vm == "dns")
        else:
            self._docker_set_le_dns_rows_visible(False)

    def _docker_set_le_dns_rows_visible(self, show_dns: bool) -> None:
        fr = getattr(self, "_docker_le_dns_block", None)
        if fr is not None:
            try:
                if show_dns:
                    fr.pack(fill=self._tk.X, pady=(4, 0))
                else:
                    fr.pack_forget()
            except self._tk.TclError:
                pass

    def _on_docker_le_validation_changed(self, *_a: Any) -> None:
        vm = (self._docker_le_validation.get() or "").strip().lower()
        self._docker_set_le_dns_rows_visible(vm == "dns")

    def _docker_le_rebuild_dns_fields(self) -> None:
        ttk = self._docker_settings_ttk
        tk = self._tk
        inner = self._docker_le_dns_inner
        if ttk is None or inner is None:
            return
        for w in inner.winfo_children():
            w.destroy()
        self._docker_le_cred_widgets.clear()
        plugin = (self._docker_le_plugin.get() or "").strip().lower()
        spec = PLUGIN_BY_ID.get(plugin)
        if not spec:
            return
        parsed: dict[str, str] = {}
        ini_raw = self._read_docker_secret_disk_text("ground_control_letsencrypt_dns_credentials_ini")
        if ini_raw.strip():
            parsed = parse_dns_credentials_ini_values(ini_raw)
        for f in spec.fields:
            if f.key == "dns_google_credentials_json":
                continue
            row = ttk.Frame(inner)
            row.pack(fill=tk.X, pady=2)
            ttk.Label(row, text=f"{f.label}:", width=28, anchor=tk.W).pack(side=tk.LEFT, padx=(0, 6))
            val = (parsed.get(f.key) or "").strip()
            if f.input_type == "textarea":
                w = tk.Text(row, height=3, width=40, wrap=tk.CHAR, font=self._console_mono)
                w.insert("1.0", val)
                w.pack(side=tk.LEFT, fill=tk.X, expand=True)
            else:
                wrap = ttk.Frame(row)
                wrap.pack(side=tk.LEFT, fill=tk.X, expand=True)
                mask = _docker_le_dns_field_maskable(f)
                w = ttk.Entry(wrap, show=("*" if mask else ""))
                w.insert(0, val)
                w.pack(side=tk.LEFT, fill=tk.X, expand=True)
                if mask:
                    ttk.Button(
                        wrap,
                        text="\U0001F441",
                        width=3,
                        command=lambda k=f.key: self._toggle_docker_le_cred_entry_visibility(k),
                    ).pack(side=tk.LEFT, padx=(4, 0))
            self._docker_le_cred_widgets[f.key] = w

        g_fr = getattr(self, "_docker_le_google_row", None)
        if g_fr is not None:
            try:
                if plugin == "google":
                    g_fr.pack(fill=tk.X, pady=(6, 0))
                else:
                    g_fr.pack_forget()
            except tk.TclError:
                pass

        if self._docker_le_dns_inner is not None:
            self._settings_bind_mousewheel_recursive(self._docker_le_dns_inner)
        self._queue_settings_scroll_sync()

    def _collect_le_dns_field_values(self) -> dict[str, str]:
        tk = self._tk
        out: dict[str, str] = {}
        for key, w in self._docker_le_cred_widgets.items():
            if isinstance(w, tk.Text):
                out[key] = w.get("1.0", "end-1c").strip()
            elif hasattr(w, "get"):
                out[key] = str(w.get()).strip()
        return out

    def _on_save_docker_secrets_click(self) -> None:
        from tkinter import messagebox

        _ensure_docker_secrets_stub_files()
        try:
            for spec in DOCKER_SECRET_SPECS:
                path = _DOCKER_SECRETS_DIR / spec.file_name
                body = ""
                if spec.field_kind == "combobox":
                    combo = self._docker_secret_combos.get(spec.file_name)
                    if combo is not None:
                        body = (combo.get() or "").strip()
                elif spec.field_kind == "multiline":
                    txt = self._docker_secret_texts.get(spec.file_name)
                    if txt is None:
                        continue
                    if spec.sensitive and not self._docker_secret_reveal.get(spec.file_name):
                        body = self._docker_secret_plain.get(spec.file_name) or ""
                    else:
                        body = txt.get("1.0", "end-1c")
                        if spec.sensitive:
                            self._docker_secret_plain[spec.file_name] = body
                else:
                    ent = self._docker_secret_entries.get(spec.file_name)
                    if ent is not None:
                        body = ent.get().strip()
                nl = "\n" if (spec.field_kind == "multiline" and body) else ""
                path.write_text(body + nl, encoding="utf-8")

            cert = (self._docker_cert_source_combo.get() or "").strip().lower() if self._docker_cert_source_combo else ""
            if cert == "letsencrypt":
                email = (self._docker_le_email.get() or "").strip() if self._docker_le_email else ""
                vm = (self._docker_le_validation.get() or "").strip().lower() if self._docker_le_validation else ""
                if vm not in ("http", "dns", ""):
                    vm = ""
                plug_ids = tuple(p.plugin_id for p in DNS_PLUGIN_SPECS)
                plug = (self._docker_le_plugin.get() or "").strip().lower() if self._docker_le_plugin else ""
                if plug not in plug_ids:
                    plug = ""
                (_DOCKER_SECRETS_DIR / "ground_control_letsencrypt_email").write_text(
                    email + ("\n" if email else ""), encoding="utf-8"
                )
                (_DOCKER_SECRETS_DIR / "ground_control_letsencrypt_validation_method").write_text(
                    (vm + "\n") if vm else "", encoding="utf-8"
                )
                (_DOCKER_SECRETS_DIR / "ground_control_letsencrypt_dns_plugin").write_text(
                    (plug + "\n") if plug else "", encoding="utf-8"
                )
                if vm == "dns":
                    if self._docker_le_google_text is not None and self._docker_le_google_reveal:
                        self._docker_le_google_plain = self._docker_le_google_text.get("1.0", "end-1c")
                    vals = self._collect_le_dns_field_values()
                    ini_path = _DOCKER_SECRETS_DIR / "ground_control_letsencrypt_dns_credentials_ini"
                    if plug:
                        ini_body = format_dns_credentials_ini_content(plug, vals)
                        ini_path.write_text(ini_body, encoding="utf-8")
                    else:
                        ini_path.write_text("", encoding="utf-8")
                    gpath = _DOCKER_SECRETS_DIR / "ground_control_letsencrypt_google_credentials_json"
                    if plug == "google":
                        gpath.write_text(
                            (self._docker_le_google_plain or "").strip() + "\n"
                            if (self._docker_le_google_plain or "").strip()
                            else "",
                            encoding="utf-8",
                        )
                    else:
                        gpath.write_bytes(b"")
                else:
                    (_DOCKER_SECRETS_DIR / "ground_control_letsencrypt_dns_credentials_ini").write_bytes(b"")
                    (_DOCKER_SECRETS_DIR / "ground_control_letsencrypt_google_credentials_json").write_bytes(b"")
            else:
                for name in DOCKER_LE_SECRET_FILE_NAMES:
                    (_DOCKER_SECRETS_DIR / name).write_bytes(b"")

            messagebox.showinfo(
                "Docker secrets",
                "Saved under .gc_docker_secrets/\nRestart Ground Control (Docker) to apply changes in the container.",
            )
        except (OSError, ValueError) as e:
            messagebox.showerror("Docker secrets", str(e) or "Could not save secret files.")

    def _on_generate_docker_postgres_password_click(self) -> None:
        """Fill the Postgres secret field with a new random password (user still saves to disk)."""
        ent = self._docker_secret_entries.get("ground_control_postgres_password")
        if ent is None:
            return
        raw = secrets.token_urlsafe(24)
        ent.delete(0, self._tk.END)
        ent.insert(0, raw)
        self._docker_secret_plain["ground_control_postgres_password"] = raw

    def _queue_settings_scroll_sync(self) -> None:
        if self._settings_scroll_job is not None:
            try:
                self._root.after_cancel(self._settings_scroll_job)
            except self._tk.TclError:
                pass
        self._settings_scroll_job = self._root.after_idle(self._flush_settings_scroll_sync)

    def _flush_settings_scroll_sync(self) -> None:
        self._settings_scroll_job = None
        self._settings_scroll_sync()

    def _settings_scroll_sync(self) -> None:
        c = self._settings_canvas
        if c is None:
            return
        try:
            if not c.winfo_exists():
                return
        except self._tk.TclError:
            return
        try:
            bbox = c.bbox("all")
            if bbox:
                c.configure(scrollregion=bbox)
        except self._tk.TclError:
            pass

    def _settings_on_canvas_configure(self, event: Any) -> None:
        c = self._settings_canvas
        wid = self._settings_canvas_window_id
        if c is None or wid is None:
            return
        try:
            c.itemconfigure(wid, width=event.width)
        except self._tk.TclError:
            pass
        self._queue_settings_scroll_sync()

    def _settings_bind_mousewheel_recursive(self, widget: Any) -> None:
        tk = self._tk
        try:
            wclass = str(widget.winfo_class())
        except tk.TclError:
            return
        # Let Text / Listbox / Combobox keep wheel for their own scrolling.
        if wclass in ("Text", "Listbox", "TCombobox"):
            return

        def wheel_win(e: Any) -> None:
            canvas = self._settings_canvas
            if canvas is None:
                return
            try:
                if sys.platform == "darwin":
                    canvas.yview_scroll(int(-1 * e.delta), "units")
                else:
                    canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
            except tk.TclError:
                pass

        def wheel_lx(e: Any) -> None:
            canvas = self._settings_canvas
            if canvas is None:
                return
            try:
                canvas.yview_scroll(-1 if e.num == 4 else 1, "units")
            except tk.TclError:
                pass

        try:
            widget.bind("<MouseWheel>", wheel_win)
        except tk.TclError:
            pass
        if sys.platform.startswith("linux"):
            try:
                widget.bind("<Button-4>", wheel_lx)
                widget.bind("<Button-5>", wheel_lx)
            except tk.TclError:
                pass
        try:
            for ch in widget.winfo_children():
                self._settings_bind_mousewheel_recursive(ch)
        except tk.TclError:
            pass

    def _build_docker_secrets_section(self, settings_outer: Any, ttk: Any) -> None:
        tk = self._tk
        self._docker_settings_ttk = ttk
        self._docker_secret_entries.clear()
        self._docker_secret_combos.clear()
        self._docker_secret_texts.clear()
        self._docker_secret_plain.clear()
        self._docker_secret_reveal.clear()
        self._docker_cert_source_combo = None
        self._docker_secrets_body = None
        _ensure_docker_secrets_stub_files()

        self._docker_secrets_fr = ttk.LabelFrame(
            settings_outer,
            text="Docker secrets (compose mounts these files into /run/secrets)",
        )
        ttk.Label(
            self._docker_secrets_fr,
            text=(
                "Empty fields and blank dropdown choices leave compose/container defaults unchanged. "
                "Sensitive values use the eye button to show or edit. "
                "When certificate source is Let's Encrypt, configure the same options as Settings → Let's Encrypt. "
                "Save writes files that docker compose reads on the next start."
            ),
            wraplength=640,
        ).pack(anchor="w", padx=8, pady=(8, 4))

        body = ttk.Frame(self._docker_secrets_fr)
        body.pack(fill=tk.X, expand=False, padx=4, pady=2)
        self._docker_secrets_body = body

        for spec in DOCKER_SECRET_SPECS:
            row = ttk.Frame(body)
            row.pack(fill=tk.X, padx=8, pady=3)
            if spec.file_name == "ground_control_cert_source":
                self._docker_row_cert_source = row
            ttk.Label(row, text=f"{spec.label}:", width=46, anchor=tk.W).pack(side=tk.LEFT, padx=(0, 6))
            inner = ttk.Frame(row)
            inner.pack(side=tk.LEFT, fill=tk.X, expand=True)
            plain = self._read_docker_secret_disk_text(spec.file_name)
            if spec.field_kind != "combobox" and spec.default_when_empty and not str(plain).strip():
                plain = spec.default_when_empty
            self._docker_secret_plain[spec.file_name] = plain
            self._docker_secret_reveal[spec.file_name] = False

            if spec.field_kind == "combobox":
                vals = ["", *list(spec.choices or ())]
                cb = ttk.Combobox(inner, values=vals, state="readonly", width=48)
                pick = plain.strip()
                if pick not in vals:
                    pick = ""
                cb.set(pick)
                cb.pack(side=tk.LEFT, fill=tk.X, expand=True)
                self._docker_secret_combos[spec.file_name] = cb
                if spec.file_name == "ground_control_cert_source":
                    self._docker_cert_source_combo = cb
                    cb.bind("<<ComboboxSelected>>", self._on_docker_cert_source_changed)
            elif spec.field_kind == "multiline":
                txt = tk.Text(inner, height=4, width=52, wrap=tk.CHAR, font=self._console_mono)
                txt.pack(side=tk.LEFT, fill=tk.X, expand=True)
                self._docker_secret_texts[spec.file_name] = txt
                self._fill_docker_secret_text_widget(spec)
            else:
                ent = ttk.Entry(inner, show=("*" if spec.sensitive else ""))
                ent.insert(0, plain)
                ent.pack(side=tk.LEFT, fill=tk.X, expand=True)
                self._docker_secret_entries[spec.file_name] = ent
                if spec.file_name == "ground_control_postgres_password":
                    ttk.Button(
                        inner,
                        text="Generate",
                        command=self._on_generate_docker_postgres_password_click,
                    ).pack(side=tk.LEFT, padx=(4, 0))

            if spec.sensitive:
                ttk.Button(
                    inner,
                    text="\U0001F441",
                    width=3,
                    command=lambda s=spec: self._toggle_docker_secret_visibility(s),
                ).pack(side=tk.LEFT, padx=(4, 0))

        self._build_docker_le_panel(ttk)
        self._on_docker_cert_source_changed()

        ttk.Button(
            self._docker_secrets_fr,
            text="Save Docker secrets",
            command=self._on_save_docker_secrets_click,
        ).pack(anchor="w", padx=8, pady=(6, 8))

    def _build_docker_le_panel(self, ttk: Any) -> None:
        tk = self._tk
        parent = self._docker_secrets_body
        if parent is None:
            parent = self._docker_secrets_fr
        self._docker_le_outer = ttk.LabelFrame(parent, text="Let's Encrypt")
        outer = self._docker_le_outer
        pad = {"padx": 8, "pady": 2}

        email_row = ttk.Frame(outer)
        email_row.pack(fill=tk.X, **pad)
        ttk.Label(email_row, text="Email (required for ACME):", width=28, anchor=tk.W).pack(
            side=tk.LEFT, padx=(0, 6)
        )
        self._docker_le_email = ttk.Entry(email_row)
        self._docker_le_email.insert(0, self._read_docker_secret_disk_text("ground_control_letsencrypt_email"))
        self._docker_le_email.pack(side=tk.LEFT, fill=tk.X, expand=True)

        val_row = ttk.Frame(outer)
        val_row.pack(fill=tk.X, **pad)
        ttk.Label(val_row, text="Validation:", width=28, anchor=tk.W).pack(side=tk.LEFT, padx=(0, 6))
        vm_disk = self._read_docker_secret_disk_text("ground_control_letsencrypt_validation_method").lower().strip()
        if vm_disk not in ("http", "dns", ""):
            vm_disk = ""
        self._docker_le_validation = ttk.Combobox(
            val_row, values=("", "http", "dns"), state="readonly", width=46
        )
        self._docker_le_validation.set(vm_disk)
        self._docker_le_validation.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._docker_le_validation.bind("<<ComboboxSelected>>", self._on_docker_le_validation_changed)

        self._docker_le_dns_block = ttk.Frame(outer)
        dns_block = self._docker_le_dns_block
        plug_row = ttk.Frame(dns_block)
        plug_row.pack(fill=tk.X, pady=(0, 2))
        ttk.Label(plug_row, text="DNS provider:", width=28, anchor=tk.W).pack(side=tk.LEFT, padx=(0, 6))
        plug_disk = self._read_docker_secret_disk_text("ground_control_letsencrypt_dns_plugin").lower().strip()
        plug_ids = tuple(p.plugin_id for p in DNS_PLUGIN_SPECS)
        if plug_disk not in plug_ids:
            plug_disk = ""
        self._docker_le_plugin = ttk.Combobox(
            plug_row, values=("", *plug_ids), state="readonly", width=46
        )
        self._docker_le_plugin.set(plug_disk)
        self._docker_le_plugin.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._docker_le_plugin.bind("<<ComboboxSelected>>", lambda _e: self._docker_le_rebuild_dns_fields())

        self._docker_le_dns_inner = ttk.Frame(dns_block)
        self._docker_le_dns_inner.pack(fill=tk.X, pady=(2, 0))

        self._docker_le_google_row = ttk.Frame(dns_block)
        g_row = self._docker_le_google_row
        ttk.Label(g_row, text="Google Cloud DNS JSON:", width=28, anchor=tk.W).pack(side=tk.LEFT, padx=(0, 6))
        g_inner = ttk.Frame(g_row)
        g_inner.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._docker_le_google_plain = self._read_docker_secret_disk_text(
            "ground_control_letsencrypt_google_credentials_json"
        )
        self._docker_le_google_reveal = False
        self._docker_le_google_text = tk.Text(g_inner, height=4, width=40, wrap=tk.CHAR, font=self._console_mono)
        self._docker_le_google_text.pack(side=tk.LEFT, fill=tk.X, expand=True)
        if self._docker_le_google_plain:
            mask = "\u2022" * min(len(self._docker_le_google_plain), 4000)
            if len(self._docker_le_google_plain) > 4000:
                mask += "\n\u2026"
            self._docker_le_google_text.insert("1.0", mask)
            self._docker_le_google_text.configure(state=tk.DISABLED)
        ttk.Button(
            g_inner,
            text="\U0001F441",
            width=3,
            command=self._toggle_docker_le_google_visibility,
        ).pack(side=tk.LEFT, padx=(4, 0))

        self._docker_le_rebuild_dns_fields()
        self._docker_set_le_dns_rows_visible(vm_disk == "dns")

    def _sync_settings_docker_section(self) -> None:
        dsec = self._docker_secrets_fr
        fr = self._docker_settings_fr
        if fr is None or self._run_mode_var is None or self._settings_run_fr is None:
            return
        try:
            if not fr.winfo_exists():
                return
        except self._tk.TclError:
            return
        try:
            if self._run_mode_var.get() == "docker":
                anchor = self._settings_run_fr
                if dsec is not None:
                    try:
                        if dsec.winfo_exists():
                            dsec.pack(
                                fill=self._tk.X,
                                pady=(0, 12),
                                after=anchor,
                            )
                            anchor = dsec
                    except self._tk.TclError:
                        pass
                fr.pack(fill=self._tk.X, pady=(0, 12), after=anchor)
            else:
                if dsec is not None:
                    try:
                        dsec.pack_forget()
                    except self._tk.TclError:
                        pass
                fr.pack_forget()
        except self._tk.TclError:
            pass
        self._queue_settings_scroll_sync()

    def _on_delete_docker_image_click(self) -> None:
        from tkinter import messagebox

        if self._run_mode_var is None or self._run_mode_var.get() != "docker":
            return
        if not _DOCKER_COMPOSE_FILE.is_file():
            messagebox.showerror("Docker", f"Missing compose file:\n{_DOCKER_COMPOSE_FILE}")
            return
        if not shutil.which("docker"):
            messagebox.showerror("Docker", "docker was not found on PATH.")
            return
        if not messagebox.askokcancel(
            "Delete Docker image",
            "This will:\n"
            "  • Stop the Ground Control container if it is running\n"
            "  • Remove that container from Docker\n"
            "  • Delete the local image "
            f"'{_DOCKER_LOCAL_IMAGE}'\n\n"
            "Named volumes (your data in the compose volume) are not deleted.\n"
            "Starting again will rebuild the image.\n\n"
            "Continue?",
            icon=messagebox.WARNING,
        ):
            return
        btn = self._btn_delete_docker_image
        if btn is not None:
            try:
                btn.configure(state=self._tk.DISABLED)
            except self._tk.TclError:
                pass
        threading.Thread(target=self._delete_docker_image_worker, name="gc-docker-rmi", daemon=True).start()

    def _delete_docker_image_worker(self) -> None:
        self._stop_docker_logs_pump()
        argv = _docker_compose_argv()
        if not argv:
            self._schedule(lambda: self._finish_delete_docker_image(False, "docker compose not available on PATH."))
            return
        log_parts: list[str] = []
        err = False
        try:
            r_stop = subprocess.run(
                [*argv, "stop", _DOCKER_COMPOSE_SERVICE],
                cwd=_REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=180,
                **_subprocess_no_window_kw(),
            )
            log_parts.append(f"--- compose stop ---\n{(r_stop.stdout or '').strip()}\n{(r_stop.stderr or '').strip()}")
            r_rm = subprocess.run(
                [*argv, "rm", "-f", _DOCKER_COMPOSE_SERVICE],
                cwd=_REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=120,
                **_subprocess_no_window_kw(),
            )
            log_parts.append(f"--- compose rm ---\n{(r_rm.stdout or '').strip()}\n{(r_rm.stderr or '').strip()}")
            r_rmi = subprocess.run(
                ["docker", "rmi", "-f", _DOCKER_LOCAL_IMAGE],
                cwd=_REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=300,
                **_subprocess_no_window_kw(),
            )
            log_parts.append(f"--- docker rmi ---\n{(r_rmi.stdout or '').strip()}\n{(r_rmi.stderr or '').strip()}")
            stderr_rmi = (r_rmi.stderr or "").lower()
            if r_rmi.returncode != 0 and "no such image" not in stderr_rmi and "invalid reference" not in stderr_rmi:
                err = True
        except (OSError, subprocess.TimeoutExpired) as e:
            self._schedule(lambda e=e: self._finish_delete_docker_image(False, str(e)))
            return
        detail = "\n\n".join(p for p in log_parts if p.strip())
        self._schedule(lambda err=err, detail=detail: self._finish_delete_docker_image(not err, detail))

    def _finish_delete_docker_image(self, success: bool, detail: str) -> None:
        from tkinter import messagebox

        btn = self._btn_delete_docker_image
        if btn is not None:
            try:
                if btn.winfo_exists():
                    btn.configure(state=self._tk.NORMAL)
            except self._tk.TclError:
                pass
        self._enqueue_log_note("\n=== Delete Docker image / container ===\n" + (detail or "(no output)") + "\n")
        if success:
            messagebox.showinfo(
                "Docker",
                "Container removed and image deleted (or image was already absent). "
                "Named volumes were not removed.",
            )
        else:
            messagebox.showerror(
                "Docker",
                "One or more steps failed. See the Console tab for command output.\n\n" + (detail[:800] if detail else ""),
            )
        self._invalidate_runtime_probe_cache()
        self._refresh_dashboard_buttons()

    def _refresh_dashboard_buttons(self) -> None:
        if (
            self._dash_win is not None
            and self._dash_win.winfo_exists()
            and hasattr(self, "_btn_start")
        ):
            try:
                self._btn_start.config(state=(self._tk.NORMAL if self._can_start() else self._tk.DISABLED))
                self._btn_stop.config(state=(self._tk.NORMAL if self._can_stop() else self._tk.DISABLED))
                self._btn_restart.config(state=(self._tk.NORMAL if self._can_restart() else self._tk.DISABLED))
                if getattr(self, "_btn_rebuild", None) is not None:
                    self._btn_rebuild.config(
                        state=(self._tk.NORMAL if self._can_rebuild_docker() else self._tk.DISABLED)
                    )
            except self._tk.TclError:
                pass
        self._apply_git_update_button_state()
        self._refresh_tray_menu()

    def _on_notebook_tab_changed(self, _event: Any = None) -> None:
        nb = self._notebook
        if nb is None:
            return
        try:
            idx = int(nb.index(nb.select()))
        except (self._tk.TclError, ValueError):
            return
        if idx == 2:
            self._queue_settings_scroll_sync()
        elif idx == 0 and self._canvas is not None:
            try:
                self._canvas.draw_idle()
            except (self._tk.TclError, OSError, RuntimeError, ValueError):
                pass

    def _charts_tab_selected(self) -> bool:
        nb = self._notebook
        if nb is None:
            return True
        try:
            if not nb.winfo_exists():
                return True
            return int(nb.index(nb.select())) == 0
        except (self._tk.TclError, ValueError):
            return True

    def _redraw_charts_if_visible(self) -> None:
        if self._dash_win is None or not self._dash_win.winfo_exists():
            return
        try:
            if not self._dash_win.winfo_viewable():
                return
        except self._tk.TclError:
            return
        if not self._charts_tab_selected():
            return
        self._redraw_charts()

    def _metric_colors(self) -> dict[str, str]:
        if self._ui_dark:
            return {"cpu": "#2dd4bf", "ram": "#60a5fa", "threads": "#e879f9"}
        return {"cpu": "#0d9488", "ram": "#2563eb", "threads": "#a21caf"}

    def _metric_ymax(self, values: list[float], key: str) -> float:
        """Same vertical ceiling as the main detail chart for *key* (cpu | ram | threads)."""
        if not values:
            if key == "cpu":
                return 100.0
            if key == "ram":
                return 32.0
            return 8.0
        if key == "cpu":
            return max(100.0, max(values) * 1.08)
        if key == "ram":
            return max(max(values) * 1.1, 32.0)
        return max(max(values) * 1.12, 8.0)

    def _tm_text_primary(self) -> str:
        return "#fafafa" if self._ui_dark else "#0f172a"

    def _tm_text_secondary(self) -> str:
        return "#a1a1aa" if self._ui_dark else "#64748b"

    def _tm_text_muted(self) -> str:
        return "#71717a" if self._ui_dark else "#94a3b8"

    def _footer_value_base(self) -> str:
        return "#e4e4e7" if self._ui_dark else "#1e293b"

    def _apply_figure_chrome(self) -> None:
        if self._fig is None:
            return
        self._fig.patch.set_facecolor(self._dashboard_window_bg())

    def _on_chart_canvas_click(self, event: Any) -> None:
        ax = event.inaxes
        if ax is None:
            return
        if ax == self._ax_spark_cpu:
            self._chart_focus = "cpu"
        elif ax == self._ax_spark_ram:
            self._chart_focus = "ram"
        elif ax == self._ax_spark_thr:
            self._chart_focus = "threads"
        else:
            return
        self._redraw_charts()

    def _build_charts_stats_footer(self) -> None:
        fr = self._charts_stats_footer
        if fr is None:
            return
        for c in range(3):
            fr.grid_columnconfigure(c, weight=1, uniform="stat")
        keys = ("cpu", "ram", "threads")
        titles = ("CPU (% of host)", "Memory (RSS)", "Threads")
        bg0 = self._dashboard_window_bg()
        for c, (key, ttl) in enumerate(zip(keys, titles, strict=True)):
            col = self._tk.Frame(fr, bg=bg0)
            col.grid(row=0, column=c, sticky="nsew", padx=10, pady=8)
            tw = self._tk.Label(col, text=ttl, bg=bg0)
            tw.pack(anchor="w")
            vw = self._tk.Label(col, text="—", bg=bg0)
            vw.pack(anchor="w")
            self._stat_footer_widgets[key] = (tw, vw)
        self._style_charts_stats_footer()

    def _charts_ui_font(self) -> str:
        if sys.platform == "win32":
            return "Segoe UI"
        if sys.platform == "darwin":
            return "Helvetica Neue"
        return "DejaVu Sans"

    def _style_charts_stats_footer(self) -> None:
        if not self._stat_footer_widgets or self._charts_stats_footer is None:
            return
        bg = self._dashboard_window_bg()
        title_c = self._tm_text_secondary()
        ff = self._charts_ui_font()
        self._charts_stats_footer.configure(bg=bg)
        for tw, vw in self._stat_footer_widgets.values():
            tw.configure(bg=bg, fg=title_c, font=(ff, 9))
            vw.configure(bg=bg, fg=self._footer_value_base(), font=(ff, 18, "bold"))
            try:
                tw.master.configure(bg=bg)
            except self._tk.TclError:
                pass

    def _update_charts_stats_footer(
        self,
        cpu: float | None,
        ram: float | None,
        thr: int | None,
        *,
        thread_text: str | None = None,
    ) -> None:
        if not self._stat_footer_widgets or self._charts_stats_footer is None:
            return
        bg = self._dashboard_window_bg()
        cols = self._metric_colors()
        base = self._footer_value_base()
        if cpu is None or ram is None or thr is None:
            for key, (_tw, vw) in self._stat_footer_widgets.items():
                vw.configure(text="—", fg=base, bg=bg)
            return
        thr_show = thread_text if thread_text is not None else str(int(thr))
        texts = {"cpu": f"{cpu:.1f}%", "ram": f"{ram:.0f} MB", "threads": thr_show}
        for key, (_tw, vw) in self._stat_footer_widgets.items():
            accent = cols[key] if key == self._chart_focus else base
            vw.configure(text=texts[key], fg=accent, bg=bg)

    def _style_spark_axis(self, ax: Any, *, selected: bool, accent: str) -> None:
        if self._ui_dark:
            bg = "#2e2e36" if selected else "#1c1c22"
        else:
            bg = "#dbeafe" if selected else "#f8fafc"
        ax.set_facecolor(bg)
        ax.set_xticks([])
        ax.set_yticks([])
        for name, sp in ax.spines.items():
            if name == "left":
                sp.set_visible(selected)
                if selected:
                    sp.set_linewidth(3)
                    sp.set_color(accent)
            else:
                sp.set_visible(False)

    def _draw_spark(
        self,
        ax: Any,
        xs: list[datetime],
        values: list[float],
        *,
        y_max: float,
        color: str,
        name: str,
        summary: str,
        selected: bool,
    ) -> None:
        self._style_spark_axis(ax, selected=selected, accent=color)
        ax.text(
            0.04,
            0.66,
            name,
            transform=ax.transAxes,
            ha="left",
            va="center",
            fontsize=10,
            fontweight="bold",
            color=self._tm_text_primary(),
        )
        ax.text(
            0.04,
            0.3,
            summary,
            transform=ax.transAxes,
            ha="left",
            va="center",
            fontsize=8,
            color=self._tm_text_secondary(),
        )
        if not values or not xs or len(xs) != len(values):
            return
        n = min(200, len(values))
        tx = xs[-n:]
        ty = values[-n:]
        ax.fill_between(tx, ty, 0, color=color, alpha=0.3, linewidth=0, zorder=1)
        ax.plot(tx, ty, color=color, linewidth=1.4, zorder=2, clip_on=True)
        ax.set_ylim(0, y_max)
        if len(tx) == 1:
            pad = timedelta(minutes=45)
            ax.set_xlim(tx[0] - pad, tx[0] + pad)
        else:
            ax.set_xlim(tx[0], tx[-1])
        ax.set_xticks([])

    def _style_main_axis(self, ax: Any) -> None:
        if self._ui_dark:
            ax.set_facecolor("#111111")
            tick = "#d4d4d8"
            grid_c = "#2d323c"
            spine = "#3f3f46"
        else:
            ax.set_facecolor("#ffffff")
            tick = "#334155"
            grid_c = "#e2e8f0"
            spine = "#94a3b8"
        ax.tick_params(axis="both", colors=tick, labelsize=8, length=4, width=0.8)
        ax.xaxis.label.set_color(self._tm_text_secondary())
        for sp in ax.spines.values():
            sp.set_color(spine)
        ax.grid(True, axis="y", color=grid_c, linewidth=0.75, linestyle="-")
        ax.set_axisbelow(True)

    def _plot_main_chart(
        self,
        ax: Any,
        xs: list[datetime],
        ys: list[float],
        *,
        accent: str,
        title: str,
        subtitle: str,
        ymax: float,
    ) -> None:
        self._style_main_axis(ax)
        fill_a = 0.34 if self._ui_dark else 0.4
        ax.fill_between(xs, ys, 0, color=accent, alpha=fill_a, linewidth=0, zorder=1)
        ax.plot(xs, ys, color=accent, linewidth=2.0, zorder=3)
        ax.set_ylim(0, ymax)
        pri = self._tm_text_primary()
        mut = self._tm_text_secondary()
        ax.text(0, 1.04, title, transform=ax.transAxes, ha="left", va="bottom", fontsize=16, fontweight="bold", color=pri)
        ax.text(1.0, 1.04, subtitle, transform=ax.transAxes, ha="right", va="bottom", fontsize=9, color=mut)
        ax.set_xlabel("Last 24 hours", fontsize=8, color=mut)
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%H:%M"))
        ax.xaxis.set_major_locator(mdates.AutoDateLocator())

    def _redraw_charts(self) -> None:
        sparks = (self._ax_spark_cpu, self._ax_spark_ram, self._ax_spark_thr)
        if self._fig is None or self._ax_main is None or any(x is None for x in sparks):
            return
        now = _utcnow()
        cutoff = now - timedelta(hours=24)
        with self._lock:
            series = [s for s in self._samples if s.ts >= cutoff]

        cols = self._metric_colors()
        for ax in sparks:
            ax.clear()
        self._ax_main.clear()
        self._apply_figure_chrome()

        if not series:
            for ax, (nm, key) in zip(
                sparks,
                (("CPU", "cpu"), ("Memory", "ram"), ("Threads", "threads")),
                strict=True,
            ):
                self._style_spark_axis(ax, selected=self._chart_focus == key, accent=cols[key])
                ax.text(
                    0.5,
                    0.5,
                    nm,
                    transform=ax.transAxes,
                    ha="center",
                    va="center",
                    fontsize=10,
                    color=self._tm_text_muted(),
                )
            self._style_main_axis(self._ax_main)
            self._ax_main.text(
                0.5,
                0.5,
                "No samples yet",
                transform=self._ax_main.transAxes,
                ha="center",
                va="center",
                fontsize=12,
                color=self._tm_text_muted(),
            )
            self._update_charts_stats_footer(None, None, None)
            if self._canvas:
                self._canvas.draw_idle()
            return

        xs = [s.ts for s in series]
        cpu_y = [s.cpu_percent for s in series]
        ram_y = [s.ram_mb for s in series]
        thr_y = [float(s.thread_count) for s in series]
        lc, lr, lt = cpu_y[-1], ram_y[-1], thr_y[-1]
        last_src = series[-1].source
        thr_spark_summ = "—" if last_src == "docker" else f"{int(lt)}"

        cpu_ymax = self._metric_ymax(cpu_y, "cpu")
        ram_ymax = self._metric_ymax(ram_y, "ram")
        thr_ymax = self._metric_ymax(thr_y, "threads")
        spark_specs = (
            (sparks[0], cpu_y, cols["cpu"], "CPU", f"{lc:.0f}%", "cpu", cpu_ymax),
            (sparks[1], ram_y, cols["ram"], "Memory", f"{lr:.0f} MB", "ram", ram_ymax),
            (sparks[2], thr_y, cols["threads"], "Threads", thr_spark_summ, "threads", thr_ymax),
        )
        for ax, vals, col, nm, summ, key, ytop in spark_specs:
            self._draw_spark(
                ax,
                xs,
                vals,
                y_max=ytop,
                color=col,
                name=nm,
                summary=summ,
                selected=self._chart_focus == key,
            )

        focus = self._chart_focus
        if focus == "cpu":
            ys, accent = cpu_y, cols["cpu"]
            sub = (
                "Docker · % of total host CPU · 60 s samples"
                if last_src == "docker"
                else "Process tree · % of total host CPU · 60 s samples"
            )
            ymax = cpu_ymax
            title = "CPU"
        elif focus == "ram":
            ys, accent = ram_y, cols["ram"]
            sub = (
                "Docker · container memory"
                if last_src == "docker"
                else "Resident set · sum of process tree"
            )
            ymax = ram_ymax
            title = "Memory"
        else:
            ys, accent = thr_y, cols["threads"]
            sub = (
                "Thread count not reported for Docker"
                if last_src == "docker"
                else "Thread count · sum of process tree"
            )
            ymax = thr_ymax
            title = "Threads"

        self._plot_main_chart(
            self._ax_main,
            xs,
            ys,
            accent=accent,
            title=title,
            subtitle=sub,
            ymax=ymax,
        )
        self._update_charts_stats_footer(
            lc,
            lr,
            int(lt),
            thread_text=("—" if last_src == "docker" else None),
        )
        if self._canvas:
            self._canvas.draw_idle()

    def run(self) -> None:
        def tray_thread() -> None:
            self._icon.run()

        threading.Thread(target=tray_thread, name="pystray", daemon=True).start()
        self._root.after(100, self._drain_log_queue_loop)
        self._root.after(600, self._tray_menu_refresh_loop)
        self._root.after(2500, self._git_update_poll_loop)
        self._root.after(8000, self._poll_os_theme_loop)
        try:
            self._root.mainloop()
        finally:
            try:
                self._root.destroy()
            except self._tk.TclError:
                pass
            self._metrics_stop.set()
            self._stop_docker_logs_pump()
            with self._lock:
                mode = self._run_mode
                ch = self._child
                self._child = None
            if mode == "docker":
                argv = _docker_compose_argv("stop", _DOCKER_COMPOSE_SERVICE)
                if argv:
                    try:
                        subprocess.run(
                            argv,
                            cwd=_REPO_ROOT,
                            capture_output=True,
                            text=True,
                            timeout=120,
                            **_subprocess_no_window_kw(),
                        )
                    except (OSError, subprocess.TimeoutExpired):
                        pass
            elif ch is not None and ch.poll() is None:
                _kill_process_tree(ch.pid)


def main() -> None:
    app = GcTrayApp()
    app.run()


if __name__ == "__main__":
    main()
