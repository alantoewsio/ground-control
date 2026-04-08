from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(BASE_DIR / ".env")


_load_dotenv()


def database_url() -> str:
    import os

    return os.environ.get(
        "GROUND_CONTROL_DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'ground_control.db'}",
    )


def monitor_database_url() -> str:
    import os

    return os.environ.get(
        "GROUND_CONTROL_MONITOR_DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'ground_control_monitor.db'}",
    )


def secrets_database_url() -> str:
    import os

    return os.environ.get(
        "GROUND_CONTROL_SECRETS_DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'ground_control_secrets.db'}",
    )


def http_listen_port() -> int:
    """TCP port the app binds for HTTP (uvicorn). Env: GROUND_CONTROL_HTTP_PORT, then GROUND_CONTROL_PORT, then PORT."""
    import os

    for key in ("GROUND_CONTROL_HTTP_PORT", "GROUND_CONTROL_PORT", "PORT"):
        raw = (os.environ.get(key) or "").strip()
        if not raw:
            continue
        try:
            v = int(raw)
        except ValueError:
            continue
        if 1 <= v <= 65535:
            return v
    return 8000


def https_listen_port() -> int:
    """HTTPS listen port when TLS terminates in the app. Env: GROUND_CONTROL_HTTPS_PORT (default 8443)."""
    import os

    raw = (os.environ.get("GROUND_CONTROL_HTTPS_PORT") or "").strip()
    if not raw:
        return 8443
    try:
        v = int(raw)
    except ValueError:
        return 8443
    if 1 <= v <= 65535:
        return v
    return 8443


def bind_listen_host() -> str | None:
    """If set, overrides saved Security listen interface for uvicorn bind (e.g. ``0.0.0.0`` in Docker)."""
    import os

    raw = (os.environ.get("GROUND_CONTROL_BIND_ADDRESS") or "").strip()
    return raw or None


def monitor_tcp_timeout_seconds() -> float:
    import os

    raw = (os.environ.get("GROUND_CONTROL_MONITOR_TCP_TIMEOUT_SEC") or "").strip()
    if not raw:
        return 5.0
    try:
        v = float(raw)
    except ValueError:
        return 5.0
    return max(0.5, min(v, 120.0))


FERNET_KEY_FILE = BASE_DIR / ".fernet_key"

SESSION_SECRET_FILE = BASE_DIR / ".session_secret"
SESSION_SECRET_ENV = "GROUND_CONTROL_SESSION_SECRET"

# Sign-out after this many minutes without API activity from the browser (0 = idle disabled).
DEFAULT_SESSION_IDLE_MINUTES = 60


def session_idle_timeout_minutes() -> int:
    import os

    raw = (os.environ.get("GROUND_CONTROL_SESSION_IDLE_MINUTES") or "").strip()
    if not raw:
        return DEFAULT_SESSION_IDLE_MINUTES
    try:
        v = int(raw)
    except ValueError:
        return DEFAULT_SESSION_IDLE_MINUTES
    if v < 0:
        return DEFAULT_SESSION_IDLE_MINUTES
    return min(v, 525600)


def under_pytest() -> bool:
    import os

    return os.environ.get("GROUND_CONTROL_UNDER_PYTEST") == "1"


def secure_session_cookie_enabled() -> bool:
    import os

    raw = (os.environ.get("GROUND_CONTROL_SECURE_SESSION_COOKIE") or "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    if under_pytest():
        return False
    return True


def fernet_key() -> str:
    import os

    k = (os.environ.get("GROUND_CONTROL_FERNET_KEY") or "").strip()
    if k:
        return k
    if FERNET_KEY_FILE.is_file():
        k = FERNET_KEY_FILE.read_text(encoding="utf-8").strip()
        if k:
            os.environ["GROUND_CONTROL_FERNET_KEY"] = k
        return k
    return ""


def ensure_local_fernet_key() -> None:
    """If no key is configured, create .fernet_key so local dev can start without env vars."""
    import logging
    import os

    if fernet_key():
        return
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    FERNET_KEY_FILE.write_text(key + "\n", encoding="utf-8")
    os.environ["GROUND_CONTROL_FERNET_KEY"] = key
    logging.getLogger("uvicorn.error").warning(
        "Created %s with a new encryption key. Back up this file; "
        "stored passwords cannot be decrypted without it. "
        "For production, prefer setting GROUND_CONTROL_FERNET_KEY instead.",
        FERNET_KEY_FILE.name,
    )
