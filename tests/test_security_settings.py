"""Tests for ``app.security_settings`` and security API routes."""

from __future__ import annotations

import socket

import app.config as config
from app import security_settings


def test_active_listen_ports_for_process(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    st = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=False,
        http_port=8000,
        https_port=8443,
        listen_interface="0.0.0.0",
        allowed_ranges="",
        tls_hostnames="",
        cert_source="self_signed",
    )
    security_settings.save_security_ui_state(st)
    assert security_settings.active_listen_ports_for_process() == {8000, 8443}


def test_listen_interface_to_bind_host():
    assert security_settings.listen_interface_to_bind_host("127.0.0.1") == "127.0.0.1"
    assert security_settings.listen_interface_to_bind_host("bogus") == "0.0.0.0"


def test_default_security_ui_state_loopback_https_redirect():
    st = security_settings.default_security_ui_state()
    assert st.listen_interface == "127.0.0.1"
    assert st.tls_hostnames == "localhost"
    assert st.http_enabled and st.https_enabled and st.redirect_http_to_https
    assert st.http_port == config.http_listen_port()
    assert st.https_port == config.https_listen_port()
    assert st.session_idle_timeout_minutes == config.DEFAULT_SESSION_IDLE_MINUTES


def test_build_http_to_https_redirect_url():
    st = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=True,
        http_port=8000,
        https_port=8443,
        listen_interface="127.0.0.1",
        allowed_ranges="",
        tls_hostnames="localhost",
        cert_source="self_signed",
    )
    u = security_settings.build_http_to_https_redirect_url(st, path="/foo", query="a=1")
    assert u == "https://localhost:8443/foo?a=1"
    st_alias = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=True,
        http_port=8000,
        https_port=8443,
        listen_interface="127.0.0.1",
        allowed_ranges="",
        tls_hostnames="primary.example\nalt.example",
        cert_source="self_signed",
    )
    u2 = security_settings.build_http_to_https_redirect_url(st_alias, path="/foo", query="")
    assert u2 == "https://primary.example:8443/foo"
    assert (
        security_settings.build_http_to_https_redirect_url(
            st, path="/.well-known/acme-challenge/x", query=""
        )
        is None
    )
    st2 = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=False,
        http_port=8000,
        https_port=8443,
        listen_interface="127.0.0.1",
        allowed_ranges="",
        tls_hostnames="localhost",
        cert_source="self_signed",
    )
    assert security_settings.build_http_to_https_redirect_url(st2, path="/", query="") is None


def test_client_visible_hostname_for_redirect_strips_port():
    from starlette.requests import Request

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "path": "/",
        "raw_path": b"/",
        "root_path": "",
        "scheme": "http",
        "query_string": b"",
        "headers": [(b"host", b"203.0.113.5:8000")],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
    }
    r = Request(scope)
    assert security_settings.client_visible_hostname_for_redirect(r) == "203.0.113.5"


def _request_scope(
    *,
    path: str,
    scheme: str,
    headers: list[tuple[bytes, bytes]],
    client_host: str = "127.0.0.1",
) -> dict:
    raw_path = path.encode("ascii")
    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "path": path,
        "raw_path": raw_path,
        "root_path": "",
        "scheme": scheme,
        "query_string": b"",
        "headers": headers,
        "client": (client_host, 12345),
        "server": ("127.0.0.1", 8000),
    }


def test_https_redirect_url_skips_when_browser_already_https(monkeypatch):
    """TLS-terminated proxy: do not redirect; avoids breaking fetch() to wrong host."""
    monkeypatch.setenv("GROUND_CONTROL_UNDER_PYTEST", "0")
    from starlette.requests import Request

    r = Request(
        _request_scope(
            path="/api/auth/status",
            scheme="http",
            headers=[
                (b"host", b"public.test:8000"),
                (b"x-forwarded-proto", b"https"),
            ],
        )
    )
    assert security_settings.https_redirect_url_if_applicable(r) is None


