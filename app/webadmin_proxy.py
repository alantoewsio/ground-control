"""Reverse-proxy firewall WebAdmin when the user session is served over HTTPS."""

from __future__ import annotations

import ipaddress
import json
import re
import time
import uuid
from typing import AsyncIterator
from urllib.parse import urlparse

import httpx
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response, StreamingResponse

from app.firewall_api_client import normalize_firewall_api_timeout_seconds
from app.models import Firewall
from app.url_helpers import https_admin_url_for_firewall, webadmin_proxy_root_url
from app.webadmin_proxy_log import (
    append_webadmin_proxy_record,
    summarize_outbound_headers,
)
from app.webadmin_proxy_rewrite import (
    MAX_REWRITE_BODY_BYTES,
    rewrite_css_root_urls,
    rewrite_html_root_paths,
    rewrite_javascript_for_proxy,
    should_attempt_rewrite,
)

_HOP_BY_HOP = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "host",
    }
)

_SET_COOKIE_DOMAIN_RE = re.compile(r";\s*Domain=[^;]+", re.IGNORECASE)
# Match Path= value through end of attribute (RFC 6265bis allows quoted paths).
_SET_COOKIE_PATH_RE = re.compile(
    r";(?P<gap>\s*)Path=(?P<val>[^;]*?)(?=;|$)",
    re.IGNORECASE,
)


def _apply_response_header_list(
    response: StreamingResponse, header_items: list[tuple[str, str]]
) -> None:
    """Starlette only accepts Mapping for ``headers=`` (no duplicate keys); set raw ASGI headers."""
    raw: list[tuple[bytes, bytes]] = []
    for key, value in header_items:
        kb = key.lower().encode("latin-1")
        try:
            vb = value.encode("latin-1")
        except UnicodeEncodeError:
            vb = value.encode("latin-1", errors="replace")
        raw.append((kb, vb))
    response.raw_headers = raw
    if hasattr(response, "_headers"):
        delattr(response, "_headers")


def _firewall_upstream_host_header(row: Firewall) -> str:
    """Host header for HTTPS to the appliance (inventory host or device hostname)."""
    name = (row.device_hostname or row.host or "").strip()
    if name.startswith("[") and name.endswith("]"):
        inner = name[1:-1].strip()
        netloc = f"[{inner}]"
    else:
        try:
            ipaddress.IPv6Address(name)
            netloc = f"[{name}]"
        except ValueError:
            netloc = name
    p = int(row.port)
    if p not in (80, 443):
        return f"{netloc}:{p}"
    return netloc


def _rewrite_forwarded_origin_or_referer(
    value: str, request: Request, row: Firewall, *, is_origin: bool
) -> str:
    """Map browser-facing Origin/Referer values back to the upstream firewall origin/path."""
    v = (value or "").strip()
    if not v:
        return v
    u = urlparse(v)
    # If the browser sends only "null" origin or an invalid value, pass through unchanged.
    if not u.scheme or not u.netloc:
        return v
    req_origin = f"{request.url.scheme}://{request.url.netloc}".lower()
    u_origin = f"{u.scheme}://{u.netloc}".lower()
    if u_origin != req_origin:
        return v

    upstream_base = https_admin_url_for_firewall(row.host, row.port).rstrip("/")
    proxy_prefix = f"/firewalls/{row.id}/webadmin"
    if is_origin:
        return upstream_base

    path = u.path or "/"
    if path.startswith(proxy_prefix + "/"):
        path = path[len(proxy_prefix) :]
    elif path == proxy_prefix:
        path = "/"
    qf = ("?" + u.query if u.query else "") + ("#" + u.fragment if u.fragment else "")
    return upstream_base + path + qf


def _client_headers_to_upstream(request: Request, row: Firewall) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in request.headers.items():
        lk = key.lower()
        if lk in _HOP_BY_HOP:
            continue
        if lk == "accept-encoding":
            continue
        if lk == "origin":
            out[key] = _rewrite_forwarded_origin_or_referer(
                value, request, row, is_origin=True
            )
            continue
        if lk == "referer":
            out[key] = _rewrite_forwarded_origin_or_referer(
                value, request, row, is_origin=False
            )
            continue
        out[key] = value
    out["Host"] = _firewall_upstream_host_header(row)
    out["Accept-Encoding"] = "identity"
    return out


def _strip_content_encoding_and_length(
    header_items: list[tuple[str, str]],
) -> list[tuple[str, str]]:
    return [
        kv
        for kv in header_items
        if kv[0].lower() not in ("content-encoding", "content-length")
    ]


def _strip_set_cookie_domain(value: str) -> str:
    return _SET_COOKIE_DOMAIN_RE.sub("", value)


