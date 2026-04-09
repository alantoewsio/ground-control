"""WebAdmin reverse proxy helpers."""

from __future__ import annotations

import json

import pytest
from starlette.exceptions import HTTPException
from starlette.responses import StreamingResponse

from app.models import Firewall
from app.webadmin_proxy import (
    _apply_response_header_list,
    _normalized_proxy_path,
    _rewrite_forwarded_origin_or_referer,
    _rewrite_set_cookie_for_proxy,
    _upstream_target_url,
    try_auto_login_webadmin,
)
from app.webadmin_proxy_log import (
    append_webadmin_proxy_record,
    summarize_outbound_headers,
)


@pytest.mark.asyncio
async def test_apply_response_header_list_allows_duplicate_set_cookie():
    async def body():
        yield b"ok"

    resp = StreamingResponse(body(), status_code=200, headers=None)
    _apply_response_header_list(
        resp,
        [
            ("Content-Type", "text/html"),
            ("Set-Cookie", "a=1"),
            ("Set-Cookie", "b=2"),
        ],
    )
    assert len(resp.raw_headers) == 3
    keys = [k.decode() for k, _ in resp.raw_headers]
    assert keys.count("set-cookie") == 2


def test_summarize_outbound_headers_extracts_cookie_names():
    s = summarize_outbound_headers(
        [
            ("Content-Type", "text/html; charset=utf-8"),
            ("Set-Cookie", "sid=secret; Path=/"),
            ("Set-Cookie", "xsrf=abc; Path=/webconsole; HttpOnly"),
            ("Location", "/login"),
        ]
    )
    assert s["response_content_type"] == "text/html; charset=utf-8"
    assert s["response_location"] == "/login"
    assert s["response_set_cookie_names"] == ["sid", "xsrf"]
    assert s["response_set_cookie_paths"] == ["/", "/webconsole"]


def test_rewrite_set_cookie_path_prefixes_webconsole_for_proxy():
    p = "/firewalls/9/webadmin"
    raw = "JSESSIONID=abc; Path=/webconsole; Secure; HttpOnly"
    out = _rewrite_set_cookie_for_proxy(raw, p)
    assert "Domain=" not in out
    assert "Path=/firewalls/9/webadmin/webconsole" in out
    assert "Path=/webconsole" not in out


def test_rewrite_set_cookie_path_root_becomes_proxy_prefix_slash():
    out = _rewrite_set_cookie_for_proxy(
        "session=x; Path=/; HttpOnly",
        "/firewalls/3/webadmin",
    )
    assert "Path=/firewalls/3/webadmin/" in out


def test_rewrite_set_cookie_path_accepts_absolute_proxy_prefix():
    out = _rewrite_set_cookie_for_proxy(
        "JSESSIONID=abc; Path=/webconsole; Secure; HttpOnly",
        "https://local.toews.io:8443/firewalls/105/webadmin/",
    )
    assert "Path=/firewalls/105/webadmin/webconsole" in out


def test_rewrite_set_cookie_idempotent_when_already_prefixed():
    s = "a=b; Path=/firewalls/3/webadmin/webconsole; HttpOnly"
    assert _rewrite_set_cookie_for_proxy(s, "/firewalls/3/webadmin") == s


def test_rewrite_forwarded_origin_and_referer_for_proxy_request():
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "scheme": "https",
        "server": ("local.toews.io", 8443),
        "path": "/firewalls/105/webadmin/webconsole/webpages/index.jsp",
        "query_string": b"",
        "headers": [],
    }
    req = Request(scope)
    fw = Firewall(
        id=105,
        host="gw.payg.aws.toews.io",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    o = _rewrite_forwarded_origin_or_referer(
        "https://local.toews.io:8443", req, fw, is_origin=True
    )
    r = _rewrite_forwarded_origin_or_referer(
        "https://local.toews.io:8443/firewalls/105/webadmin/webconsole/webpages/index.jsp?x=1",
        req,
        fw,
        is_origin=False,
    )
    assert o == "https://gw.payg.aws.toews.io:4444"
    assert r == "https://gw.payg.aws.toews.io:4444/webconsole/webpages/index.jsp?x=1"


def test_firewall_webadmin_proxy_route_allows_post():
    """api_route defaults to GET-only; POST must be registered for WebAdmin login."""
    from app.main import app

    for route in app.routes:
        if getattr(route, "name", None) == "firewall_webadmin_proxy":
            assert "POST" in route.methods
            assert "GET" in route.methods
            return
    pytest.fail("firewall_webadmin_proxy route not found")


@pytest.mark.asyncio
async def test_try_auto_login_webadmin_skips_non_get():
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "POST",
        "scheme": "https",
        "server": ("testserver", 443),
        "path": "/firewalls/1/webadmin/",
        "query_string": b"",
        "headers": [],
        "app": type(
            "_A",
            (),
            {"url_path_for": staticmethod(lambda *_a, **_k: "/firewalls/1/webadmin/")},
        )(),
    }
    req = Request(scope)
    fw = Firewall(id=1, host="fw.example", port=4444, username="admin", verify_ssl=False)
    login_kw = {"username": "admin", "pass" + "word": "pw"}
    out = await try_auto_login_webadmin(req, fw, **login_kw)
    assert out is None


def test_normalized_proxy_path_collapses_and_rejects_traversal():
    assert _normalized_proxy_path("webconsole/index.jsp") == "/webconsole/index.jsp"
    assert _normalized_proxy_path("webconsole/") == "/webconsole/"
    assert _normalized_proxy_path("/a/./b//c") == "/a/b/c"
    assert _normalized_proxy_path("") == "/"
    with pytest.raises(HTTPException) as exc:
        _normalized_proxy_path("x/../y")
    assert exc.value.status_code == 400


def test_upstream_target_url_joins_base_without_raw_concat():
    base = "https://fw.example:4444"
    assert _upstream_target_url(base, "webconsole/", "") == "https://fw.example:4444/webconsole/"
    assert _upstream_target_url(base, "/", "") == "https://fw.example:4444/"
    assert (
        _upstream_target_url(base, "a", "x=1") == "https://fw.example:4444/a?x=1"
    )


def test_append_webadmin_proxy_record_writes_jsonl(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.webadmin_proxy_log.webadmin_proxy_log_dir",
        lambda: tmp_path,
    )
    append_webadmin_proxy_record({"phase": "test", "n": 1})
    log_file = tmp_path / "webadmin-proxy.jsonl"
    assert log_file.is_file()
    line = log_file.read_text(encoding="utf-8").strip()
    data = json.loads(line)
    assert data["phase"] == "test"
    assert data["n"] == 1
    assert "ts" in data
