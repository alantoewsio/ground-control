"""Admin API for Let's Encrypt settings (DNS plugin list, save, queue)."""

from __future__ import annotations


def test_letsencrypt_get_returns_plugins(authed_client):
    r = authed_client.get("/api/settings/letsencrypt")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("plugins"), list)
    assert len(body["plugins"]) >= 1
    ids = {p["id"] for p in body["plugins"]}
    assert "cloudflare" in ids
    assert "settings" in body
    assert "certbot_available" in body
    assert "setup_complete" in body


def test_letsencrypt_get_requires_auth(client):
    r = client.get("/api/settings/letsencrypt")
    assert r.status_code == 401


def test_letsencrypt_save_http_minimal(authed_client, monkeypatch):
    monkeypatch.setattr("app.letsencrypt_service.certbot_invocation", lambda: ["/fake/certbot"])
    r = authed_client.post(
        "/api/settings/letsencrypt",
        json={
            "validation_method": "http",
            "dns_plugin": "cloudflare",
            "email": "admin@example.com",
            "credentials": {},
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["settings"]["validation_method"] == "http"
    assert body["settings"]["email"] == "admin@example.com"
    assert len(body.get("plugins", [])) >= 1


def test_letsencrypt_queue_status(authed_client):
    r = authed_client.get("/api/settings/letsencrypt/queue")
    assert r.status_code == 200
    body = r.json()
    assert body.get("running") is None or isinstance(body["running"], dict)
    assert isinstance(body.get("queued"), list)
