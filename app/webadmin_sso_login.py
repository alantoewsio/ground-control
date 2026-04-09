"""Sophos WebAdmin: SSO vs credential dual-login screen (server-side preflight)."""

from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

import httpx

# Login.jsp that offers both Single Sign-On and Credential login (e.g. Entra / AD SSO enabled).
_CREDENTIAL_LOGIN_PHRASE_RE = re.compile(r"credentials?\s+login", re.IGNORECASE)
_ANCHOR_BLOCK_RE = re.compile(
    r"<a\b[^>]*\bhref\s*=\s*(?P<q>[\"'])(?P<href>.*?)(?P=q)[^>]*>"
    r"(?P<inner>[\s\S]{0,8000}?)</\s*a\s*>",
    re.IGNORECASE,
)


def _credential_href_to_path(href: str) -> str | None:
    href = href.strip()
    if not href or href.lower().startswith("javascript:") or href.startswith("#"):
        return None
    if href.startswith("//"):
        return None
    if re.match(r"^[a-z][a-z0-9+.-]*:", href, re.IGNORECASE):
        u = urlparse(href)
        path = u.path or ""
        if not path.startswith("/"):
            return None
        q = f"?{u.query}" if u.query else ""
        frag = f"#{u.fragment}" if u.fragment else ""
        return f"{path}{q}{frag}"
    if href.startswith("/"):
        return href.split("#", 1)[0]
    return None


def webadmin_login_html_offers_sso_and_credentials(html: str) -> bool:
    """True when the page looks like the admin login chooser (SSO + credential)."""
    if not html:
        return False
    low = html.lower()
    sso = (
        "ssoadmincontroller" in low
        or "single sign-on" in low
        or "single sign on" in low
    )
    if not sso:
        return False
    return _CREDENTIAL_LOGIN_PHRASE_RE.search(html) is not None


def webadmin_login_html_credential_choice_path(html: str) -> str | None:
    """Return a root-relative path (+ optional query) for the Credential login control, if found."""
    if not html:
        return None
    for m in _ANCHOR_BLOCK_RE.finditer(html):
        inner = m.group("inner") or ""
        if not _CREDENTIAL_LOGIN_PHRASE_RE.search(inner):
            continue
        out = _credential_href_to_path(m.group("href") or "")
        if out:
            return out
    return None


def _credential_choice_target_url(upstream_base: str, rel_path: str) -> str:
    base = upstream_base.rstrip("/") + "/"
    return urljoin(base, rel_path)


async def webadmin_follow_credential_login_if_needed_async(
    client: httpx.AsyncClient,
    upstream_base: str,
    common_headers: dict[str, str],
    login_html: str,
    *,
    login_jsp_referer: str,
) -> httpx.Response | None:
    if not webadmin_login_html_offers_sso_and_credentials(login_html):
        return None
    rel = webadmin_login_html_credential_choice_path(login_html)
    if not rel:
        return None
    target = _credential_choice_target_url(upstream_base, rel)
    headers = {**common_headers, "Referer": login_jsp_referer}
    return await client.get(target, headers=headers)


def webadmin_follow_credential_login_if_needed_sync(
    client: httpx.Client,
    upstream_base: str,
    common_headers: dict[str, str],
    login_html: str,
    *,
    login_jsp_referer: str,
) -> httpx.Response | None:
    if not webadmin_login_html_offers_sso_and_credentials(login_html):
        return None
    rel = webadmin_login_html_credential_choice_path(login_html)
    if not rel:
        return None
    target = _credential_choice_target_url(upstream_base, rel)
    headers = {**common_headers, "Referer": login_jsp_referer}
    return client.get(target, headers=headers)