def _rewrite_set_cookie_path_for_proxy(value: str, proxy_prefix: str) -> str:
    """Prefix Set-Cookie Path so jars match /firewalls/{id}/webadmin/... request URLs.

    Upstream uses Path=/webconsole; the browser will not attach those cookies to
    proxied paths like /firewalls/105/webadmin/webconsole/... without rewriting.
    """
    base = (proxy_prefix or "").rstrip("/")
    if not base.startswith("/"):
        # Accept absolute URL prefixes too (e.g. from request.url_for()).
        pu = urlparse(base)
        base = (pu.path or "").rstrip("/")
    if not base.startswith("/"):
        return value

    def repl(m: re.Match[str]) -> str:
        raw_val = (m.group("val") or "").strip()
        if not raw_val:
            return m.group(0)
        quoted = len(raw_val) >= 2 and raw_val[0] == '"' and raw_val[-1] == '"'
        inner = raw_val[1:-1] if quoted else raw_val
        inner = inner.strip()
        if not inner.startswith("/"):
            return m.group(0)
        if inner == base or inner.startswith(base + "/"):
            return m.group(0)
        new_inner = base + inner
        out = f'"{new_inner}"' if quoted else new_inner
        return f";{m.group('gap')}Path={out}"

    return _SET_COOKIE_PATH_RE.sub(repl, value)


def _rewrite_set_cookie_for_proxy(value: str, proxy_prefix: str) -> str:
    v = _strip_set_cookie_domain(value)
    return _rewrite_set_cookie_path_for_proxy(v, proxy_prefix)


def _rewrite_location(value: str, upstream_base: str, proxy_prefix: str) -> str:
    v = value.strip()
    if not v:
        return v
    u = urlparse(v)
    qf = ("?" + u.query if u.query else "") + ("#" + u.fragment if u.fragment else "")
    up = urlparse(upstream_base.rstrip("/") + "/")
    up_net = up.netloc.lower()
    prefix = proxy_prefix.rstrip("/") + "/"

    if u.scheme and u.netloc:
        if u.netloc.lower() != up_net:
            return v
        rel = (u.path or "/").lstrip("/")
        return prefix + rel + qf

    if v.startswith("/"):
        rel = (u.path or "/").lstrip("/")
        return prefix + rel + qf

    return v


def _proxy_prefix_url(request: Request, firewall_id: int) -> str:
    return webadmin_proxy_root_url(request, firewall_id=firewall_id)


def _upstream_response_headers(
    request: Request,
    row: Firewall,
    upstream: httpx.Response,
) -> list[tuple[str, str]]:
    upstream_base = https_admin_url_for_firewall(row.host, row.port).rstrip("/")
    proxy_prefix = _proxy_prefix_url(request, row.id)
    out: list[tuple[str, str]] = []
    for key, value in upstream.headers.multi_items():
        lk = key.lower()
        if lk in _HOP_BY_HOP:
            continue
        if lk == "content-length":
            continue
        if lk == "location":
            value = _rewrite_location(value, upstream_base, proxy_prefix)
        elif lk == "set-cookie":
            value = _rewrite_set_cookie_for_proxy(value, proxy_prefix)
        out.append((key, value))
    return out


def _httpx_timeout(row: Firewall) -> httpx.Timeout:
    api_to = float(normalize_firewall_api_timeout_seconds(row.api_request_timeout_seconds))
    read_s = max(300.0, api_to)
    return httpx.Timeout(connect=min(30.0, api_to), read=read_s, write=api_to, pool=api_to)


def _client_request_log_fields(request: Request, body: bytes) -> dict[str, object]:
    ref = (request.headers.get("referer") or "").strip()
    if len(ref) > 512:
        ref = ref[:512] + "…"
    ua = (request.headers.get("user-agent") or "").strip()
    if len(ua) > 240:
        ua = ua[:240] + "…"
    cookie = request.headers.get("cookie") or ""
    c_names: list[str] = []
    for part in cookie.split(";"):
        n = part.split("=", 1)[0].strip()
        if n:
            c_names.append(n)
    c_names = sorted(set(c_names))
    return {
        "request_content_type": (request.headers.get("content-type") or "")[:128] or None,
        "request_body_bytes": len(body),
        "client_referer": ref or None,
        "client_user_agent": ua or None,
        "client_cookie_header_bytes": len(cookie.encode("utf-8", errors="replace")),
        "client_cookie_names": c_names[:20],
        "client_has_jsessionid": "JSESSIONID" in c_names,
        "client_has_access_token_cookie": any("ACCESS-TOKEN" in n for n in c_names),
        "client_x_csrf_token_present": bool(request.headers.get("x-csrf-token")),
        "client_x_requested_with": (request.headers.get("x-requested-with") or "")[:64]
        or None,
    }


