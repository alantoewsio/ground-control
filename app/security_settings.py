"""Security / TLS settings: persisted UI state, certificate summary, and TCP port checks."""

from __future__ import annotations

import json
import socket
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from starlette.requests import Request

from app import config

STATE_FILENAME = ".gc_security_state.json"
DEFAULT_TLS_SUBDIR = ".gc_tls"
CERT_NAME = "cert.pem"
KEY_NAME = "key.pem"


def _state_path() -> Path:
    return config.BASE_DIR / STATE_FILENAME


def tls_directory() -> Path:
    return config.BASE_DIR / DEFAULT_TLS_SUBDIR


def tls_cert_path() -> Path:
    import os

    p = (os.environ.get("GROUND_CONTROL_TLS_CERT_PATH") or "").strip()
    if p:
        return Path(p).expanduser()
    return tls_directory() / CERT_NAME


def tls_key_path() -> Path:
    import os

    p = (os.environ.get("GROUND_CONTROL_TLS_KEY_PATH") or "").strip()
    if p:
        return Path(p).expanduser()
    return tls_directory() / KEY_NAME


def read_tls_certificate_pem_bytes() -> bytes | None:
    """Return raw PEM bytes for the configured public certificate, or None if missing."""
    p = tls_cert_path()
    if not p.is_file():
        return None
    return p.read_bytes()


def listen_interface_to_bind_host(listen_interface: str) -> str:
    """Map saved UI value to a host string for uvicorn bind."""
    li = (listen_interface or "").strip()
    if li in ("0.0.0.0", "::", "127.0.0.1", "::1"):
        return li
    return "0.0.0.0"


def active_listen_ports_for_process() -> set[int]:
    """Ports this process is expected to bind (from saved security state)."""
    st = load_security_ui_state()
    ports: set[int] = set()
    if st.http_enabled:
        ports.add(st.http_port)
    if st.https_enabled and st.https_port is not None:
        ports.add(st.https_port)
    return ports


@dataclass
class SecurityUiState:
    http_enabled: bool
    https_enabled: bool
    redirect_http_to_https: bool
    http_port: int
    https_port: int | None
    listen_interface: str
    allowed_ranges: str
    tls_hostname: str

    def to_json_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d

    @classmethod
    def from_json_dict(cls, raw: dict[str, Any]) -> SecurityUiState:
        return cls(
            http_enabled=bool(raw.get("http_enabled", True)),
            https_enabled=bool(raw.get("https_enabled", True)),
            redirect_http_to_https=bool(raw.get("redirect_http_to_https", True)),
            http_port=int(raw["http_port"]),
            https_port=int(raw["https_port"]) if raw.get("https_port") is not None else None,
            listen_interface=str(raw.get("listen_interface") or "127.0.0.1"),
            allowed_ranges=str(raw.get("allowed_ranges") or ""),
            tls_hostname=str(raw.get("tls_hostname") or ""),
        )


def default_security_ui_state() -> SecurityUiState:
    return SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=True,
        http_port=config.http_listen_port(),
        https_port=config.https_listen_port(),
        listen_interface="127.0.0.1",
        allowed_ranges="",
        tls_hostname="localhost",
    )


_sec_state_cache: SecurityUiState | None = None
_sec_state_cache_key: tuple[bool, float] | None = None


def invalidate_security_ui_state_cache() -> None:
    global _sec_state_cache, _sec_state_cache_key
    _sec_state_cache = None
    _sec_state_cache_key = None


