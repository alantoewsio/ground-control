"""Tests for ``app.url_helpers``."""

from __future__ import annotations

import pytest
from starlette.requests import HTTPConnection, Request

from app.url_helpers import (
    https_admin_url_for_firewall,
    request_is_https_session,
    ssh_connect_host,
    webadmin_entry_url,
    webadmin_proxy_root_url,
)


@pytest.mark.parametrize(
    "host,port,expected",
    [
        ("", 4444, "https:///"),
        ("fw.example.com", 4444, "https://fw.example.com:4444/"),
        ("2001:db8::1", 4444, "https://[2001:db8::1]:4444/"),
        ("[2001:db8::1]", 4444, "https://[2001:db8::1]:4444/"),
    ],
)
def test_https_admin_url_for_firewall(host, port, expected):
    assert https_admin_url_for_firewall(host, port) == expected


def test_ssh_connect_host_brackets():
    assert ssh_connect_host("[::1]") == "::1"


def test_ssh_connect_host_plain():
    assert ssh_connect_host("  host  ") == "host"


def _scope(
    *,
    scheme: str = "http",
    path: str = "/",
    headers: list[tuple[bytes, bytes]] | None = None,
    router=None,
    server_port: int | None = None,
) -> dict:
    sp = server_port if server_port is not None else (443 if scheme == "https" else 80)
    s = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": scheme,
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers or [],
        "client": ("127.0.0.1", 1234),
        "server": ("testserver", sp),
    }
    if router is not None:
        s["router"] = router
    return s


def test_request_is_https_session_direct():
    r = Request(_scope(scheme="https"))
    assert request_is_https_session(r) is True
    r2 = Request(_scope(scheme="http"))
    assert request_is_https_session(r2) is False


def test_request_is_https_session_forwarded():
    r = Request(
        _scope(
            scheme="http",
            headers=[(b"x-forwarded-proto", b"https")],
        )
    )
    assert request_is_https_session(r) is True


def test_request_is_https_session_wss_scope():
    s = _scope(scheme="https")
    s["type"] = "websocket"
    s["scheme"] = "wss"
    r = HTTPConnection(s)
    assert request_is_https_session(r) is True


def test_request_is_https_session_ignores_untrusted_forwarded_proto():
    r = Request(
        _scope(
            scheme="http",
            headers=[(b"x-forwarded-proto", b"https")],
        )
    )
    # Simulate non-proxy direct client; forwarded proto must be ignored.
    r.scope["client"] = ("198.51.100.9", 54321)
    assert request_is_https_session(r) is False


def test_webadmin_entry_url_http_vs_https():
    from starlette.routing import Route, Router

    router = Router(
        routes=[
            Route(
                "/firewalls/{firewall_id}/webadmin/{full_path:path}",
                endpoint=lambda: None,
                name="firewall_webadmin_proxy",
            )
        ]
    )
    r_http = Request(_scope(scheme="http", router=router))
    assert webadmin_entry_url(
        r_http, firewall_id=3, host="10.0.0.1", port=4444
    ) == "https://10.0.0.1:4444/"
    r_https = Request(_scope(scheme="https", path="/firewalls", router=router))
    assert webadmin_entry_url(
        r_https, firewall_id=3, host="10.0.0.1", port=4444
    ) == "https://testserver/firewalls/3/webadmin/"


def test_webadmin_proxy_root_url_matches_entry_when_https():
    from starlette.routing import Route, Router

    router = Router(
        routes=[
            Route(
                "/firewalls/{firewall_id}/webadmin/{full_path:path}",
                endpoint=lambda: None,
                name="firewall_webadmin_proxy",
            )
        ]
    )
    r_https = Request(_scope(scheme="https", router=router))
    assert webadmin_proxy_root_url(r_https, firewall_id=7) == webadmin_entry_url(
        r_https, firewall_id=7, host="x", port=1
    )
