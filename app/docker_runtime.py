"""Apply Docker-provided environment (including secrets) to persisted Ground Control state."""

from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

from app import config, letsencrypt_service, security_settings
from app.auth import hash_password
from app.letsencrypt_service import LetsEncryptSettings, PLUGIN_BY_ID
from app.secrets_database import SecretsSessionLocal, init_secrets_db
from app.secrets_models import AppUser, DEFAULT_ADMIN_USERNAME
from app.security_settings import SecurityUiState, parse_tls_hostnames_blob, save_security_ui_state
from app.users_service import ensure_default_admin_user, update_app_user_password_hash

_LOG = logging.getLogger("uvicorn.error")

_FINGERPRINT_REL = ".gc_docker_runtime_fingerprint.json"
_ADMIN_PW_HASH_REL = ".gc_docker_admin_password_applied.sha256"


def _persist_dir() -> Path:
    pr = config.persist_root()
    return pr if pr is not None else config.BASE_DIR


def _fingerprint_path() -> Path:
    return _persist_dir() / _FINGERPRINT_REL


def _admin_pw_record_path() -> Path:
    return _persist_dir() / _ADMIN_PW_HASH_REL


def _parse_bool(raw: str | None) -> bool | None:
    if raw is None:
        return None
    s = str(raw).strip().lower()
    if not s:
        return None
    if s in ("1", "true", "yes", "on"):
        return True
    if s in ("0", "false", "no", "off"):
        return False
    return None


def _parse_port(raw: str | None) -> int | None:
    if raw is None or not str(raw).strip():
        return None
    try:
        v = int(str(raw).strip())
    except ValueError:
        return None
    if 1 <= v <= 65535:
        return v
    return None


def _bundle_from_environ() -> dict[str, Any]:
    """Normalized snapshot of docker-driven settings (for fingerprinting).

    Excludes default admin password and crypto secrets so rotating them does not re-run TLS issuance.
    """
    keys = (
        "PORT",
        "GROUND_CONTROL_HTTP_PORT",
        "GROUND_CONTROL_HTTPS_PORT",
        "GROUND_CONTROL_TLS_HOSTNAMES",
        "GROUND_CONTROL_CERT_SOURCE",
        "GROUND_CONTROL_HTTP_ENABLED",
        "GROUND_CONTROL_HTTPS_ENABLED",
        "GROUND_CONTROL_REDIRECT_HTTP_TO_HTTPS",
        "GROUND_CONTROL_LISTEN_INTERFACE",
        "GROUND_CONTROL_ALLOWED_RANGES",
        "GROUND_CONTROL_LE_VALIDATION_METHOD",
        "GROUND_CONTROL_LE_DNS_PLUGIN",
        "GROUND_CONTROL_LE_EMAIL",
        "GROUND_CONTROL_LE_DNS_CREDENTIALS_INI",
        "GROUND_CONTROL_LE_GOOGLE_CREDENTIALS_JSON",
    )
    out: dict[str, Any] = {}
    for k in keys:
        v = (os.environ.get(k) or "").strip()
        if k == "GROUND_CONTROL_LE_DNS_CREDENTIALS_INI" and v:
            out[k] = hashlib.sha256(v.encode("utf-8")).hexdigest()
            continue
        if k == "GROUND_CONTROL_LE_GOOGLE_CREDENTIALS_JSON" and v:
            out[k] = hashlib.sha256(v.encode("utf-8")).hexdigest()
            continue
        if v:
            out[k] = v
    return dict(sorted(out.items()))