def load_security_ui_state() -> SecurityUiState:
    global _sec_state_cache, _sec_state_cache_key
    path = _state_path()
    try:
        exists = path.is_file()
        mtime = path.stat().st_mtime if exists else 0.0
    except OSError:
        exists, mtime = False, 0.0
    key = (exists, mtime)
    if _sec_state_cache is not None and key == _sec_state_cache_key:
        return _sec_state_cache

    if not path.is_file():
        result = default_security_ui_state()
        _sec_state_cache = result
        _sec_state_cache_key = key
        return result
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            result = default_security_ui_state()
            _sec_state_cache = result
            _sec_state_cache_key = key
            return result
        base = default_security_ui_state()
        merged = {**base.to_json_dict(), **raw}
        if merged.get("https_port") is None:
            merged["https_port"] = base.https_port
        if not str(merged.get("tls_hostname") or "").strip():
            merged["tls_hostname"] = base.tls_hostname
        if not str(merged.get("listen_interface") or "").strip():
            merged["listen_interface"] = base.listen_interface
        result = SecurityUiState.from_json_dict(merged)
        _sec_state_cache = result
        _sec_state_cache_key = key
        return result
    except (OSError, ValueError, TypeError, KeyError):
        result = default_security_ui_state()
        _sec_state_cache = result
        _sec_state_cache_key = key
        return result


def save_security_ui_state(state: SecurityUiState) -> None:
    path = _state_path()
    path.write_text(json.dumps(state.to_json_dict(), indent=2) + "\n", encoding="utf-8")
    invalidate_security_ui_state_cache()


def load_https_certificate_summary() -> dict[str, Any]:
    """Return certificate metadata if PEM cert+key paths exist and cert parses."""
    cert_p = tls_cert_path()
    key_p = tls_key_path()
    if not cert_p.is_file() or not key_p.is_file():
        return {
            "present": False,
            "primary_hostname": None,
            "subject_common_name": None,
            "dns_names": [],
            "not_after": None,
            "cert_path": str(cert_p),
            "key_path": str(key_p),
        }
    try:
        pem = cert_p.read_bytes()
        cert = x509.load_pem_x509_certificate(pem)
    except ValueError:
        return {
            "present": False,
            "primary_hostname": None,
            "subject_common_name": None,
            "dns_names": [],
            "not_after": None,
            "cert_path": str(cert_p),
            "key_path": str(key_p),
        }

    dns_names: list[str] = []
    try:
        ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
        for g in ext.value:
            if isinstance(g, x509.DNSName):
                dns_names.append(g.value)
    except x509.ExtensionNotFound:
        pass

    subject_cn: str | None = None
    for attr in cert.subject:
        if attr.oid == NameOID.COMMON_NAME:
            subject_cn = str(attr.value)
            break

    primary = dns_names[0] if dns_names else subject_cn
    try:
        na = cert.not_valid_after_utc.isoformat()
    except AttributeError:
        na = cert.not_valid_after.isoformat()  # type: ignore[attr-defined]

    return {
        "present": True,
        "primary_hostname": primary,
        "subject_common_name": subject_cn,
        "dns_names": dns_names,
        "not_after": na,
        "cert_path": str(cert_p),
        "key_path": str(key_p),
    }


def ensure_tls_certificate_if_https_enabled() -> None:
    """When HTTPS is enabled in settings, ensure a certificate exists (self-signed if missing)."""
    import logging
    import os

    if os.environ.get("GROUND_CONTROL_UNDER_PYTEST") == "1":
        return
    st = load_security_ui_state()
    if not st.https_enabled:
        return
    if load_https_certificate_summary()["present"]:
        return
    host = (st.tls_hostname or "").strip() or "localhost"
    try:
        generate_self_signed_certificate(host)
    except Exception:
        logging.getLogger("uvicorn.error").warning(
            "Could not auto-generate TLS certificate for HTTPS (hostname=%s).", host, exc_info=True
        )


def build_http_to_https_redirect_url(
    st: SecurityUiState, *, path: str, query: str
) -> str | None:
    """Return absolute https URL to redirect to, or None if redirect should not apply."""
    if not (st.redirect_http_to_https and st.https_enabled and st.http_enabled):
        return None
    if path.startswith("/.well-known/acme-challenge/"):
        return None
    hn = (st.tls_hostname or "localhost").strip() or "localhost"
    hp = st.https_port if st.https_port is not None else config.https_listen_port()
    netloc = f"{hn}:{hp}" if hp != 443 else hn
    target = f"https://{netloc}{path}"
    if query:
        target = f"{target}?{query}"
    return target


