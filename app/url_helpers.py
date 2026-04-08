"""Small URL builders for UI links."""

from __future__ import annotations

import ipaddress
import os
from typing import Iterable
from urllib.parse import urlparse

from starlette.requests import HTTPConnection, Request


def https_admin_url_for_firewall(host: str, port: int) -> str:
    """HTTPS URL for firewall Web Admin (API host and port). IPv6 hosts are bracketed."""
    h = (host or "").strip()
    if not h:
        return "https:///"
    if h.startswith("[") and h.endswith("]"):
        inner = h[1:-1].strip()
        netloc = f"[{inner}]:{port}"
    else:
        try:
            ipaddress.IPv6Address(h)
            netloc = f"[{h}]:{port}"
        except ValueError:
            netloc = f"{h}:{port}"
    return f"https://{netloc}/"


def _iter_csv_values(raw: str) -> Iterable[str]:
    for chunk in str(raw or "").replace("\n", ",").split(","):
        item = chunk.strip()
        if item:
            yield item


def _trusted_proxy_ranges() -> tuple[ipaddress._BaseNetwork, ...]:
    raw = os.environ.get("GROUND_CONTROL_TRUSTED_PROXY_RANGES")
    values = list(_iter_csv_values(raw or "127.0.0.1/32,::1/128"))
    out: list[ipaddress._BaseNetwork] = []
    for item in values:
        try:
            out.append(ipaddress.ip_network(item, strict=False))
        except ValueError:
            continue
    return tuple(out)


def request_arrived_via_trusted_proxy(request: HTTPConnection) -> bool:
    host = getattr(getattr(request, "client", None), "host", None)
    txt = str(host or "").strip()
    if not txt:
        return False
    try:
        ip = ipaddress.ip_address(txt)
    except ValueError:
        return False
    for net in _trusted_proxy_ranges():
        if ip in net:
            return True
    return False


def request_is_https_session(request: HTTPConnection) -> bool:
    """True when the browser-facing request is HTTPS (direct or trusted proxy header)."""
    xf = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    if xf and request_arrived_via_trusted_proxy(request):
        return xf in ("https", "wss")
    return str(request.url.scheme).lower() in ("https", "wss")


def request_origin(request: HTTPConnection) -> str:
    scheme = "https" if request_is_https_session(request) else "http"
    host = (request.headers.get("host") or request.url.netloc or "").strip()
    if request_arrived_via_trusted_proxy(request):
        xfh = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
        if xfh:
            host = xfh
    return f"{scheme}://{host}".lower()


def is_same_origin_value(request: HTTPConnection, value: str) -> bool:
    u = urlparse((value or "").strip())
    if not u.scheme or not u.netloc:
        return False
    req_origin = request_origin(request)
    return f"{u.scheme}://{u.netloc}".lower() == req_origin


def webadmin_proxy_root_url(request: Request, *, firewall_id: int) -> str:
    """HTTPS path prefix for the WebAdmin reverse proxy (trailing slash)."""
    u = request.url_for("firewall_webadmin_proxy", firewall_id=firewall_id, full_path="")
    s = str(u)
    return s if s.endswith("/") else s + "/"


def webadmin_entry_url(
    request: Request, *, firewall_id: int, host: str, port: int
) -> str:
    """WebAdmin link: proxied through GC when the session is HTTPS, else direct to the appliance."""
    if not request_is_https_session(request):
        return https_admin_url_for_firewall(host, port)
    return webadmin_proxy_root_url(request, firewall_id=firewall_id)


def ssh_connect_host(host: str) -> str:
    """Host string suitable for AsyncSSH (strip common bracket form)."""
    h = (host or "").strip()
    if h.startswith("[") and h.endswith("]"):
        return h[1:-1].strip()
    return h