def _fingerprint_of_bundle(bundle: dict[str, Any]) -> str:
    raw = json.dumps(bundle, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _merge_security_from_env(base: SecurityUiState) -> SecurityUiState:
    d = base.to_json_dict()
    p_http = _parse_port(os.environ.get("GROUND_CONTROL_HTTP_PORT") or os.environ.get("PORT"))
    if p_http is not None:
        d["http_port"] = p_http
    p_https = _parse_port(os.environ.get("GROUND_CONTROL_HTTPS_PORT"))
    if p_https is not None:
        d["https_port"] = p_https
    th = (os.environ.get("GROUND_CONTROL_TLS_HOSTNAMES") or "").strip()
    if th:
        d["tls_hostnames"] = th
    cs = (os.environ.get("GROUND_CONTROL_CERT_SOURCE") or "").strip().lower()
    if cs in ("self_signed", "letsencrypt"):
        d["cert_source"] = cs
    for key, field in (
        ("GROUND_CONTROL_HTTP_ENABLED", "http_enabled"),
        ("GROUND_CONTROL_HTTPS_ENABLED", "https_enabled"),
        ("GROUND_CONTROL_REDIRECT_HTTP_TO_HTTPS", "redirect_http_to_https"),
    ):
        b = _parse_bool(os.environ.get(key))
        if b is not None:
            d[field] = b
    li = (os.environ.get("GROUND_CONTROL_LISTEN_INTERFACE") or "").strip()
    if li:
        d["listen_interface"] = li
    ar = (os.environ.get("GROUND_CONTROL_ALLOWED_RANGES") or "").strip()
    if ar:
        d["allowed_ranges"] = ar
    sidle = (os.environ.get("GROUND_CONTROL_SESSION_IDLE_MINUTES") or "").strip()
    if sidle:
        try:
            v = int(sidle)
        except ValueError:
            pass
        else:
            if v >= 0:
                d["session_idle_timeout_minutes"] = min(v, 525600)
    return SecurityUiState.from_json_dict(d)


def _write_le_credentials_from_env() -> None:
    ini = (os.environ.get("GROUND_CONTROL_LE_DNS_CREDENTIALS_INI") or "").strip()
    if ini:
        letsencrypt_service.letsencrypt_data_dir().mkdir(parents=True, exist_ok=True)
        letsencrypt_service._dns_ini_path().write_text(
            ini if ini.endswith("\n") else ini + "\n", encoding="utf-8"
        )
        letsencrypt_service.invalidate_letsencrypt_cache()
    gjson = (os.environ.get("GROUND_CONTROL_LE_GOOGLE_CREDENTIALS_JSON") or "").strip()
    if gjson:
        letsencrypt_service.letsencrypt_data_dir().mkdir(parents=True, exist_ok=True)
        letsencrypt_service._google_creds_path().write_text(
            gjson if gjson.endswith("\n") else gjson + "\n", encoding="utf-8"
        )
        letsencrypt_service.invalidate_letsencrypt_cache()


def _merge_letsencrypt_from_env() -> None:
    vm = (os.environ.get("GROUND_CONTROL_LE_VALIDATION_METHOD") or "").strip().lower()
    if vm not in ("", "http", "dns"):
        vm = ""
    plug = (os.environ.get("GROUND_CONTROL_LE_DNS_PLUGIN") or "").strip().lower()
    email = (os.environ.get("GROUND_CONTROL_LE_EMAIL") or "").strip()
    prev = letsencrypt_service.load_letsencrypt_settings()
    merged = prev.to_json_dict()
    if vm:
        merged["validation_method"] = vm
    if plug and plug in PLUGIN_BY_ID:
        merged["dns_plugin"] = plug
    if email:
        merged["email"] = email
    st = LetsEncryptSettings.from_json_dict(merged)
    if vm or plug or email:
        letsencrypt_service.save_letsencrypt_settings(st)
    _write_le_credentials_from_env()


def _refresh_tls_after_bundle_change() -> None:
    security_settings.invalidate_security_ui_state_cache()
    st = security_settings.load_security_ui_state()
    if not st.https_enabled:
        return
    if st.cert_source == "letsencrypt":
        if not letsencrypt_service.is_letsencrypt_setup_complete():
            _LOG.warning(
                "Docker secrets: Let's Encrypt is not fully configured; skipping certificate fetch."
            )
            return
        names = parse_tls_hostnames_blob(st.tls_hostnames)
        if not names:
            _LOG.warning("Docker secrets: no TLS hostnames; skipping Let's Encrypt fetch.")
            return
        ok, msg = letsencrypt_service.obtain_certificate_and_install(names)
        if not ok:
            _LOG.warning("Docker secrets: Let's Encrypt obtain failed: %s", msg[:2000])
        return
    names = parse_tls_hostnames_blob(st.tls_hostnames)
    if not names:
        names = ["localhost"]
    try:
        security_settings.generate_self_signed_certificate(names)
    except Exception:
        _LOG.warning("Docker secrets: could not regenerate self-signed certificate.", exc_info=True)


def apply_docker_runtime_bundle_from_environment() -> None:
    """If any docker-driven env vars are set, merge into on-disk settings when the bundle changed."""
    bundle = _bundle_from_environ()
    if not bundle:
        return
    fp_new = _fingerprint_of_bundle(bundle)
    fp_path = _fingerprint_path()
    prev_fp = None
    if fp_path.is_file():
        try:
            prev = json.loads(fp_path.read_text(encoding="utf-8"))
            if isinstance(prev, dict):
                prev_fp = prev.get("sha256")
        except (OSError, ValueError, TypeError):
            prev_fp = None
    if prev_fp == fp_new:
        return

    base = security_settings.load_security_ui_state()
    new_st = _merge_security_from_env(base)
    if new_st.to_json_dict() != base.to_json_dict():
        save_security_ui_state(new_st)
    security_settings.invalidate_security_ui_state_cache()
    _merge_letsencrypt_from_env()
    try:
        _refresh_tls_after_bundle_change()
    finally:
        fp_path.parent.mkdir(parents=True, exist_ok=True)
        fp_path.write_text(json.dumps({"sha256": fp_new}, indent=2) + "\n", encoding="utf-8")


def apply_docker_default_admin_password() -> None:
    """Set the built-in admin password from env when it changes (after secrets DB init)."""
    raw = (os.environ.get("GROUND_CONTROL_DEFAULT_ADMIN_PASSWORD") or "").strip()
    if not raw:
        return
    if len(raw) < 10:
        _LOG.warning("GROUND_CONTROL_DEFAULT_ADMIN_PASSWORD ignored (must be at least 10 characters).")
        return
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    rec_path = _admin_pw_record_path()
    if rec_path.is_file():
        try:
            if rec_path.read_text(encoding="utf-8").strip() == h:
                return
        except OSError:
            pass
    init_secrets_db()
    pwd_hash = hash_password(raw)
    with SecretsSessionLocal() as db:
        ensure_default_admin_user(db)
        row = db.scalars(
            select(AppUser).where(func.lower(AppUser.username) == DEFAULT_ADMIN_USERNAME.lower())
        ).first()
        if not row:
            return
        update_app_user_password_hash(db, row.id, pwd_hash)
    rec_path.parent.mkdir(parents=True, exist_ok=True)
    rec_path.write_text(h + "\n", encoding="utf-8")


def _should_apply_runtime_from_env() -> bool:
    """Avoid merging env into persisted settings on every developer workstation import."""
    if config.in_docker_deployment():
        return True
    raw = (os.environ.get("GROUND_CONTROL_APPLY_DOCKER_RUNTIME") or "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    from app.docker_secrets import run_secrets_directory_has_values

    return run_secrets_directory_has_values()


def prepare_docker_runtime_if_configured() -> None:
    """Hydrate ``/run/secrets``, default persist dir in Docker, merge settings, optional admin password."""
    from app.docker_secrets import hydrate_docker_secrets_into_environ

    hydrate_docker_secrets_into_environ()
    if config.in_docker_deployment() and not (os.environ.get("GROUND_CONTROL_PERSIST_DIR") or "").strip():
        os.environ["GROUND_CONTROL_PERSIST_DIR"] = "/data"
    if not _should_apply_runtime_from_env():
        return
    apply_docker_runtime_bundle_from_environment()
    if config.in_docker_deployment():
        apply_docker_default_admin_password()
