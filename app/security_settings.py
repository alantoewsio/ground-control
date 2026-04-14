"""Security / TLS settings: persisted UI state, certificate summary, and TCP port checks."""

from __future__ import annotations

import json
import shutil
import socket
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from urllib.parse import urlparse

from starlette.requests import Request

from app import config
from app.letsencrypt_service import validate_hostname_list
from app.url_helpers import https_admin_url_for_firewall, request_is_https_session

STATE_FILENAME = ".gc_security_state.json"
DEFAULT_TLS_SUBDIR = ".gc_tls"
CERT_NAME = "cert.pem"
KEY_NAME = "key.pem"
SELF_SIGNED_ARCHIVE_CERT = "self_signed_fullchain.pem"
SELF_SIGNED_ARCHIVE_KEY = "self_signed_key.pem"


def parse_tls_hostnames_blob(raw: str) -> list[str]:
    """One hostname per line (or comma-separated); dedupe case-insensitively, preserve first spelling."""
    out: list[str] = []
    seen: set[str] = set()
    text = str(raw or "").replace(",", "\n")
    for line in text.splitlines():
        h = line.strip().rstrip(".")
        if not h:
            continue
        key = h.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(h)
    return out


def primary_tls_hostname(st: "SecurityUiState") -> str:
    names = parse_tls_hostnames_blob(st.tls_hostnames)
    return names[0] if names else "localhost"


def _state_path() -> Path:
    pr = config.persist_root()
    base = pr if pr is not None else config.BASE_DIR
    return base / STATE_FILENAME


def tls_directory() -> Path:
    pr = config.persist_root()
    base = pr if pr is not None else config.BASE_DIR
    return base / DEFAULT_TLS_SUBDIR


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


def self_signed_archive_cert_path() -> Path:
    return tls_directory() / SELF_SIGNED_ARCHIVE_CERT


def self_signed_archive_key_path() -> Path:
    return tls_directory() / SELF_SIGNED_ARCHIVE_KEY


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


def normalize_session_idle_timeout_minutes(
    value: object, *, fallback: int | None = None
) -> int:
    """Persisted / UI value: 0 disables idle timeout; max one year in minutes."""
    fb = fallback if fallback is not None else config.DEFAULT_SESSION_IDLE_MINUTES
    try:
        n = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return fb
    if n < 0:
        return fb
    return min(n, 525600)


def effective_session_idle_timeout_minutes() -> int:
    """Env ``GROUND_CONTROL_SESSION_IDLE_MINUTES`` overrides saved security settings when set."""
    import os

    raw = (os.environ.get("GROUND_CONTROL_SESSION_IDLE_MINUTES") or "").strip()
    if raw:
        try:
            v = int(raw)
        except ValueError:
            return config.DEFAULT_SESSION_IDLE_MINUTES
        if v < 0:
            return config.DEFAULT_SESSION_IDLE_MINUTES
        return min(v, 525600)
    st = load_security_ui_state()
    return normalize_session_idle_timeout_minutes(st.session_idle_timeout_minutes)


@dataclass
class SecurityUiState:
    http_enabled: bool
    https_enabled: bool
    redirect_http_to_https: bool
    http_port: int
    https_port: int | None
    listen_interface: str
    allowed_ranges: str
    tls_hostnames: str
    cert_source: str  # self_signed | letsencrypt
    session_idle_timeout_minutes: int = config.DEFAULT_SESSION_IDLE_MINUTES

    def to_json_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_json_dict(cls, raw: dict[str, Any]) -> SecurityUiState:
        cs = str(raw.get("cert_source") or "self_signed")
        if cs not in ("self_signed", "letsencrypt"):
            cs = "self_signed"
        th = str(raw.get("tls_hostnames") or "").strip()
        if not th and raw.get("tls_hostname"):
            th = str(raw.get("tls_hostname") or "").strip()
        idle = normalize_session_idle_timeout_minutes(raw.get("session_idle_timeout_minutes"))
        return cls(
            http_enabled=bool(raw.get("http_enabled", True)),
            https_enabled=bool(raw.get("https_enabled", True)),
            redirect_http_to_https=bool(raw.get("redirect_http_to_https", True)),
            http_port=int(raw["http_port"]),
            https_port=int(raw["https_port"]) if raw.get("https_port") is not None else None,
            listen_interface=str(raw.get("listen_interface") or "127.0.0.1"),
            allowed_ranges=str(raw.get("allowed_ranges") or ""),
            tls_hostnames=th,
            cert_source=cs,
            session_idle_timeout_minutes=idle,
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
        tls_hostnames="localhost",
        cert_source="self_signed",
        session_idle_timeout_minutes=config.DEFAULT_SESSION_IDLE_MINUTES,
    )