def test_https_redirect_url_uses_first_tls_hostname_not_request_host(monkeypatch, tmp_path):
    monkeypatch.setenv("GROUND_CONTROL_UNDER_PYTEST", "0")
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    from starlette.requests import Request

    st = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=True,
        http_port=8000,
        https_port=8443,
        listen_interface="127.0.0.1",
        allowed_ranges="",
        tls_hostnames="gc.example\nlegacy-alias.example",
        cert_source="self_signed",
    )
    security_settings.save_security_ui_state(st)
    r = Request(
        _request_scope(
            path="/x",
            scheme="http",
            headers=[(b"host", b"legacy-alias.example:8000")],
        )
    )
    u = security_settings.https_redirect_url_if_applicable(r)
    assert u == "https://gc.example:8443/x"


def test_validate_requires_cert_for_https(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    st = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=False,
        http_port=8000,
        https_port=8443,
        listen_interface="0.0.0.0",
        allowed_ranges="",
        tls_hostnames="x",
        cert_source="self_signed",
    )
    errs = security_settings.validate_security_apply(
        st, ports_held_by_this_process={8000}
    )
    assert any("certificate" in e.lower() for e in errs)


def test_validate_requires_distinct_ports(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    security_settings.generate_self_signed_certificate(["gc.local"])
    st = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=False,
        http_port=8000,
        https_port=8000,
        listen_interface="0.0.0.0",
        allowed_ranges="",
        tls_hostnames="gc.local",
        cert_source="self_signed",
    )
    errs = security_settings.validate_security_apply(
        st, ports_held_by_this_process={8000}
    )
    assert any("different" in e.lower() for e in errs)


