"""Silent WebAdmin login + index.jsp metadata extraction for firewall inventory."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app import crypto
from app.firewall_api_client import normalize_firewall_api_timeout_seconds
from app.models import Firewall
from app.secrets_database import get_firewall_password_encrypted
from app.url_helpers import (
    firewall_admin_host_header,
    https_admin_url_for_firewall,
    https_admin_url_for_upstream_request,
)
from app.webadmin_sso_login import webadmin_follow_credential_login_if_needed_sync

_ASSIGNMENT_RE = re.compile(
    r"^\s*(?:var\s+)?(?P<name>[A-Za-z_$][\w$.]*)\s*=\s*(?P<value>.+?)\s*;\s*$"
)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)

# Keep this list explicit to avoid persisting sensitive page variables.
_SAFE_INTERESTING_INDEX_VARS: tuple[str, ...] = (
    "Cyberoam.displayModel",
    "Cyberoam.displayVersion",
    "Cyberoam.firmwareVersionOrgFormat",
    "Cyberoam.version",
    "Cyberoam.applianceGroup",
    "Cyberoam.applianceKey",
    "Cyberoam.isOEMdevice",
    "Cyberoam.isCentralLogin",
    "Cyberoam.isFIPSEnabled",
    "Cyberoam.internetSchemeCount",
    "Cyberoam.IPv6Enable",
    "Cyberoam.currentLanguage",
    "Cyberoam.currentTheme",
    "encodedHostname",
)

_SERIAL_CANDIDATE_KEYS: tuple[str, ...] = (
    "Cyberoam.serialNumber",
    "Cyberoam.serialnumber",
    "Cyberoam.serial_no",
    "serialNumber",
    "serial_no",
    # Observed on gw.payg and useful as a best-effort serial-like identifier.
    "Cyberoam.applianceKey",
)

_LICENSE_CANDIDATE_KEYS: tuple[str, ...] = (
    "Cyberoam.license",
    "Cyberoam.licenseInfo",
    "Cyberoam.licenseType",
    "Cyberoam.licenseStatus",
    "license",
    "licenseInfo",
    "licenseType",
    "licenseStatus",
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _strip_js_quoted_string(raw: str) -> str:
    s = raw.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        inner = s[1:-1]
        # Best-effort JS-ish escaping support for simple string literals.
        return bytes(inner, "utf-8").decode("unicode_escape")
    return s


def _parse_js_scalar(raw: str) -> Any:
    s = raw.strip()
    if not s:
        return None
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("{") and s.endswith("}")):
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            pass
    if s.startswith("JSON.parse(") and s.endswith(")"):
        inner = s[len("JSON.parse(") : -1].strip()
        txt = _strip_js_quoted_string(inner)
        low = txt.lower()
        if low == "true":
            return True
        if low == "false":
            return False
        if low == "null":
            return None
        return txt
    if (s.startswith("'") and s.endswith("'")) or (s.startswith('"') and s.endswith('"')):
        return _strip_js_quoted_string(s)
    low = s.lower()
    if low == "true":
        return True
    if low == "false":
        return False
    if low == "null":
        return None
    return s


def _clip_text(value: Any, max_len: int) -> str | None:
    if value is None:
        return None
    txt = str(value).strip()
    if not txt:
        return None
    return txt if len(txt) <= max_len else txt[:max_len]


def _normalize_firewall_subscriptions(value: Any) -> list[dict[str, str]]:
    """Normalize modulesubsctionList to a bounded, storage-safe list of dicts."""
    if isinstance(value, str):
        txt = value.strip()
        if txt.startswith("[") and txt.endswith("]"):
            try:
                value = json.loads(txt)
            except json.JSONDecodeError:
                return []
        else:
            return []
    if not isinstance(value, list):
        return []
    out: list[dict[str, str]] = []
    for item in value[:256]:
        if not isinstance(item, dict):
            continue
        row: dict[str, str] = {}
        for k, v in list(item.items())[:48]:
            key = _clip_text(k, 80)
            val = _clip_text(v, 200)
            if key is None or val is None:
                continue
            row[key] = val
        if row:
            out.append(row)
    return out


def parse_sophos_webadmin_index_page(index_html: str) -> dict[str, Any]:
    """Parse index.jsp assignments and return normalized inventory-safe metadata."""
    assignments: dict[str, Any] = {}
    for line in (index_html or "").splitlines():
        m = _ASSIGNMENT_RE.match(line)
        if not m:
            continue
        assignments[m.group("name")] = _parse_js_scalar(m.group("value"))

    title_match = _TITLE_RE.search(index_html or "")
    title_value = ""
    if title_match:
        title_value = " ".join(title_match.group(1).split())

    hostname = _clip_text(assignments.get("encodedHostname"), 255)
    if not hostname:
        hostname = _clip_text(assignments.get("Cyberoam.hostname"), 255)
    if not hostname:
        hostname = _clip_text(title_value, 255)

    model = _clip_text(assignments.get("Cyberoam.displayModel"), 128)
    if not model:
        model = _clip_text(assignments.get("Cyberoam.model"), 128)

    firmware_version = _clip_text(assignments.get("Cyberoam.displayVersion"), 64)
    if not firmware_version:
        firmware_version = _clip_text(assignments.get("Cyberoam.firmwareVersionOrgFormat"), 64)
    if not firmware_version:
        firmware_version = _clip_text(assignments.get("Cyberoam.version"), 64)

    serial_number: str | None = None
    for key in _SERIAL_CANDIDATE_KEYS:
        serial_number = _clip_text(assignments.get(key), 128)
        if serial_number:
            break

    # Collect whatever licensing fields exist on this firmware build.
    license_bits: list[str] = []
    for key in _LICENSE_CANDIDATE_KEYS:
        val = _clip_text(assignments.get(key), 180)
        if val:
            license_bits.append(f"{key.split('.')[-1]}={val}")
    license_info = _clip_text(" | ".join(license_bits), 512) if license_bits else None
    firewall_subscriptions = _normalize_firewall_subscriptions(
        assignments.get("modulesubsctionList")
    )

    extras: dict[str, Any] = {}
    for key in _SAFE_INTERESTING_INDEX_VARS:
        if key in assignments:
            extras[key] = assignments[key]

    # Include any dynamic license-like keys from assignments (safe values only, clipped).
    for key, value in assignments.items():
        lk = key.lower()
        if "license" not in lk:
            continue
        clipped = _clip_text(value, 180)
        if clipped is None:
            continue
        extras.setdefault(key, clipped)

    return {
        "device_hostname": hostname,
        "model": model,
        "firmware_version": firmware_version,
        "serial_number": serial_number,
        "license_info": license_info,
        "firewall_subscriptions": firewall_subscriptions,
        "interesting_vars": extras,
    }


def _webadmin_timeout(row: Firewall) -> httpx.Timeout:
    api_to = float(normalize_firewall_api_timeout_seconds(row.api_request_timeout_seconds))
    read_s = max(60.0, api_to)
    return httpx.Timeout(connect=min(20.0, api_to), read=read_s, write=api_to, pool=api_to)


def collect_firewall_webadmin_device_info(
    host: str,
    port: int,
    username: str,
    password: str,
    *,
    verify_ssl: bool,
    timeout: httpx.Timeout | None = None,
    device_hostname: str | None = None,
) -> dict[str, Any]:
    """Silent WebAdmin login + index.jsp parse (no browser redirect flow)."""
    host_txt = (host or "").strip()
    user_txt = (username or "").strip()
    if not host_txt:
        return {"ok": False, "error": "host is blank"}
    if not user_txt:
        return {"ok": False, "error": "username is blank"}
    if not password:
        return {"ok": False, "error": "password is blank"}

    p = int(port)
    connect_base = https_admin_url_for_upstream_request(host_txt, p).rstrip("/")
    identity_base = https_admin_url_for_firewall(host_txt, p).rstrip("/")
    common_headers = {
        "Host": firewall_admin_host_header(
            inventory_host=host_txt,
            port=p,
            device_hostname=device_hostname,
        ),
        "Accept-Encoding": "identity",
        "User-Agent": "GroundControl-WebAdmin-Metadata/1",
    }
    timeout_obj = timeout if timeout is not None else httpx.Timeout(30.0)

    try:
        with httpx.Client(
            verify=verify_ssl,
            follow_redirects=False,
            timeout=timeout_obj,
        ) as client:
            client.get(f"{connect_base}/", headers=common_headers)
            login_jsp = f"{connect_base}/webconsole/webpages/login.jsp"
            lr = client.get(
                login_jsp,
                headers={**common_headers, "Referer": f"{connect_base}/"},
            )
            webadmin_follow_credential_login_if_needed_sync(
                client,
                connect_base,
                common_headers,
                lr.text or "",
                login_jsp_referer=login_jsp,
            )
            login_resp = client.post(
                f"{connect_base}/webconsole/Controller",
                headers={
                    **common_headers,
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": identity_base,
                    "Referer": f"{identity_base}/webconsole/webpages/login.jsp",
                },
                data={
                    "mode": "151",
                    "json": json.dumps(
                        {
                            "username": user_txt,
                            "password": password,
                            "languageid": "1",
                        },
                        separators=(",", ":"),
                    ),
                },
            )
            login_body = login_resp.text

            index_resp = client.get(
                f"{connect_base}/webconsole/webpages/index.jsp",
                headers={
                    **common_headers,
                    "Referer": f"{identity_base}/webconsole/webpages/login.jsp",
                },
            )
            loc = (index_resp.headers.get("location") or "").lower()
            bad_redirect = (
                index_resp.status_code in (301, 302, 303, 307, 308)
                and ("/logout.jsp" in loc or "/login.jsp" in loc)
            )
            if bad_redirect or "session expired" in login_body.lower():
                return {"ok": False, "error": "webadmin login failed"}

            parsed = parse_sophos_webadmin_index_page(index_resp.text or "")
            return {
                "ok": True,
                **parsed,
                "source": "webadmin-index.jsp",
            }
    except httpx.TimeoutException:
        return {"ok": False, "error": "webadmin connection timed out"}
    except httpx.HTTPError as exc:
        return {"ok": False, "error": f"webadmin request failed: {exc}"}
    except Exception as exc:
        return {"ok": False, "error": f"webadmin parse failed: {exc}"}


def refresh_firewall_webadmin_device_info(
    db: Session,
    sdb: Session,
    firewall_id: int,
) -> dict[str, Any]:
    """Load credentials from DB + secrets, fetch index.jsp metadata, persist safe fields."""
    row = db.get(Firewall, firewall_id)
    if not row:
        return {"ok": False, "error": "firewall not found", "firewall_id": firewall_id}
    username = (row.username or "").strip()
    if not username:
        return {
            "ok": False,
            "error": "firewall username is blank",
            "firewall_id": firewall_id,
        }
    enc = get_firewall_password_encrypted(sdb, firewall_id)
    if not enc:
        return {
            "ok": False,
            "error": "no stored firewall password in secrets",
            "firewall_id": firewall_id,
        }
    try:
        password = crypto.decrypt_secret(enc)
    except ValueError as exc:
        return {
            "ok": False,
            "error": f"password decrypt failed: {exc}",
            "firewall_id": firewall_id,
        }

    result = collect_firewall_webadmin_device_info(
        row.host,
        row.port,
        username,
        password,
        verify_ssl=bool(row.verify_ssl),
        timeout=_webadmin_timeout(row),
        device_hostname=row.device_hostname,
    )
    out: dict[str, Any] = dict(result)
    out["firewall_id"] = firewall_id
    if not result.get("ok"):
        return out

    hostname = _clip_text(result.get("device_hostname"), 255)
    model = _clip_text(result.get("model"), 128)
    fw_version = _clip_text(result.get("firmware_version"), 64)
    serial = _clip_text(result.get("serial_number"), 128)
    license_info = _clip_text(result.get("license_info"), 512)
    interesting_vars = result.get("interesting_vars")
    if not isinstance(interesting_vars, dict):
        interesting_vars = {}
    firewall_subscriptions = _normalize_firewall_subscriptions(
        result.get("firewall_subscriptions")
    )

    if hostname is not None:
        row.device_hostname = hostname
    if model is not None:
        row.model = model
    if fw_version is not None:
        row.firmware_version = fw_version
    if serial is not None:
        row.serial_number = serial
    if license_info is not None:
        row.license_info = license_info
    row.firewall_subscriptions_json = json.dumps(
        firewall_subscriptions,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    row.webadmin_metadata_json = json.dumps(
        interesting_vars,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    row.webadmin_last_collected_at = _utc_now()
    db.add(row)
    db.commit()
    return out