def security_listen_settings_changed(before: SecurityUiState, after: SecurityUiState) -> bool:
    """Whether HTTP/HTTPS bind options changed (typically needs process restart)."""
    if (
        before.http_enabled != after.http_enabled
        or before.https_enabled != after.https_enabled
        or before.redirect_http_to_https != after.redirect_http_to_https
        or before.http_port != after.http_port
        or before.listen_interface != after.listen_interface
    ):
        return True
    # When HTTPS is off, persisted state may still carry a placeholder https_port; ignore it.
    if before.https_enabled and after.https_enabled:
        return before.https_port != after.https_port
    return False


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
        if str(raw.get("tls_hostnames") or "").strip():
            merged["tls_hostnames"] = str(raw["tls_hostnames"]).strip()
        elif str(raw.get("tls_hostname") or "").strip():
            merged["tls_hostnames"] = str(raw["tls_hostname"]).strip()
        elif not str(merged.get("tls_hostnames") or "").strip():
            merged["tls_hostnames"] = base.tls_hostnames
        cs = str(merged.get("cert_source") or "").strip()
        if cs not in ("self_signed", "letsencrypt"):
            merged["cert_source"] = base.cert_source
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


def _absent_tls_summary(cert_p: Path, key_p: Path) -> dict[str, Any]:
    return {
        "present": False,
        "primary_hostname": None,
        "subject_common_name": None,
        "dns_names": [],
        "not_after": None,
        "cert_path": str(cert_p),
        "key_path": str(key_p),
        "chain_certificate_count": 0,
        "is_self_signed": None,
    }


def summarize_tls_keypair_paths(cert_p: Path, key_p: Path) -> dict[str, Any]:
    """Parse PEM at ``cert_p`` (may contain multiple certificates); metadata from the leaf (first block)."""
    if not cert_p.is_file() or not key_p.is_file():
        return _absent_tls_summary(cert_p, key_p)
    try:
        pem = cert_p.read_bytes()
        certs = x509.load_pem_x509_certificates(pem)
    except ValueError:
        return _absent_tls_summary(cert_p, key_p)
    if not certs:
        return _absent_tls_summary(cert_p, key_p)
    cert = certs[0]
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
        "chain_certificate_count": len(certs),
        "is_self_signed": cert.issuer == cert.subject,
    }


def load_https_certificate_summary() -> dict[str, Any]:
    """Return certificate metadata if PEM cert+key paths exist and cert parses."""
    return summarize_tls_keypair_paths(tls_cert_path(), tls_key_path())


def _letsencrypt_live_keypair_paths() -> tuple[Path, Path] | None:
    from app import letsencrypt_service

    live = letsencrypt_service.certbot_config_dir() / "live" / letsencrypt_service.CERT_LINEAGE_NAME
    chain = live / "fullchain.pem"
    key = live / "privkey.pem"
    if chain.is_file() and key.is_file():
        return chain, key
    return None


def load_self_signed_certificate_summary() -> dict[str, Any]:
    """Last generated self-signed material (archive), or the active TLS pair when it is self-signed."""
    arch_c = self_signed_archive_cert_path()
    arch_k = self_signed_archive_key_path()
    if arch_c.is_file() and arch_k.is_file():
        s = summarize_tls_keypair_paths(arch_c, arch_k)
        out = dict(s)
        out["bundle"] = "archive"
        return out
    c, k = tls_cert_path(), tls_key_path()
    if c.is_file() and k.is_file():
        s = summarize_tls_keypair_paths(c, k)
        if s["present"] and s.get("is_self_signed"):
            out = dict(s)
            out["bundle"] = "active"
            return out
    absent = _absent_tls_summary(arch_c, arch_k)
    absent["bundle"] = None
    return absent


