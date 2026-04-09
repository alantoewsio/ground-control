"""Docker Compose / Swarm secrets: read ``/run/secrets/<name>`` into environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

RUN_SECRETS_DIR = Path("/run/secrets")

DOCKER_TLS_HOSTNAMES_DEFAULT = "gc.local\nlocalhost\n127.0.0.1"

# Written by the launcher Let's Encrypt panel; hydrated like other secrets but not shown in the core list.
DOCKER_LE_SECRET_FILE_NAMES: tuple[str, ...] = (
    "ground_control_letsencrypt_validation_method",
    "ground_control_letsencrypt_dns_plugin",
    "ground_control_letsencrypt_email",
    "ground_control_letsencrypt_dns_credentials_ini",
    "ground_control_letsencrypt_google_credentials_json",
)

_DOCKER_LE_SECRET_ENV: tuple[tuple[str, str], ...] = (
    ("ground_control_letsencrypt_validation_method", "GROUND_CONTROL_LE_VALIDATION_METHOD"),
    ("ground_control_letsencrypt_dns_plugin", "GROUND_CONTROL_LE_DNS_PLUGIN"),
    ("ground_control_letsencrypt_email", "GROUND_CONTROL_LE_EMAIL"),
    ("ground_control_letsencrypt_dns_credentials_ini", "GROUND_CONTROL_LE_DNS_CREDENTIALS_INI"),
    ("ground_control_letsencrypt_google_credentials_json", "GROUND_CONTROL_LE_GOOGLE_CREDENTIALS_JSON"),
)


@dataclass(frozen=True)
class DockerSecretSpec:
    """Secret file basename under ``/run/secrets`` (no path)."""

    file_name: str
    env_var: str
    label: str
    field_kind: str = "entry"  # entry | combobox | multiline
    choices: tuple[str, ...] | None = None
    default_when_empty: str | None = None
    sensitive: bool = True


# Tray “core” rows + compose secret files (session/fernet are not launcher-managed).
DOCKER_SECRET_SPECS: tuple[DockerSecretSpec, ...] = (
    DockerSecretSpec(
        "ground_control_default_admin_password",
        "GROUND_CONTROL_DEFAULT_ADMIN_PASSWORD",
        "Default admin password (min 10 characters; applied to built-in admin user)",
        field_kind="entry",
        sensitive=True,
    ),
    DockerSecretSpec(
        "ground_control_http_port",
        "PORT",
        "HTTP listen port (container)",
        field_kind="entry",
        sensitive=False,
    ),
    DockerSecretSpec(
        "ground_control_https_port",
        "GROUND_CONTROL_HTTPS_PORT",
        "HTTPS listen port (container)",
        field_kind="entry",
        sensitive=False,
    ),
    DockerSecretSpec(
        "ground_control_tls_hostnames",
        "GROUND_CONTROL_TLS_HOSTNAMES",
        "TLS hostnames (one per line)",
        field_kind="multiline",
        default_when_empty=DOCKER_TLS_HOSTNAMES_DEFAULT,
        sensitive=False,
    ),
    DockerSecretSpec(
        "ground_control_cert_source",
        "GROUND_CONTROL_CERT_SOURCE",
        "Certificate source",
        field_kind="combobox",
        choices=("self_signed", "letsencrypt"),
        default_when_empty="self_signed",
        sensitive=False,
    ),
    DockerSecretSpec(
        "ground_control_http_enabled",
        "GROUND_CONTROL_HTTP_ENABLED",
        "Enable HTTP listener",
        field_kind="combobox",
        choices=("true", "false"),
        default_when_empty="true",
        sensitive=False,
    ),
    DockerSecretSpec(
        "ground_control_https_enabled",
        "GROUND_CONTROL_HTTPS_ENABLED",
        "Enable HTTPS listener",
        field_kind="combobox",
        choices=("true", "false"),
        default_when_empty="true",
        sensitive=False,
    ),
    DockerSecretSpec(
        "ground_control_redirect_http_to_https",
        "GROUND_CONTROL_REDIRECT_HTTP_TO_HTTPS",
        "Redirect HTTP to HTTPS",
        field_kind="combobox",
        choices=("true", "false"),
        default_when_empty="true",
        sensitive=False,
    ),
    DockerSecretSpec(
        "ground_control_listen_interface",
        "GROUND_CONTROL_LISTEN_INTERFACE",
        "Listen interface (e.g. 0.0.0.0, 127.0.0.1)",
        field_kind="entry",
        default_when_empty="0.0.0.0",
        sensitive=False,
    ),
    DockerSecretSpec(
        "ground_control_allowed_ranges",
        "GROUND_CONTROL_ALLOWED_RANGES",
        "Allowed client IP ranges (optional; same format as Security settings)",
        field_kind="multiline",
        sensitive=False,
    ),
)

SECRET_SPECS_BY_FILE: dict[str, DockerSecretSpec] = {s.file_name: s for s in DOCKER_SECRET_SPECS}


def _read_secret_file(path: Path) -> str | None:
    try:
        if not path.is_file():
            return None
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return None
    if raw is None:
        return None
    text = raw.replace("\r\n", "\n").strip("\n\r")
    if not text.strip():
        return None
    return text


def hydrate_docker_secrets_into_environ() -> None:
    """If a secret file exists and is non-empty, set the corresponding env var (unless already set).

    Compose/Swarm mount secrets under ``/run/secrets``. Non-empty environment variables take
    precedence so operators can override without removing secret mounts.
    """
    if not RUN_SECRETS_DIR.is_dir():
        return
    for spec in DOCKER_SECRET_SPECS:
        if (os.environ.get(spec.env_var) or "").strip():
            continue
        val = _read_secret_file(RUN_SECRETS_DIR / spec.file_name)
        if val is not None:
            os.environ[spec.env_var] = val
    for file_name, env_key in _DOCKER_LE_SECRET_ENV:
        if (os.environ.get(env_key) or "").strip():
            continue
        val = _read_secret_file(RUN_SECRETS_DIR / file_name)
        if val is not None:
            os.environ[env_key] = val


def docker_secret_file_names() -> list[str]:
    return [s.file_name for s in DOCKER_SECRET_SPECS] + list(DOCKER_LE_SECRET_FILE_NAMES)


def docker_secret_value_present(file_name: str) -> bool:
    """True when ``/run/secrets/<file_name>`` exists and has non-whitespace content."""
    return _read_secret_file(RUN_SECRETS_DIR / file_name) is not None


def run_secrets_directory_has_values() -> bool:
    """True when ``/run/secrets`` exists and at least one Ground Control secret file is non-empty."""
    if not RUN_SECRETS_DIR.is_dir():
        return False
    for spec in DOCKER_SECRET_SPECS:
        if _read_secret_file(RUN_SECRETS_DIR / spec.file_name):
            return True
    for name in DOCKER_LE_SECRET_FILE_NAMES:
        if _read_secret_file(RUN_SECRETS_DIR / name):
            return True
    return False
