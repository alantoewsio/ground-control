"""Let's Encrypt via Certbot: persisted settings, HTTP/DNS validation, issuance."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from app import config
from app.letsencrypt_plugins import PLUGIN_BY_ID, plugins_payload

STATE_FILENAME = ".gc_letsencrypt_settings.json"
LE_SUBDIR = ".gc_letsencrypt"
ACME_WEBROOT_SUBDIR = ".gc_acme_webroot"
CERT_LINEAGE_NAME = "ground-control-le"
GOOGLE_CREDENTIALS_FILE = "google-dns-credentials.json"
DNS_CREDENTIALS_INI = "dns-credentials.ini"


def _base_dir() -> Path:
    pr = config.persist_root()
    return pr if pr is not None else config.BASE_DIR


def letsencrypt_data_dir() -> Path:
    return _base_dir() / LE_SUBDIR


def acme_webroot_dir() -> Path:
    return _base_dir() / ACME_WEBROOT_SUBDIR


def acme_wellknown_mount_dir() -> Path:
    """Directory mounted at ``/.well-known`` (contains ``acme-challenge``)."""
    d = acme_webroot_dir() / ".well-known"
    d.mkdir(parents=True, exist_ok=True)
    (d / "acme-challenge").mkdir(parents=True, exist_ok=True)
    return d


def _state_path() -> Path:
    return _base_dir() / STATE_FILENAME


def _google_creds_path() -> Path:
    return letsencrypt_data_dir() / GOOGLE_CREDENTIALS_FILE


def _dns_ini_path() -> Path:
    return letsencrypt_data_dir() / DNS_CREDENTIALS_INI


def certbot_config_dir() -> Path:
    return letsencrypt_data_dir() / "config"


def certbot_work_dir() -> Path:
    return letsencrypt_data_dir() / "work"


def certbot_logs_dir() -> Path:
    return letsencrypt_data_dir() / "logs"


@dataclass
class LetsEncryptSettings:
    validation_method: str  # http | dns
    dns_plugin: str
    email: str

    def to_json_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_json_dict(cls, raw: dict[str, Any]) -> LetsEncryptSettings:
        return cls(
            validation_method=str(raw.get("validation_method") or "http"),
            dns_plugin=str(raw.get("dns_plugin") or "cloudflare"),
            email=str(raw.get("email") or ""),
        )


def default_letsencrypt_settings() -> LetsEncryptSettings:
    return LetsEncryptSettings(validation_method="http", dns_plugin="cloudflare", email="")


_le_cache: tuple[LetsEncryptSettings, float] | None = None


def invalidate_letsencrypt_cache() -> None:
    global _le_cache
    _le_cache = None


def load_letsencrypt_settings() -> LetsEncryptSettings:
    global _le_cache
    path = _state_path()
    try:
        mtime = path.stat().st_mtime if path.is_file() else 0.0
    except OSError:
        mtime = 0.0
    if _le_cache is not None and _le_cache[1] == mtime:
        return _le_cache[0]
    if not path.is_file():
        d = default_letsencrypt_settings()
        _le_cache = (d, mtime)
        return d
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            d = default_letsencrypt_settings()
        else:
            base = default_letsencrypt_settings().to_json_dict()
            merged = {**base, **raw}
            vm = merged.get("validation_method") or "http"
            if vm not in ("http", "dns"):
                vm = "http"
            merged["validation_method"] = vm
            d = LetsEncryptSettings.from_json_dict(merged)
        _le_cache = (d, mtime)
        return d
    except (OSError, ValueError, TypeError):
        d = default_letsencrypt_settings()
        _le_cache = (d, mtime)
        return d


def save_letsencrypt_settings(settings: LetsEncryptSettings) -> None:
    path = _state_path()
    path.write_text(json.dumps(settings.to_json_dict(), indent=2) + "\n", encoding="utf-8")
    invalidate_letsencrypt_cache()


def _certbot_console_script_next_to_python() -> str | None:
    """Pip/uv installs a ``certbot`` entrypoint next to ``sys.executable`` (no ``python -m certbot``)."""
    bindir = Path(sys.executable).resolve().parent
    for name in ("certbot", "certbot.exe"):
        p = bindir / name
        if p.is_file():
            return str(p)
    return None


def certbot_invocation() -> list[str] | None:
    """Argv prefix to run Certbot: env override, venv ``certbot`` script, then ``PATH``."""
    custom = (os.environ.get("GROUND_CONTROL_CERTBOT_PATH") or "").strip()
    if custom:
        p = Path(custom)
        if p.is_file():
            return [str(p.resolve())]
        found = shutil.which(custom)
        return [found] if found else None
    sibling = _certbot_console_script_next_to_python()
    if sibling:
        return [sibling]
    found = shutil.which("certbot")
    return [found] if found else None


def certbot_available() -> bool:
    return certbot_invocation() is not None


def _credential_values_for_plugin(plugin_id: str) -> dict[str, str]:
    spec = PLUGIN_BY_ID.get(plugin_id)
    if not spec:
        return {}
    out: dict[str, str] = {}
    if not _dns_ini_path().is_file():
        return out
    text = _dns_ini_path().read_text(encoding="utf-8")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip()
        if k in {f.key for f in spec.fields}:
            out[k] = v
    return out


def dns_credentials_complete(plugin_id: str) -> bool:
    spec = PLUGIN_BY_ID.get(plugin_id)
    if not spec:
        return False
    values = _credential_values_for_plugin(plugin_id)
    for f in spec.fields:
        if not f.required:
            continue
        if f.key == "dns_google_credentials_json":
            if not _google_creds_path().is_file():
                return False
            continue
        if not (values.get(f.key) or "").strip():
            return False
    if plugin_id == "google" and not _google_creds_path().is_file():
        return False
    return True


def is_letsencrypt_setup_complete() -> bool:
    if not certbot_available():
        return False
    st = load_letsencrypt_settings()
    if not (st.email or "").strip():
        return False
    if st.validation_method == "http":
        return True
    if st.validation_method != "dns":
        return False
    if st.dns_plugin not in PLUGIN_BY_ID:
        return False
    return dns_credentials_complete(st.dns_plugin)


def letsencrypt_status_payload(*, include_secret_shapes: bool = False) -> dict[str, Any]:
    st = load_letsencrypt_settings()
    creds = _credential_values_for_plugin(st.dns_plugin) if st.validation_method == "dns" else {}
    shapes: dict[str, Any] = {}
    if include_secret_shapes and st.validation_method == "dns":
        spec = PLUGIN_BY_ID.get(st.dns_plugin)
        if spec:
            for f in spec.fields:
                if f.key == "dns_google_credentials_json":
                    shapes[f.key] = {"configured": _google_creds_path().is_file()}
                else:
                    shapes[f.key] = {"configured": bool((creds.get(f.key) or "").strip())}
    return {
        "settings": {
            "validation_method": st.validation_method,
            "dns_plugin": st.dns_plugin,
            "email": st.email,
        },
        "plugins": plugins_payload(),
        "certbot_available": certbot_available(),
        "setup_complete": is_letsencrypt_setup_complete(),
        "credential_fields": shapes if include_secret_shapes else {},
    }


_HOSTNAME_RE = re.compile(
    r"^(?!-)(?:[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)*[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?$"
)


def normalize_hostnames(raw: list[str] | str) -> list[str]:
    if isinstance(raw, str):
        lines = raw.replace(",", "\n").splitlines()
    else:
        lines = raw
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        h = str(line).strip().lower().rstrip(".")
        if not h:
            continue
        if h not in seen:
            seen.add(h)
            out.append(h)
    return out


def validate_hostname_list(hostnames: list[str]) -> list[str]:
    errs: list[str] = []
    if not hostnames:
        errs.append("At least one hostname is required.")
        return errs
    if len(hostnames) > 100:
        errs.append("Too many hostnames (max 100).")
    for h in hostnames:
        if len(h) > 253:
            errs.append(f"Hostname too long: {h!r}")
            continue
        if h.startswith("*."):
            core = h[2:]
            if not core or not _HOSTNAME_RE.match(core):
                errs.append(f"Invalid wildcard hostname: {h!r}")
        elif not _HOSTNAME_RE.match(h):
            errs.append(f"Invalid hostname: {h!r}")
    return errs


def parse_dns_credentials_ini_values(ini_text: str) -> dict[str, str]:
    """Parse ``key = value`` lines from a Certbot DNS credentials INI."""
    out: dict[str, str] = {}
    for line in (ini_text or "").replace("\r\n", "\n").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, _, v = s.partition("=")
        k, v = k.strip(), v.strip()
        if k and k != "dns_google_credentials":
            out[k] = v
    return out


# Path Certbot uses inside the container when persist root is ``/data``.
GOOGLE_DNS_CREDENTIALS_CONTAINER_POSIX_PATH = "/data/.gc_letsencrypt/google-dns-credentials.json"


def format_dns_credentials_ini_content(
    plugin_id: str,
    field_values: dict[str, str],
    *,
    google_credentials_posix_path: str | None = None,
) -> str:
    """Build DNS plugin INI text (e.g. for Docker launcher secret files)."""
    spec = PLUGIN_BY_ID.get(plugin_id)
    if not spec:
        raise ValueError("Unknown DNS plugin.")
    lines: list[str] = []
    gpath = google_credentials_posix_path or GOOGLE_DNS_CREDENTIALS_CONTAINER_POSIX_PATH
    for f in spec.fields:
        if f.key == "dns_google_credentials_json":
            continue
        val = (field_values.get(f.key) or "").strip()
        if f.key == "dns_rfc2136_port" and not val:
            val = "53"
        if not val and not f.required:
            continue
        if not val and f.required:
            raise ValueError(f"Missing required credential: {f.label}")
        lines.append(f"{f.key} = {val}")
    if plugin_id == "google":
        lines.append(f"dns_google_credentials = {gpath}")
    return "\n".join(lines) + "\n"


def _write_dns_credentials_ini(
    plugin_id: str,
    merged_values: dict[str, str],
) -> None:
    spec = PLUGIN_BY_ID.get(plugin_id)
    if not spec:
        raise ValueError("Unknown DNS plugin.")
    letsencrypt_data_dir().mkdir(parents=True, exist_ok=True)
    text = format_dns_credentials_ini_content(
        plugin_id,
        merged_values,
        google_credentials_posix_path=_google_creds_path().as_posix(),
    )
    _dns_ini_path().write_text(text, encoding="utf-8")


def merge_letsencrypt_credentials(
    plugin_id: str,
    incoming: dict[str, str],
    *,
    previous_plugin: str | None,
) -> dict[str, str]:
    """Blank incoming values keep prior secrets when the plugin is unchanged."""
    spec = PLUGIN_BY_ID.get(plugin_id)
    if not spec:
        raise ValueError("Unknown DNS plugin.")
    prev: dict[str, str] = {}
    if plugin_id == previous_plugin:
        prev = _credential_values_for_plugin(plugin_id)
    merged: dict[str, str] = {}
    google_json_incoming = (incoming.get("dns_google_credentials_json") or "").strip()
    for f in spec.fields:
        if f.key == "dns_google_credentials_json":
            continue
        inc = (incoming.get(f.key) or "").strip()
        if inc:
            merged[f.key] = inc
        elif prev.get(f.key):
            merged[f.key] = prev[f.key]
        elif f.required:
            merged[f.key] = ""
        else:
            merged[f.key] = inc
    if plugin_id == "google":
        if google_json_incoming:
            letsencrypt_data_dir().mkdir(parents=True, exist_ok=True)
            _google_creds_path().write_text(google_json_incoming, encoding="utf-8")
        elif not _google_creds_path().is_file():
            merged["_need_google_json"] = ""
    return merged


def save_letsencrypt_from_api(
    *,
    validation_method: str,
    dns_plugin: str,
    email: str,
    credentials: dict[str, str],
) -> None:
    if validation_method not in ("http", "dns"):
        raise ValueError("validation_method must be http or dns.")
    em = email.strip()
    if not em:
        raise ValueError("An email address is required for Let's Encrypt registration.")
    prev = load_letsencrypt_settings()
    st = LetsEncryptSettings(
        validation_method=validation_method,
        dns_plugin=dns_plugin if validation_method == "dns" else prev.dns_plugin,
        email=em,
    )
    if validation_method == "dns":
        if dns_plugin not in PLUGIN_BY_ID:
            raise ValueError("Unknown DNS plugin.")
        merged = merge_letsencrypt_credentials(
            dns_plugin, credentials, previous_plugin=prev.dns_plugin if prev.validation_method == "dns" else None
        )
        if merged.pop("_need_google_json", None) is not None:
            raise ValueError("Google Cloud credentials JSON is required.")
        _write_dns_credentials_ini(dns_plugin, merged)
    save_letsencrypt_settings(st)


def _certbot_dir_triple() -> tuple[Path, Path, Path]:
    cfg = certbot_config_dir()
    work = certbot_work_dir()
    logs = certbot_logs_dir()
    for d in (cfg, work, logs):
        d.mkdir(parents=True, exist_ok=True)
    return cfg, work, logs


def _certbot_base_cmd() -> list[str]:
    prefix = certbot_invocation()
    if not prefix:
        raise RuntimeError(
            "Certbot is not available. Ensure the certbot package is installed in this environment "
            "(the certbot launcher should sit next to the Python binary), or set GROUND_CONTROL_CERTBOT_PATH."
        )
    cfg, work, logs = _certbot_dir_triple()
    return [
        *prefix,
        "certonly",
        "--config-dir",
        str(cfg),
        "--work-dir",
        str(work),
        "--logs-dir",
        str(logs),
        "--non-interactive",
        "--agree-tos",
    ]


def _email_args(email: str) -> list[str]:
    e = email.strip()
    if e:
        return ["--email", e]
    return ["--register-unsafely-without-email"]


def _run_certbot_challenge_impl(
    domains: list[str],
    *,
    dry_run: bool,
    validation_method: str | None = None,
    dns_plugin: str | None = None,
) -> tuple[int, str]:
    st = load_letsencrypt_settings()
    vm = validation_method or st.validation_method
    plugin = dns_plugin or st.dns_plugin
    cmd = _certbot_base_cmd()
    cmd += _email_args(st.email)
    if dry_run:
        cmd.append("--dry-run")
    lineage_dir = certbot_config_dir() / "live" / CERT_LINEAGE_NAME
    if lineage_dir.is_dir():
        cmd.append("--expand")
    cmd += ["--cert-name", CERT_LINEAGE_NAME]
    for d in domains:
        cmd.extend(["-d", d])
    if vm == "http":
        wr = acme_webroot_dir()
        wr.mkdir(parents=True, exist_ok=True)
        acme_wellknown_mount_dir()
        # Non-interactive certonly requires an explicit authenticator (Certbot 5+).
        cmd += ["--authenticator", "webroot", "-w", str(wr)]
    elif vm == "dns":
        if plugin not in PLUGIN_BY_ID:
            return 1, "DNS plugin is not configured."
        auth = f"dns-{plugin}"
        if plugin == "route53":
            ini = _dns_ini_path()
            cmd += ["--authenticator", auth]
            if ini.is_file() and ini.read_text(encoding="utf-8").strip():
                cmd.extend(["--dns-route53-credentials", str(ini)])
            cmd.extend(["--dns-route53-propagation-seconds", "60"])
            cmd += ["--preferred-challenges", "dns"]
        else:
            ini = _dns_ini_path()
            if not ini.is_file():
                return 1, "DNS credentials file is missing. Save settings on the Let's Encrypt page first."
            cmd += [
                "--authenticator",
                auth,
                f"--dns-{plugin}-credentials",
                str(ini),
                f"--dns-{plugin}-propagation-seconds",
                "60",
                "--preferred-challenges",
                "dns",
            ]
    else:
        return 1, f"Unknown validation method: {vm}"
    env = os.environ.copy()
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
        timeout=600,
    )
    out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    return proc.returncode, out.strip() or "(no output)"


def _install_certbot_live_material_to_tls() -> tuple[bool, str]:
    """Copy Certbot ``live/<lineage>`` fullchain and privkey to the active TLS paths used by uvicorn."""
    live = certbot_config_dir() / "live" / CERT_LINEAGE_NAME
    chain = live / "fullchain.pem"
    key = live / "privkey.pem"
    if not chain.is_file() or not key.is_file():
        return False, f"Certificate files were not found under {live}."
    from app import security_settings

    dest_cert = security_settings.tls_cert_path()
    dest_key = security_settings.tls_key_path()
    dest_cert.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(chain, dest_cert)
    shutil.copyfile(key, dest_key)
    return True, ""


def _run_certbot_renew_impl() -> tuple[int, str]:
    prefix = certbot_invocation()
    if not prefix:
        return 1, "Certbot is not available."
    cfg, work, logs = _certbot_dir_triple()
    cmd = [
        *prefix,
        "renew",
        "--config-dir",
        str(cfg),
        "--work-dir",
        str(work),
        "--logs-dir",
        str(logs),
        "--cert-name",
        CERT_LINEAGE_NAME,
        "--non-interactive",
        "--no-random-sleep-on-renew",
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
        timeout=900,
    )
    out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    return proc.returncode, out.strip() or "(no output)"


def run_certbot_challenge(
    domains: list[str],
    *,
    dry_run: bool,
    validation_method: str | None = None,
    dns_plugin: str | None = None,
    requested_by: str = "—",
) -> tuple[int, str]:
    from app import letsencrypt_queue

    dom = list(domains)
    return letsencrypt_queue.submit(
        lambda: _run_certbot_challenge_impl(
            dom,
            dry_run=dry_run,
            validation_method=validation_method,
            dns_plugin=dns_plugin,
        ),
        operation="certbot_dry_run" if dry_run else "certbot",
        label="Certbot dry run" if dry_run else "Certbot",
        domains=dom,
        requested_by=requested_by,
        history_kind="dry_run",
        dry_run=dry_run,
    )


def obtain_certificate_and_install(hostnames: list[str], *, requested_by: str = "—") -> tuple[bool, str]:
    errs = validate_hostname_list(hostnames)
    if errs:
        return False, "; ".join(errs)
    if not is_letsencrypt_setup_complete():
        return False, "Let's Encrypt is not configured. Complete setup on the Let's Encrypt settings page."
    from app import letsencrypt_queue

    hosts = list(hostnames)

    def _work() -> tuple[bool, str]:
        code, log = _run_certbot_challenge_impl(hosts, dry_run=False)
        if code != 0:
            return False, f"Certbot failed (exit {code}).\n{log}"
        ok_inst, err = _install_certbot_live_material_to_tls()
        if not ok_inst:
            return False, err
        return True, log

    return letsencrypt_queue.submit(
        _work,
        operation="obtain_certificate",
        label="Obtain Let’s Encrypt certificate",
        domains=hosts,
        requested_by=requested_by,
        history_kind="obtain_certificate",
        dry_run=False,
    )


def renew_letsencrypt_and_install(*, requested_by: str = "—") -> tuple[bool, str]:
    """Run ``certbot renew`` for the Ground Control lineage and copy renewed material to active TLS paths."""
    if not is_letsencrypt_setup_complete():
        return False, "Let's Encrypt is not configured."
    if not certbot_available():
        return False, "Certbot is not available."
    live = certbot_config_dir() / "live" / CERT_LINEAGE_NAME
    if not (live / "fullchain.pem").is_file():
        return False, "No Certbot certificate lineage to renew."
    from app import letsencrypt_queue, security_settings

    names = security_settings.parse_tls_hostnames_blob(security_settings.load_security_ui_state().tls_hostnames)

    def _work() -> tuple[bool, str]:
        code, log = _run_certbot_renew_impl()
        if code != 0:
            return False, f"Certbot renew failed (exit {code}).\n{log}"
        ok_inst, err = _install_certbot_live_material_to_tls()
        if not ok_inst:
            return False, err
        return True, log or "Renewal completed."

    return letsencrypt_queue.submit(
        _work,
        operation="renew_certificate",
        label="Renew Let’s Encrypt certificate",
        domains=list(names) if names else [],
        requested_by=requested_by,
        history_kind="renew_certificate",
        dry_run=False,
    )