def test_validate_at_least_one_listener(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    st = security_settings.SecurityUiState(
        http_enabled=False,
        https_enabled=False,
        redirect_http_to_https=False,
        http_port=8000,
        https_port=None,
        listen_interface="0.0.0.0",
        allowed_ranges="",
        tls_hostnames="",
        cert_source="self_signed",
    )
    errs = security_settings.validate_security_apply(
        st, ports_held_by_this_process=set()
    )
    assert any("at least one" in e.lower() for e in errs)


def test_generate_and_summary_roundtrip(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    security_settings.generate_self_signed_certificate(["test.example.local"])
    s = security_settings.load_https_certificate_summary()
    assert s["present"] is True
    assert "test.example.local" in (s.get("dns_names") or []) or s.get("primary_hostname") == "test.example.local"
    assert security_settings.self_signed_archive_cert_path().is_file()
    assert security_settings.load_self_signed_certificate_summary()["present"] is True


def test_generate_self_signed_multiple_sans(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    security_settings.generate_self_signed_certificate(["primary.local", "alt.local"])
    s = security_settings.load_https_certificate_summary()
    assert s["present"] is True
    assert set(s.get("dns_names") or []) == {"primary.local", "alt.local"}


def test_tcp_listen_port_available_treats_process_ports_as_free():
    port = config.http_listen_port()
    ok, _ = security_settings.tcp_listen_port_available(
        port, ports_held_by_this_process={port}
    )
    assert ok is True


def test_tcp_listen_port_available_unused_high_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    ok, reason = security_settings.tcp_listen_port_available(
        p, ports_held_by_this_process=set()
    )
    assert ok is True
    assert reason is None


def test_api_security_get_forbidden_for_non_admin(client, secrets_session):
    from app import users_service
    from app.auth import hash_password

    users_service.ensure_default_admin_user(secrets_session)
    users_service.insert_app_user(
        secrets_session,
        username="plainuser",
        role="user",
        password_hash=hash_password("y" * 12),
    )
    r = client.post(
        "/api/auth/login",
        json={"username": "plainuser", "password": "y" * 12},
    )
    assert r.status_code == 200
    r2 = client.get("/api/settings/security")
    assert r2.status_code == 403


def test_api_security_validate_and_apply(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    r = authed_client.get("/api/settings/security")
    assert r.status_code == 200
    body = r.json()
    assert "certificate" in body
    assert "certificate_self_signed" in body
    assert "certificate_letsencrypt" in body
    assert "security_field_sources" in body
    assert body["certificate"]["present"] is False

    payload = {
        "http_enabled": True,
        "https_enabled": False,
        "redirect_http_to_https": False,
        "http_port": body["runtime_http_port"],
        "https_port": None,
        "listen_interface": "0.0.0.0",
        "allowed_ranges": "",
        "tls_hostnames": "localhost",
        "cert_source": "self_signed",
    }
    rv = authed_client.post("/api/settings/security/validate", json=payload)
    assert rv.status_code == 200
    assert rv.json()["ok"] is True

    ra = authed_client.post("/api/settings/security", json=payload)
    assert ra.status_code == 200
    assert ra.json()["ok"] is True
    assert ra.json()["restart_required"] is True


def test_api_security_apply_session_idle_no_restart(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    b = authed_client.get("/api/settings/security").json()
    base_payload = {
        "http_enabled": True,
        "https_enabled": False,
        "redirect_http_to_https": False,
        "http_port": b["http_port"],
        "https_port": None,
        "listen_interface": b["listen_interface"],
        "allowed_ranges": "",
        "tls_hostnames": "localhost",
        "cert_source": "self_signed",
        "session_idle_timeout_minutes": config.DEFAULT_SESSION_IDLE_MINUTES,
    }
    r1 = authed_client.post("/api/settings/security", json=base_payload)
    assert r1.status_code == 200
    r2 = authed_client.post(
        "/api/settings/security",
        json={**base_payload, "session_idle_timeout_minutes": 33},
    )
    assert r2.status_code == 200
    out = r2.json()
    assert out["restart_required"] is False
    assert out["session_idle_effective_minutes"] == 33
    assert "security_field_sources" in out
    assert security_settings.load_security_ui_state().session_idle_timeout_minutes == 33


def test_api_generate_self_signed(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    r = authed_client.post(
        "/api/settings/security/generate-self-signed",
        json={"hostnames": ["gc.test.local"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["certificate"]["present"] is True
    assert body["certificate_self_signed"]["present"] is True
    assert body["certificate_letsencrypt"]["present"] is False


def test_api_download_tls_public_pem(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    authed_client.post(
        "/api/settings/security/generate-self-signed",
        json={"hostnames": ["gc.test.local"]},
    )
    r = authed_client.get("/api/settings/security/tls-public-certificate.pem")
    assert r.status_code == 200
    assert b"BEGIN CERTIFICATE" in r.content
    assert "attachment" in (r.headers.get("content-disposition") or "").lower()


def test_api_download_tls_public_pem_missing(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    r = authed_client.get("/api/settings/security/tls-public-certificate.pem")
    assert r.status_code == 404


def test_api_download_tls_chain_pem(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    authed_client.post(
        "/api/settings/security/generate-self-signed",
        json={"hostnames": ["gc.test.local"]},
    )
    r = authed_client.get("/api/settings/security/tls-certificate-chain.pem?source=self_signed")
    assert r.status_code == 200
    assert b"BEGIN CERTIFICATE" in r.content
    assert "attachment" in (r.headers.get("content-disposition") or "").lower()
    r2 = authed_client.get("/api/settings/security/tls-certificate-chain.pem?source=letsencrypt")
    assert r2.status_code == 404


def test_api_download_tls_public_pem_forbidden_for_non_admin(client, secrets_session):
    from app import users_service
    from app.auth import hash_password

    users_service.ensure_default_admin_user(secrets_session)
    users_service.insert_app_user(
        secrets_session,
        username="dluser",
        role="user",
        password_hash=hash_password("y" * 12),
    )
    assert client.post("/api/auth/login", json={"username": "dluser", "password": "y" * 12}).status_code == 200
    r = client.get("/api/settings/security/tls-public-certificate.pem")
    assert r.status_code == 403
