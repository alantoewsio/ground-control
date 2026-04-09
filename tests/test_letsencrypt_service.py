"""Tests for ``app.letsencrypt_service``."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

import app.config as config
from app import letsencrypt_service


def test_normalize_hostnames_dedupes():
    assert letsencrypt_service.normalize_hostnames(["A.COM", "a.com", "b.com"]) == ["a.com", "b.com"]


def test_validate_hostname_list_wildcard_ok():
    errs = letsencrypt_service.validate_hostname_list(["*.example.com"])
    assert errs == []


def test_save_http_sets_complete_when_certbot_available(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    letsencrypt_service.invalidate_letsencrypt_cache()
    monkeypatch.setattr(letsencrypt_service, "certbot_invocation", lambda: ["/fake/certbot"])
    letsencrypt_service.save_letsencrypt_from_api(
        validation_method="http",
        dns_plugin="cloudflare",
        email="ops@example.com",
        credentials={},
    )
    assert letsencrypt_service.is_letsencrypt_setup_complete() is True


def test_save_dns_cloudflare_requires_token(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    letsencrypt_service.invalidate_letsencrypt_cache()
    monkeypatch.setattr(letsencrypt_service, "certbot_invocation", lambda: ["/fake/certbot"])
    with pytest.raises(ValueError, match="Missing required credential"):
        letsencrypt_service.save_letsencrypt_from_api(
            validation_method="dns",
            dns_plugin="cloudflare",
            email="ops@example.com",
            credentials={},
        )


def test_run_certbot_http_builds_webroot(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    letsencrypt_service.invalidate_letsencrypt_cache()
    letsencrypt_service.save_letsencrypt_from_api(
        validation_method="http",
        dns_plugin="cloudflare",
        email="ops@example.com",
        credentials={},
    )
    calls: list[list[str]] = []

    def fake_run(cmd, **kwargs):
        calls.append(list(cmd))
        return MagicMock(returncode=0, stdout="ok", stderr="")

    monkeypatch.setattr(letsencrypt_service.subprocess, "run", fake_run)
    monkeypatch.setattr(letsencrypt_service, "certbot_invocation", lambda: ["/fake/certbot"])
    code, _log = letsencrypt_service.run_certbot_challenge(["t.example.com"], dry_run=True)
    assert code == 0
    assert calls
    c0 = calls[0]
    assert "--authenticator" in c0 and "webroot" in c0
    wr = str(letsencrypt_service.acme_webroot_dir())
    assert "-w" in c0
    assert wr in c0


def test_security_state_migrates_tls_hostname_json(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    from app import security_settings

    p = tmp_path / ".gc_security_state.json"
    p.write_text(
        '{"http_enabled": true, "https_enabled": true, "redirect_http_to_https": false, '
        '"http_port": 8000, "https_port": 8443, "listen_interface": "127.0.0.1", '
        '"allowed_ranges": "", "tls_hostname": "legacy.example.com"}',
        encoding="utf-8",
    )
    security_settings.invalidate_security_ui_state_cache()
    st = security_settings.load_security_ui_state()
    assert st.tls_hostnames == "legacy.example.com"
