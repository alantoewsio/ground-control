"""Sophos WebAdmin SSO + credential dual-login detection and link extraction."""

from __future__ import annotations

from app.webadmin_sso_login import (
    webadmin_login_html_credential_choice_path,
    webadmin_login_html_offers_sso_and_credentials,
)


_MIN_DUAL = """
<html><body>
<a href="/webconsole/SSOAdminController?go=1">Single Sign-On</a>
<a href="/webconsole/webpages/login.jsp?mode=local"><span>Credential login</span></a>
</body></html>
"""


def test_offers_sso_and_credentials_detects_dual_login_page():
    assert webadmin_login_html_offers_sso_and_credentials(_MIN_DUAL) is True
    assert webadmin_login_html_offers_sso_and_credentials("<html>Credential login only</html>") is False
    assert webadmin_login_html_offers_sso_and_credentials("<html>single sign-on only</html>") is False


def test_credential_choice_path_finds_anchor_with_nested_text():
    assert (
        webadmin_login_html_credential_choice_path(_MIN_DUAL)
        == "/webconsole/webpages/login.jsp?mode=local"
    )


def test_credential_choice_ignores_javascript_href():
    html = """
    <html><body>
    <a href="/webconsole/SSOAdminController">Single Sign-On</a>
    <a href="javascript:switchView(1)">Credential login</a>
    </body></html>
    """
    assert webadmin_login_html_offers_sso_and_credentials(html) is True
    assert webadmin_login_html_credential_choice_path(html) is None
