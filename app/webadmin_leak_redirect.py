"""Redirect Sophos WebAdmin root paths that leak onto the GC origin back under the proxy.

After login, ``location.href = '/webconsole/...'`` often bypasses ``Location.prototype.assign``
and hits FastAPI as an unknown route (404 JSON). If Referer shows a recent webadmin proxy
page, send the client to the same path under ``/firewalls/{id}/webadmin/``.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

# Referer path must contain /firewalls/<id>/webadmin/...
_REFERER_FW_RE = re.compile(r"/firewalls/(\d+)/webadmin(?:/|$)", re.IGNORECASE)


def _is_leaked_webadmin_path(path: str) -> bool:
    """True if this path looks like Sophos WebAdmin, not a GC route."""
    p = path.lower()
    if p.startswith("/firewalls/"):
        return False
    return (
        p.startswith("/webconsole/")
        or p == "/webconsole"
        or p.startswith("/webpages/")
        or p == "/webpages"
        or p.startswith("/userportal/")
        or p == "/userportal"
        or p.startswith("/javascript/")
        or p == "/javascript"
        or p.startswith("/images/")
        or p == "/images"
        or p.startswith("/themes/")
        or p == "/themes"
        or p.startswith("/fonts/")
        or p == "/fonts"
    )


class WebadminLeakedPathRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if not _is_leaked_webadmin_path(path):
            return await call_next(request)
        ref = request.headers.get("referer") or ""
        ref_parts = urlparse(ref)
        if not ref_parts.netloc:
            return await call_next(request)
        if ref_parts.netloc.lower() != request.url.netloc.lower():
            return await call_next(request)
        m = _REFERER_FW_RE.search(ref)
        if not m:
            return await call_next(request)
        fw_id = m.group(1)
        prefix = f"/firewalls/{fw_id}/webadmin"
        target = prefix + path
        q = request.url.query
        if q:
            target = f"{target}?{q}"
        return RedirectResponse(url=target, status_code=307)
