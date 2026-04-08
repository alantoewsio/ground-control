"""Tests for redirecting leaked Sophos paths back under the WebAdmin proxy."""

from __future__ import annotations

from app.webadmin_leak_redirect import _is_leaked_webadmin_path


def test_is_leaked_webadmin_path():
    assert _is_leaked_webadmin_path("/webconsole/Controller")
    assert _is_leaked_webadmin_path("/webconsole")
    assert _is_leaked_webadmin_path("/webpages/index.jsp")
    assert _is_leaked_webadmin_path("/userportal/")
    assert _is_leaked_webadmin_path("/javascript/common_min.js")
    assert _is_leaked_webadmin_path("/images/logo/group-small-on-dark.png")
    assert _is_leaked_webadmin_path("/themes/lite1/css/loginstylesheet.css")
    assert not _is_leaked_webadmin_path("/firewalls/105/webadmin/webconsole/x")
    assert not _is_leaked_webadmin_path("/api/health")


def test_middleware_redirects_when_referer_is_webadmin_proxy(client):
    r = client.get(
        "/webconsole/webpages/index.jsp",
        headers={"Referer": "http://testserver/firewalls/105/webadmin/"},
        follow_redirects=False,
    )
    assert r.status_code == 307
    assert r.headers["location"] == (
        "/firewalls/105/webadmin/webconsole/webpages/index.jsp"
    )


def test_middleware_preserves_query_string(client):
    r = client.get(
        "/webconsole/Controller?x=1",
        headers={"Referer": "http://testserver/firewalls/7/webadmin/index"},
        follow_redirects=False,
    )
    assert r.status_code == 307
    assert r.headers["location"] == "/firewalls/7/webadmin/webconsole/Controller?x=1"


def test_middleware_no_redirect_without_webadmin_referer(client):
    r = client.get(
        "/webconsole/foo",
        headers={"Referer": "http://testserver/firewalls"},
        follow_redirects=False,
    )
    assert r.status_code == 404


def test_middleware_no_redirect_when_referer_host_differs(client):
    r = client.get(
        "/webconsole/foo",
        headers={"Referer": "http://evil.example/firewalls/105/webadmin/"},
        follow_redirects=False,
    )
    assert r.status_code == 404


def test_middleware_redirects_asset_root_paths(client):
    r = client.get(
        "/javascript/common_min.js?v=1",
        headers={"Referer": "http://testserver/firewalls/105/webadmin/webconsole/webpages/index.jsp"},
        follow_redirects=False,
    )
    assert r.status_code == 307
    assert (
        r.headers["location"]
        == "/firewalls/105/webadmin/javascript/common_min.js?v=1"
    )
