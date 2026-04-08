"""Rewrite WebAdmin responses so root-absolute paths work under /firewalls/{id}/webadmin/."""

from __future__ import annotations

import re

# Do not buffer / rewrite bodies larger than this (bytes).
MAX_REWRITE_BODY_BYTES = 25 * 1024 * 1024

_INJECT_SCRIPT_TEMPLATE = (
    "<script>"
    "(function(){"
    "var P=%(prefix_json)s;"
    "function ok(u){"
    "if(u==null)return u;"
    "try{"
    "if(typeof u==='object'&&u&&typeof u.href==='string')u=u.href;"
    "}catch(e){}"
    "if(typeof u!=='string'||!u.length)return u;"
    "try{"
    "if(u.charAt(0)==='h'){"
    "var O=window.location.origin;"
    "if(u.length>=O.length&&u.substring(0,O.length)===O){"
    "var path=u.substring(O.length)||'/';"
    "if(path.charAt(0)!=='/')return u;"
    "if(path.startsWith(P+'/')||path===P)return u;"
    "if(path.startsWith('/firewalls/'))return u;"
    "return O+P+path;"
    "}"
    "return u;"
    "}"
    "}catch(e){}"
    "if(u[0]!=='/')return u;"
    "if(u[1]==='/')return u;"
    "if(u.startsWith(P+'/')||u===P)return u;"
    "if(u.startsWith('/firewalls/'))return u;"
    "return P+u;"
    "}"
    "function hookJ(){"
    "if(!window.jQuery||!jQuery.ajax||jQuery.ajax.__gcWm)return;"
    "var J=jQuery.ajax;"
    "jQuery.ajax=function(A,B){"
    "if(typeof A==='object'&&A){var s=jQuery.extend({},A);"
    "if(typeof s.url==='string')s.url=ok(s.url);"
    "return J.call(this,s);}"
    "if(typeof A==='string'){var t=jQuery.extend({},B||{},{url:ok(A)});"
    "return J.call(this,t);}"
    "return J.apply(this,arguments);};"
    "jQuery.ajax.__gcWm=true;"
    "}"
    "var xo=XMLHttpRequest.prototype.open;"
    "XMLHttpRequest.prototype.open=function(){"
    "var a=[].slice.call(arguments),u=a[1];"
    "if(typeof u==='string'||(u&&typeof u==='object'&&u.href))"
    "a[1]=ok(String(u&&u.href?u.href:u));"
    "return xo.apply(this,a);"
    "};"
    "function hookHref(){"
    "try{"
    "var proto=Location.prototype;"
    "var d=Object.getOwnPropertyDescriptor(proto,'href');"
    "if(d&&typeof d.set==='function'&&typeof d.get==='function'){"
    "var os=d.set,og=d.get;"
    "Object.defineProperty(proto,'href',{"
    "configurable:true,enumerable:d.enumerable!==false,"
    "get:function(){return og.call(this);},"
    "set:function(v){os.call(this,ok(String(v)));}"
    "});"
    "}"
    "}catch(e){}"
    "}"
    "var LA=Location.prototype.assign,LR=Location.prototype.replace;"
    "Location.prototype.assign=function(u){return LA.call(this,ok(String(u)));};"
    "Location.prototype.replace=function(u){return LR.call(this,ok(String(u)));};"
    "hookHref();"
    "if(window.open){var oo=window.open;"
    "window.open=function(u,n,f){"
    "return oo.call(this,typeof u==='string'?ok(u):u,n,f);"
    "};"
    "}"
    "if(window.fetch){var of=window.fetch;"
    "window.fetch=function(i,init){"
    "try{"
    "if(typeof i==='string')i=ok(i);"
    "else if(typeof Request!=='undefined'&&i instanceof Request){"
    "var h=i.url,f=ok(h);if(f!==h)i=new Request(f,i);"
    "}"
    "}catch(e){}"
    "return of.call(this,i,init);"
    "};"
    "}"
    "function arm(){hookJ();}"
    "arm();"
    "document.addEventListener('DOMContentLoaded',arm);"
    "window.addEventListener('load',arm);"
    "var n=0,t=setInterval(function(){arm();if(++n>400)clearInterval(t);},25);"
    "})();"
    "</script>"
)


def proxy_path_prefix(firewall_id: int) -> str:
    return f"/firewalls/{firewall_id}/webadmin"


def inject_html_proxy_shim(html: str, firewall_id: int) -> str:
    """Inject XHR/fetch shim immediately after <head> so API calls use the proxy prefix."""
    import json

    prefix = proxy_path_prefix(firewall_id)
    script = _INJECT_SCRIPT_TEMPLATE % {"prefix_json": json.dumps(prefix)}
    m = re.search(r"<head\s*>", html, re.IGNORECASE)
    if not m:
        return script + html
    ins = m.end()
    return html[:ins] + script + html[ins:]


def rewrite_html_root_paths(html: str, firewall_id: int) -> str:
    """Prefix root-absolute href, src, and action attributes (Sophos login HTML)."""
    prefix = proxy_path_prefix(firewall_id)

    def repl(m: re.Match[str]) -> str:
        attr, q, path = m.group(1), m.group(2), m.group(3)
        if path.startswith("//"):
            return m.group(0)
        if path.startswith(prefix + "/") or path == prefix:
            return m.group(0)
        return f"{attr}={q}{prefix}{path}{q}"

    pat = re.compile(
        r"""\b(href|src|action)\s*=\s*(?P<q>["'])(?P<path>/[^"'#>\s]*)(?P=q)""",
        re.IGNORECASE,
    )
    html = pat.sub(repl, html)
    return inject_html_proxy_shim(html, firewall_id)


def rewrite_css_root_urls(css: str, firewall_id: int) -> str:
    prefix = proxy_path_prefix(firewall_id)

    def repl(m: re.Match[str]) -> str:
        q1, path = m.group(1) or "", m.group(2)
        if path.startswith("//"):
            return m.group(0)
        if path.startswith(prefix + "/") or path == prefix:
            return m.group(0)
        return f"url({q1}{prefix}{path}{q1})"

    pat = re.compile(
        r"""url\(\s*(['"]?)(/[^'")\s]+)\1\s*\)""",
        re.IGNORECASE,
    )
    return pat.sub(repl, css)


def rewrite_javascript_for_proxy(js: str, firewall_id: int) -> str:
    """Adjust literal navigations only.

    Do **not** rewrite ``url:"/Controller"`` or ``contextPath:"/webconsole"``:
    ``Cyberoam.AJAXCall`` builds ``Cyberoam.contextPath + e.url`` (e.g. ``/webconsole/Controller``).
    jQuery then calls ``xhr.open`` with a **same-origin absolute** URL
    (``https://host/webconsole/Controller``), which must be remapped by the HTML shim's ``ok()``.
    Changing ``contextPath`` breaks ``\"/webconsole\"===Cyberoam.contextPath`` (refresh-token, etc.).
    """
    prefix = proxy_path_prefix(firewall_id)
    js = js.replace(
        'window.location.href="/webconsole/',
        f'window.location.href="{prefix}/webconsole/',
    )
    return js


def should_attempt_rewrite(content_type: str) -> bool:
    ct = (content_type or "").split(";")[0].strip().lower()
    if "text/html" in ct:
        return True
    if ct == "text/css" or "text/css" in ct:
        return True
    if "javascript" in ct or "ecmascript" in ct:
        return True
    return False