def https_redirect_url_if_applicable(request: Request) -> str | None:
    """Middleware helper: redirect HTTP → HTTPS when configured (disabled under pytest)."""
    import os

    if os.environ.get("GROUND_CONTROL_UNDER_PYTEST") == "1":
        return None
    if request.url.scheme != "http":
        return None
    if request.headers.get("upgrade", "").lower() == "websocket":
        return None
    st = load_security_ui_state()
    return build_http_to_https_redirect_url(
        st, path=request.url.path, query=request.url.query
    )


def generate_self_signed_certificate(hostname: str) -> None:
    from datetime import datetime, timedelta, timezone

    host = hostname.strip()
    if not host or len(host) > 253:
        raise ValueError("Invalid hostname.")

    tls_dir = tls_directory()
    tls_dir.mkdir(parents=True, exist_ok=True)
    cert_path = tls_cert_path()
    key_path = tls_key_path()

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, host)])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=825))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName(host)]), critical=False)
        .sign(key, hashes.SHA256())
    )

    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )


def tcp_listen_port_available(port: int, *, ports_held_by_this_process: set[int]) -> tuple[bool, str | None]:
    """Return (True, None) if we can bind 0.0.0.0:port, or (False, reason).

    Ports already used by this server are treated as available so unchanged settings validate.
    """
    if port in ports_held_by_this_process:
        return True, None
    s: socket.socket | None = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("0.0.0.0", port))
        return True, None
    except OSError as e:
        return False, str(e)
    finally:
        if s is not None:
            s.close()


def validate_security_apply(
    state: SecurityUiState,
    *,
    ports_held_by_this_process: set[int],
) -> list[str]:
    """Return a list of human-readable errors; empty means OK."""
    errors: list[str] = []
    cert = load_https_certificate_summary()

    if not state.http_enabled and not state.https_enabled:
        errors.append("At least one of HTTP or HTTPS must remain enabled.")

    if state.http_enabled:
        if not (1 <= state.http_port <= 65535):
            errors.append("HTTP port must be between 1 and 65535.")
        else:
            ok, reason = tcp_listen_port_available(state.http_port, ports_held_by_this_process=ports_held_by_this_process)
            if not ok:
                errors.append(f"HTTP port {state.http_port} is not available ({reason}).")
    if state.https_enabled:
        if not cert["present"]:
            errors.append("Enable HTTPS only after a TLS certificate is present (generate or install cert and key).")
        if state.https_port is None or not (1 <= state.https_port <= 65535):
            errors.append("HTTPS port is required and must be between 1 and 65535 when HTTPS is enabled.")
        else:
            ok, reason = tcp_listen_port_available(
                state.https_port, ports_held_by_this_process=ports_held_by_this_process
            )
            if not ok:
                errors.append(f"HTTPS port {state.https_port} is not available ({reason}).")
            if state.http_enabled and state.https_port == state.http_port:
                errors.append("HTTP and HTTPS ports must be different.")

    if state.redirect_http_to_https and not state.https_enabled:
        errors.append("Redirect HTTP to HTTPS requires HTTPS to be enabled.")

    return errors


def security_settings_payload() -> dict[str, Any]:
    """Response body for GET /api/settings/security."""
    st = load_security_ui_state()
    cert = load_https_certificate_summary()
    runtime_http = config.http_listen_port()
    runtime_https = config.https_listen_port()
    return {
        "http_enabled": st.http_enabled,
        "https_enabled": st.https_enabled,
        "redirect_http_to_https": st.redirect_http_to_https,
        "http_port": st.http_port,
        "https_port": st.https_port,
        "listen_interface": st.listen_interface,
        "allowed_ranges": st.allowed_ranges,
        "tls_hostname": st.tls_hostname,
        "runtime_http_port": runtime_http,
        "runtime_https_port": runtime_https,
        "certificate": cert,
    }