async def stream_firewall_webadmin(
    request: Request,
    row: Firewall,
    full_path: str,
) -> Response:
    upstream_base = https_admin_url_for_firewall(row.host, row.port).rstrip("/")
    path = full_path if full_path.startswith("/") else f"/{full_path}"
    if not path.startswith("/"):
        path = "/" + path
    q = request.url.query
    target = f"{upstream_base}{path}"
    if q:
        target = f"{target}?{q}"

    body = await request.body()
    send_headers = _client_headers_to_upstream(request, row)
    timeout = _httpx_timeout(row)
    verify: bool | str = row.verify_ssl

    rid = uuid.uuid4().hex[:16]
    t0 = time.perf_counter()
    client_ip = request.client.host if request.client else None

    append_webadmin_proxy_record(
        {
            "phase": "start",
            "id": rid,
            "firewall_id": row.id,
            "client_ip": client_ip,
            "method": request.method.upper(),
            "proxy_path": request.url.path,
            "proxy_query": (request.url.query[:2048] if request.url.query else None),
            "proxy_url": str(request.url)[:4096],
            "upstream_inventory_host": row.host,
            "upstream_port": row.port,
            "upstream_url": target[:4096],
            "verify_ssl": bool(row.verify_ssl),
            "forwarded_origin": (send_headers.get("Origin") or send_headers.get("origin")),
            "forwarded_referer": (
                send_headers.get("Referer") or send_headers.get("referer")
            ),
            "forwarded_cookie_header_bytes": len(
                (send_headers.get("Cookie") or send_headers.get("cookie") or "").encode(
                    "utf-8", errors="replace"
                )
            ),
            **_client_request_log_fields(request, body),
        }
    )

    client = httpx.AsyncClient(
        verify=verify,
        follow_redirects=False,
        timeout=timeout,
    )
    try:
        req = client.build_request(
            request.method,
            target,
            headers=send_headers,
            content=body if body else None,
        )
        upstream = await client.send(req, stream=True)
    except Exception as exc:
        await client.aclose()
        append_webadmin_proxy_record(
            {
                "phase": "error",
                "id": rid,
                "firewall_id": row.id,
                "client_ip": client_ip,
                "method": request.method.upper(),
                "upstream_url": target[:4096],
                "elapsed_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                "error_type": type(exc).__name__,
                "error": str(exc)[:2000],
            }
        )
        return Response(status_code=502, content=b"Bad gateway")

    out_headers = _upstream_response_headers(request, row, upstream)
    hdr_summary = summarize_outbound_headers(out_headers)
    status = upstream.status_code

    append_webadmin_proxy_record(
        {
            "phase": "upstream_headers",
            "id": rid,
            "firewall_id": row.id,
            "client_ip": client_ip,
            "method": request.method.upper(),
            "upstream_url": target[:4096],
            "upstream_status": status,
            "elapsed_ms": round((time.perf_counter() - t0) * 1000.0, 2),
            **hdr_summary,
        }
    )

    ct_full = upstream.headers.get("content-type") or ""
    cl_raw = upstream.headers.get("content-length")
    try:
        cl_int = int(cl_raw) if cl_raw else None
    except ValueError:
        cl_int = None
    use_rewrite = should_attempt_rewrite(ct_full) and (
        cl_int is None or cl_int <= MAX_REWRITE_BODY_BYTES
    )

    if use_rewrite:
        buf = await upstream.aread()
        await upstream.aclose()
        hdr_out = out_headers
        if len(buf) > MAX_REWRITE_BODY_BYTES:
            rewrite_kind = "passthrough_oversized_after_read"
            outb = buf
            hdr_out = _strip_content_encoding_and_length(hdr_out)
            hdr_out = [*hdr_out, ("Content-Length", str(len(outb)))]
        else:
            text = buf.decode("utf-8", errors="replace")
            ctl = ct_full.lower()
            if "text/html" in ctl:
                text = rewrite_html_root_paths(text, row.id)
                rewrite_kind = "html"
            elif "text/css" in ctl:
                text = rewrite_css_root_urls(text, row.id)
                rewrite_kind = "css"
            else:
                text = rewrite_javascript_for_proxy(text, row.id)
                rewrite_kind = "js"
            outb = text.encode("utf-8")
            hdr_out = _strip_content_encoding_and_length(hdr_out)
            hdr_out = [*hdr_out, ("Content-Length", str(len(outb)))]
        await client.aclose()
        hdr_summary_done = summarize_outbound_headers(hdr_out)

        async def body_iter_buffered() -> AsyncIterator[bytes]:
            try:
                yield outb
            finally:
                append_webadmin_proxy_record(
                    {
                        "phase": "complete",
                        "id": rid,
                        "firewall_id": row.id,
                        "client_ip": client_ip,
                        "method": request.method.upper(),
                        "upstream_url": target[:4096],
                        "upstream_status": status,
                        "bytes_to_client": len(outb),
                        "elapsed_ms": round(
                            (time.perf_counter() - t0) * 1000.0, 2
                        ),
                        "rewrite_kind": rewrite_kind,
                        **hdr_summary_done,
                    }
                )

        resp = StreamingResponse(
            body_iter_buffered(),
            status_code=status,
            headers=None,
        )
        _apply_response_header_list(resp, hdr_out)
        return resp

    async def body_iter() -> AsyncIterator[bytes]:
        bytes_out = 0
        try:
            async for chunk in upstream.aiter_bytes():
                bytes_out += len(chunk)
                yield chunk
        finally:
            append_webadmin_proxy_record(
                {
                    "phase": "complete",
                    "id": rid,
                    "firewall_id": row.id,
                    "client_ip": client_ip,
                    "method": request.method.upper(),
                    "upstream_url": target[:4096],
                    "upstream_status": status,
                    "bytes_to_client": bytes_out,
                    "elapsed_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                    "rewrite_kind": "passthrough_stream",
                    **hdr_summary,
                }
            )
            await upstream.aclose()
            await client.aclose()

    resp = StreamingResponse(
        body_iter(),
        status_code=status,
        headers=None,
    )
    _apply_response_header_list(resp, out_headers)
    return resp


