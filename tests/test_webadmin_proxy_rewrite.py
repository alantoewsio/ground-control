"""Tests for WebAdmin proxy HTML/JS/CSS rewriting."""

from __future__ import annotations

from app.webadmin_proxy_rewrite import (
    proxy_path_prefix,
    rewrite_css_root_urls,
    rewrite_html_root_paths,
    rewrite_javascript_for_proxy,
)


def test_proxy_path_prefix():
    assert proxy_path_prefix(12) == "/firewalls/12/webadmin"


def test_rewrite_html_prefixes_root_assets_and_injects_shim():
    html = '<html><HEAD><title>x</title></head><body><link href="/themes/a.css" rel="stylesheet"/>'
    html += '<script src="/javascript/x.js"></script></body></html>'
    out = rewrite_html_root_paths(html, 5)
    p = "/firewalls/5/webadmin"
    assert f'href="{p}/themes/a.css"' in out
    assert f'src="{p}/javascript/x.js"' in out
    assert "XMLHttpRequest.prototype.open" in out
    assert "jQuery.ajax" in out
    assert "Location.prototype.assign" in out
    assert "hookHref" in out
    assert p in out


def test_rewrite_javascript_sso_location_only():
    js = 'window.location.href="/webconsole/SSOAdminController?x=1"'
    out = rewrite_javascript_for_proxy(js, 9)
    assert 'window.location.href="/firewalls/9/webadmin/webconsole/SSOAdminController?x=1"' in out


def test_rewrite_css_root_urls_handles_quoted_and_unquoted_paths():
    css = """
    .a { background-image: url('/themes/lite1/img/bg.png'); }
    .b { background-image: url("/images/logo.png"); }
    .c { background-image: url(/webconsole/webpages/logo.svg); }
    """
    out = rewrite_css_root_urls(css, 7)
    p = "/firewalls/7/webadmin"
    assert f"url('{p}/themes/lite1/img/bg.png')" in out
    assert f'url("{p}/images/logo.png")' in out
    assert f"url({p}/webconsole/webpages/logo.svg)" in out


def test_injected_shim_handles_absolute_same_origin_url():
    import json

    from app.webadmin_proxy_rewrite import _INJECT_SCRIPT_TEMPLATE

    s = _INJECT_SCRIPT_TEMPLATE % {"prefix_json": json.dumps("/firewalls/3/webadmin")}
    assert "u.substring(0,O.length)===O" in s
    assert "O+P+path" in s
    assert "hookJ" in s
    assert "jQuery.ajax.__gcWm" in s
