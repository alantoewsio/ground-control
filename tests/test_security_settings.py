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
        tls_hostname="",
    )
    security_settings.save_security_ui_state(st)
    assert security_settings.active_listen_ports_for_process() == {8000, 8443}


def test_listen_interface_to_bind_host():
    assert security_settings.listen_interface_to_bind_host("127.0.0.1") == "127.0.0.1"
    assert security_settings.listen_interface_to_bind_host("bogus") == "0.0.0.0"


def test_default_security_ui_state_loopback_https_redirect():
    st = security_settings.default_security_ui_state()
    assert st.listen_interface == "127.0.0.1"
    assert st.tls_hostname == "localhost"
    assert st.http_enabled and st.https_enabled and st.redirect_http_to_https
    assert st.http_port == config.http_listen_port()
    assert st.https_port == config.https_listen_port()


def test_build_http_to_https_redirect_url():
    st = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=True,
        http_port=8000,
        https_port=8443,
        listen_interface="127.0.0.1",
        allowed_ranges="",
        tls_hostname="localhost",
    )
    u = security_settings.build_http_to_https_redirect_url(st, path="/foo", query="a=1")
    assert u == "https://localhost:8443/foo?a=1"
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
        tls_hostname="localhost",
    )
    assert security_settings.build_http_to_https_redirect_url(st2, path="/", query="") is None


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
        tls_hostname="x",
    )
    errs = security_settings.validate_security_apply(
        st, ports_held_by_this_process={8000}
    )
    assert any("certificate" in e.lower() for e in errs)


def test_validate_requires_distinct_ports(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    security_settings.generate_self_signed_certificate("gc.local")
    st = security_settings.SecurityUiState(
        http_enabled=True,
        https_enabled=True,
        redirect_http_to_https=False,
        http_port=8000,
        https_port=8000,
        listen_interface="0.0.0.0",
        allowed_ranges="",
        tls_hostname="gc.local",
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
        tls_hostname="",
    )
    errs = security_settings.validate_security_apply(
        st, ports_held_by_this_process=set()
    )
    assert any("at least one" in e.lower() for e in errs)


def test_generate_and_summary_roundtrip(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    security_settings.generate_self_signed_certificate("test.example.local")
    s = security_settings.load_https_certificate_summary()
    assert s["present"] is True
    assert "test.example.local" in (s.get("dns_names") or []) or s.get("primary_hostname") == "test.example.local"


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
    assert body["certificate"]["present"] is False

    payload = {
        "http_enabled": True,
        "https_enabled": False,
        "redirect_http_to_https": False,
        "http_port": body["runtime_http_port"],
        "https_port": None,
        "listen_interface": "0.0.0.0",
        "allowed_ranges": "",
        "tls_hostname": "",
    }
    rv = authed_client.post("/api/settings/security/validate", json=payload)
    assert rv.status_code == 200
    assert rv.json()["ok"] is True

    ra = authed_client.post("/api/settings/security", json=payload)
    assert ra.status_code == 200
    assert ra.json()["ok"] is True
    assert ra.json()["restart_required"] is True


def test_api_generate_self_signed(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    r = authed_client.post(
        "/api/settings/security/generate-self-signed",
        json={"hostname": "gc.test.local"},
    )
    assert r.status_code == 200
    assert r.json()["certificate"]["present"] is True


def test_api_download_tls_public_pem(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    authed_client.post(
        "/api/settings/security/generate-self-signed",
        json={"hostname": "gc.test.local"},
    )
    r = authed_client.get("/api/settings/security/tls-public-certificate.pem")
    assert r.status_code == 200
    assert b"BEGIN CERTIFICATE" in r.content
    assert "attachment" in (r.headers.get("content-disposition") or "").lower()


def test_api_download_tls_public_pem_missing(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    r = authed_client.get("/api/settings/security/tls-public-certificate.pem")
    assert r.status_code == 404


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