def load_letsencrypt_certificate_summary() -> dict[str, Any]:
    """Certbot ``fullchain.pem`` when present, else active TLS files when the leaf is not self-signed."""
    live = _letsencrypt_live_keypair_paths()
    if live:
        s = summarize_tls_keypair_paths(live[0], live[1])
        out = dict(s)
        out["bundle"] = "certbot_live"
        return out
    from app import letsencrypt_service

    placeholder_c = (
        letsencrypt_service.certbot_config_dir()
        / "live"
        / letsencrypt_service.CERT_LINEAGE_NAME
        / "fullchain.pem"
    )
    placeholder_k = placeholder_c.with_name("privkey.pem")
    c, k = tls_cert_path(), tls_key_path()
    if c.is_file() and k.is_file():
        s = summarize_tls_keypair_paths(c, k)
        if s["present"] and s.get("is_self_signed") is False:
            out = dict(s)
            out["bundle"] = "active_chain"
            return out
    absent = _absent_tls_summary(placeholder_c, placeholder_k)
    absent["bundle"] = None
    return absent


def read_tls_certificate_chain_pem_bytes(bundle: str) -> bytes | None:
    """Return PEM bytes (full chain file) for ``self_signed`` or ``letsencrypt``."""
    kind = (bundle or "").strip().lower()
    if kind == "self_signed":
        ac, ak = self_signed_archive_cert_path(), self_signed_archive_key_path()
        if ac.is_file() and ak.is_file():
            return ac.read_bytes()
        c, kp = tls_cert_path(), tls_key_path()
        if not (c.is_file() and kp.is_file()):
            return None
        try:
            pem = c.read_bytes()
            certs = x509.load_pem_x509_certificates(pem)
        except ValueError:
            return None
        if certs and certs[0].issuer == certs[0].subject:
            return pem
        return None
    if kind == "letsencrypt":
        live = _letsencrypt_live_keypair_paths()
        if live:
            return live[0].read_bytes()
        c, kp = tls_cert_path(), tls_key_path()
        if not (c.is_file() and kp.is_file()):
            return None
        try:
            pem = c.read_bytes()
            certs = x509.load_pem_x509_certificates(pem)
        except ValueError:
            return None
        if certs and certs[0].issuer != certs[0].subject:
            return pem
        return None
    return None


def security_field_external_sources() -> dict[str, dict[str, bool]]:
    """Whether each Security settings field is influenced by env vars and/or Docker secrets."""
    import os

    from app.docker_secrets import docker_secret_value_present

    def env_on(*keys: str) -> bool:
        return any((os.environ.get(key) or "").strip() for key in keys)

    return {
        "http_enabled": {
            "from_environment": env_on("GROUND_CONTROL_HTTP_ENABLED"),
            "from_docker_secret": docker_secret_value_present("ground_control_http_enabled"),
        },
        "http_port": {
            "from_environment": env_on(
                "GROUND_CONTROL_HTTP_PORT",
                "GROUND_CONTROL_PORT",
                "PORT",
            ),
            "from_docker_secret": docker_secret_value_present("ground_control_http_port"),
        },
        "https_enabled": {
            "from_environment": env_on("GROUND_CONTROL_HTTPS_ENABLED"),
            "from_docker_secret": docker_secret_value_present("ground_control_https_enabled"),
        },
        "https_port": {
            "from_environment": env_on("GROUND_CONTROL_HTTPS_PORT"),
            "from_docker_secret": docker_secret_value_present("ground_control_https_port"),
        },
        "redirect_http_to_https": {
            "from_environment": env_on("GROUND_CONTROL_REDIRECT_HTTP_TO_HTTPS"),
            "from_docker_secret": docker_secret_value_present("ground_control_redirect_http_to_https"),
        },
        "listen_interface": {
            "from_environment": env_on("GROUND_CONTROL_LISTEN_INTERFACE"),
            "from_docker_secret": docker_secret_value_present("ground_control_listen_interface"),
        },
        "allowed_ranges": {
            "from_environment": env_on("GROUND_CONTROL_ALLOWED_RANGES"),
            "from_docker_secret": docker_secret_value_present("ground_control_allowed_ranges"),
        },
        "tls_hostnames": {
            "from_environment": env_on("GROUND_CONTROL_TLS_HOSTNAMES"),
            "from_docker_secret": docker_secret_value_present("ground_control_tls_hostnames"),
        },
        "cert_source": {
            "from_environment": env_on("GROUND_CONTROL_CERT_SOURCE"),
            "from_docker_secret": docker_secret_value_present("ground_control_cert_source"),
        },
        "session_idle_timeout_minutes": {
            "from_environment": env_on("GROUND_CONTROL_SESSION_IDLE_MINUTES"),
            "from_docker_secret": False,
        },
    }


