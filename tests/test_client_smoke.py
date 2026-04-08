"""Lightweight HTTP tests for ``app.main``."""

from __future__ import annotations


def test_health_requires_api_session(authed_client):
    r = authed_client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_auth_status_unauthenticated(client):
    r = client.get("/api/auth/status")
    assert r.status_code == 200
    body = r.json()
    assert body.get("authenticated") is False


def test_static_mount(client):
    r = client.get("/static/nonexistent-asset-xyz")
    assert r.status_code in (404, 400)
