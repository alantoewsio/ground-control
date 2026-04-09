import os
import shutil
from pathlib import Path


def _resolve_base_dir() -> Path:
    """Repository root. Frozen launcher sets GROUND_CONTROL_BASE_DIR so .env and DB paths match the repo."""
    raw = (os.environ.get("GROUND_CONTROL_BASE_DIR") or "").strip()
    if raw:
        return Path(raw).resolve()
    return Path(__file__).resolve().parent.parent


BASE_DIR = _resolve_base_dir()


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(BASE_DIR / ".env")


_load_dotenv()


def _docker_postgres_sqlalchemy_url(database_name: str) -> str | None:
    """Build a Postgres URL from ``GROUND_CONTROL_POSTGRES_*`` when running in Docker (after secret hydration)."""
    import os
    from urllib.parse import quote_plus

    if not in_docker_deployment():
        return None
    pw = (os.environ.get("GROUND_CONTROL_POSTGRES_PASSWORD") or "").strip()
    if not pw:
        return None
    host = (os.environ.get("GROUND_CONTROL_POSTGRES_HOST") or "postgres").strip() or "postgres"
    user = (os.environ.get("GROUND_CONTROL_POSTGRES_USER") or "ground_control").strip() or "ground_control"
    u = quote_plus(user)
    p = quote_plus(pw)
    return f"postgresql+psycopg://{u}:{p}@{host}:5432/{database_name}"


def _database_url_impl(
    env_key: str,
    sqlite_relative_name: str,
    pg_database_name: str,
) -> str:
    import os

    raw = (os.environ.get(env_key) or "").strip()
    if raw:
        return raw
    built = _docker_postgres_sqlalchemy_url(pg_database_name)
    if built is not None:
        return built
    if in_docker_deployment():
        raise RuntimeError(
            f"Docker deployment requires a non-empty Docker secret ground_control_postgres_password "
            f"(hydrated as GROUND_CONTROL_POSTGRES_PASSWORD) or an explicit {env_key}."
        )
    return f"sqlite:///{BASE_DIR / sqlite_relative_name}"


def database_url() -> str:
    return _database_url_impl(
        "GROUND_CONTROL_DATABASE_URL",
        "ground_control.db",
        "ground_control",
    )


def monitor_database_url() -> str:
    return _database_url_impl(
        "GROUND_CONTROL_MONITOR_DATABASE_URL",
        "ground_control_monitor.db",
        "ground_control_monitor",
    )


def secrets_database_url() -> str:
    return _database_url_impl(
        "GROUND_CONTROL_SECRETS_DATABASE_URL",
        "ground_control_secrets.db",
        "ground_control_secrets",
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


def tls_certificate_renew_within_days() -> int:
    """Renew TLS when the active certificate expires within this many days (scheduler). Env: GROUND_CONTROL_TLS_RENEW_WITHIN_DAYS (1–365, default 30)."""
    import os

    raw = (os.environ.get("GROUND_CONTROL_TLS_RENEW_WITHIN_DAYS") or "").strip()
    if raw.isdigit():
        n = int(raw)
        if 1 <= n <= 365:
            return n
    return 30


def tls_auto_renewal_enabled() -> bool:
    """Daily TLS renewal job. Env: GROUND_CONTROL_TLS_AUTO_RENEW (default on; set 0/false/off to disable)."""
    import os

    raw = (os.environ.get("GROUND_CONTROL_TLS_AUTO_RENEW") or "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


SESSION_SECRET_ENV = "GROUND_CONTROL_SESSION_SECRET"
_FERNET_KEY_BASENAME = ".fernet_key"
_SESSION_SECRET_BASENAME = ".session_secret"


def fernet_key_file() -> Path:
    """Fernet key path: persist volume in Docker (``GROUND_CONTROL_PERSIST_DIR``), else repo base."""
    pr = persist_root()
    if pr is not None:
        return (pr / _FERNET_KEY_BASENAME).resolve()
    return (BASE_DIR / _FERNET_KEY_BASENAME).resolve()


def session_secret_file() -> Path:
    """Session signing secret file: same rule as :func:`fernet_key_file`."""
    pr = persist_root()
    if pr is not None:
        return (pr / _SESSION_SECRET_BASENAME).resolve()
    return (BASE_DIR / _SESSION_SECRET_BASENAME).resolve()


# Back-compat for code/tests that patch a fixed path (prefer :func:`fernet_key_file`).
FERNET_KEY_FILE = BASE_DIR / _FERNET_KEY_BASENAME
SESSION_SECRET_FILE = BASE_DIR / _SESSION_SECRET_BASENAME


def _migrate_legacy_crypto_files_to_persist() -> None:
    """Copy ``.fernet_key`` / ``.session_secret`` from ``BASE_DIR`` into persist root once (Docker volume)."""
    pr = persist_root()
    if pr is None:
        return
    pr.mkdir(parents=True, exist_ok=True)
    for name in (_FERNET_KEY_BASENAME, _SESSION_SECRET_BASENAME):
        dest = pr / name
        if dest.is_file():
            continue
        src = BASE_DIR / name
        if src.is_file():
            shutil.copy2(src, dest)

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


def persist_root() -> Path | None:
    """When set, security state, TLS material, and Let's Encrypt files live under this directory (e.g. Docker ``/data``)."""
    import os

    raw = (os.environ.get("GROUND_CONTROL_PERSIST_DIR") or "").strip()
    if not raw:
        return None
    return Path(raw).expanduser().resolve()


def in_docker_deployment() -> bool:
    import os

    v = (os.environ.get("GROUND_CONTROL_DOCKER") or "").strip().lower()
    if v in ("1", "true", "yes", "on"):
        return True
    return Path("/.dockerenv").is_file()


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
    primary = fernet_key_file()
    if primary.is_file():
        k = primary.read_text(encoding="utf-8").strip()
        if k:
            os.environ["GROUND_CONTROL_FERNET_KEY"] = k
        return k
    legacy = BASE_DIR / _FERNET_KEY_BASENAME
    if legacy.is_file():
        k = legacy.read_text(encoding="utf-8").strip()
        if k:
            os.environ["GROUND_CONTROL_FERNET_KEY"] = k
        return k
    return ""


def ensure_local_fernet_key() -> None:
    """If no key is configured, create ``.fernet_key`` on disk (persist dir when set)."""
    import logging
    import os

    _migrate_legacy_crypto_files_to_persist()
    if fernet_key():
        return
    from cryptography.fernet import Fernet

    path = fernet_key_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key().decode()
    path.write_text(key + "\n", encoding="utf-8")
    os.environ["GROUND_CONTROL_FERNET_KEY"] = key
    logging.getLogger("uvicorn.error").warning(
        "Created %s with a new encryption key. Back up this file; "
        "stored passwords cannot be decrypted without it. "
        "For production, prefer setting GROUND_CONTROL_FERNET_KEY instead.",
        path.name,
    )