def security_certificate_api_fields() -> dict[str, Any]:
    return {
        "certificate": load_https_certificate_summary(),
        "certificate_self_signed": load_self_signed_certificate_summary(),
        "certificate_letsencrypt": load_letsencrypt_certificate_summary(),
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
    names = parse_tls_hostnames_blob(st.tls_hostnames)
    host = names[0] if names else "localhost"
    try:
        generate_self_signed_certificate(names if names else [host])
    except Exception:
        logging.getLogger("uvicorn.error").warning(
            "Could not auto-generate TLS certificate for HTTPS (hostname=%s).", host, exc_info=True
        )


def client_visible_hostname_for_redirect(request: Request) -> str | None:
    """Hostname the client used to reach us (no port), for HTTP→HTTPS redirect targets."""
    from app.url_helpers import request_arrived_via_trusted_proxy

    raw = (request.headers.get("host") or "").strip()
    if request_arrived_via_trusted_proxy(request):
        xfh = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
        if xfh:
            raw = xfh
    if raw:
        try:
            to_parse = raw if "://" in raw else f"http://{raw}"
            host = urlparse(to_parse).hostname
            if host:
                return host.strip()
        except ValueError:
            pass
    hn = getattr(request.url, "hostname", None)
    return str(hn).strip() if hn else None


def build_http_to_https_redirect_url(
    st: SecurityUiState,
    *,
    path: str,
    query: str,
) -> str | None:
    """Return absolute https URL to redirect to, or None if redirect should not apply.

    Uses the first TLS hostname from security settings as the redirect host.
    """
    if not (st.redirect_http_to_https and st.https_enabled and st.http_enabled):
        return None
    if path.startswith("/.well-known/acme-challenge/"):
        return None
    hn = primary_tls_hostname(st).strip() or "localhost"
    hp = st.https_port if st.https_port is not None else config.https_listen_port()
    base = https_admin_url_for_firewall(hn, hp)
    netloc = urlparse(base).netloc
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
    # TLS may be terminated upstream; the browser is already on HTTPS.
    if request_is_https_session(request):
        return None
    if request.headers.get("upgrade", "").lower() == "websocket":
        return None
    st = load_security_ui_state()
    return build_http_to_https_redirect_url(st, path=request.url.path, query=request.url.query)


def generate_self_signed_certificate(hostnames: list[str]) -> None:
    from datetime import datetime, timedelta, timezone

    if not hostnames:
        raise ValueError("At least one hostname is required.")
    errs = validate_hostname_list(hostnames)
    if errs:
        raise ValueError(errs[0])
    primary = hostnames[0]
    if len(primary) > 253:
        raise ValueError("Invalid hostname.")

    tls_dir = tls_directory()
    tls_dir.mkdir(parents=True, exist_ok=True)
    cert_path = tls_cert_path()
    key_path = tls_key_path()

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, primary)])
    now = datetime.now(timezone.utc)
    san = x509.SubjectAlternativeName([x509.DNSName(h) for h in hostnames])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=825))
        .add_extension(san, critical=False)
        .sign(key, hashes.SHA256())
    )

    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    cert_path.write_bytes(cert_pem)
    key_path.write_bytes(key_pem)
    arch_c = self_signed_archive_cert_path()
    arch_k = self_signed_archive_key_path()
    arch_c.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(cert_path, arch_c)
    shutil.copyfile(key_path, arch_k)


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
    from app import letsencrypt_service

    st = load_security_ui_state()
    runtime_http = config.http_listen_port()
    runtime_https = config.https_listen_port()
    le_ready = letsencrypt_service.is_letsencrypt_setup_complete()
    return {
        "http_enabled": st.http_enabled,
        "https_enabled": st.https_enabled,
        "redirect_http_to_https": st.redirect_http_to_https,
        "http_port": st.http_port,
        "https_port": st.https_port,
        "listen_interface": st.listen_interface,
        "allowed_ranges": st.allowed_ranges,
        "tls_hostnames": st.tls_hostnames,
        "cert_source": st.cert_source,
        "session_idle_timeout_minutes": st.session_idle_timeout_minutes,
        "session_idle_effective_minutes": effective_session_idle_timeout_minutes(),
        "letsencrypt_ready": le_ready,
        "runtime_http_port": runtime_http,
        "runtime_https_port": runtime_https,
        "security_field_sources": security_field_external_sources(),
        **security_certificate_api_fields(),
    }