async def try_auto_login_webadmin(
    request: Request,
    row: Firewall,
    *,
    username: str,
    password: str,
) -> Response | None:
    """Try server-side login and redirect directly to index.jsp.

    Returns a redirect response with upstream session cookies applied when successful,
    otherwise ``None`` so caller can fall back to normal proxied login page.
    """
    if request.method.upper() != "GET":
        return None

    upstream_base = https_admin_url_for_firewall(row.host, row.port).rstrip("/")
    proxy_prefix_abs = _proxy_prefix_url(request, row.id)
    timeout = _httpx_timeout(row)
    verify: bool | str = row.verify_ssl
    host = _firewall_upstream_host_header(row)
    common_headers = {
        "Host": host,
        "Accept-Encoding": "identity",
        "User-Agent": "GroundControl-WebAdmin-Autologin/1",
    }

    try:
        async with httpx.AsyncClient(
            verify=verify,
            follow_redirects=False,
            timeout=timeout,
        ) as client:
            r0 = await client.get(f"{upstream_base}/", headers=common_headers)
            r1 = await client.post(
                f"{upstream_base}/webconsole/Controller",
                headers={
                    **common_headers,
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": upstream_base,
                    "Referer": f"{upstream_base}/webconsole/webpages/login.jsp",
                },
                data={
                    "mode": "151",
                    "json": json.dumps(
                        {
                            "username": username,
                            "password": password,
                            "languageid": "1",
                        },
                        separators=(",", ":"),
                    ),
                },
            )
            b1 = (await r1.aread()).decode("utf-8", errors="replace")

            # Validate login worked before redirecting.
            r2 = await client.get(
                f"{upstream_base}/webconsole/webpages/index.jsp",
                headers={
                    **common_headers,
                    "Referer": f"{upstream_base}/webconsole/webpages/login.jsp",
                },
            )
            loc = (r2.headers.get("location") or "").lower()
            bad_redirect = (
                r2.status_code in (301, 302, 303, 307, 308)
                and ("/logout.jsp" in loc or "/login.jsp" in loc)
            )
            if bad_redirect or "session expired" in b1.lower():
                return None

            dest = request.url_for(
                "firewall_webadmin_proxy",
                firewall_id=row.id,
                full_path="webconsole/webpages/index.jsp",
            )
            resp = RedirectResponse(url=str(dest), status_code=302)

            # Apply upstream cookies to browser with proxied path/domain.
            cookie_values: list[str] = []
            for src in (r0, r1, r2):
                for k, v in src.headers.multi_items():
                    if k.lower() == "set-cookie":
                        cookie_values.append(v)
            if cookie_values:
                raw = list(resp.raw_headers)
                for cv in cookie_values:
                    rew = _rewrite_set_cookie_for_proxy(cv, proxy_prefix_abs)
                    raw.append(
                        (
                            b"set-cookie",
                            rew.encode("latin-1", errors="replace"),
                        )
                    )
                resp.raw_headers = raw
            return resp
    except Exception:
        return None
