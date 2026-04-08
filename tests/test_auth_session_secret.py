"""Tests for ``get_session_secret`` in ``app.auth``."""

from __future__ import annotations

import app.auth as auth
import app.config as config


def test_get_session_secret_from_env(monkeypatch, tmp_path):
    monkeypatch.setenv(config.SESSION_SECRET_ENV, "env-secret")
    monkeypatch.setattr(config, "SESSION_SECRET_FILE", tmp_path / "sess")
    assert auth.get_session_secret() == "env-secret"


def test_get_session_secret_from_file(monkeypatch, tmp_path):
    monkeypatch.delenv(config.SESSION_SECRET_ENV, raising=False)
    p = tmp_path / ".session"
    p.write_text("file-secret\n", encoding="utf-8")
    monkeypatch.setattr(config, "SESSION_SECRET_FILE", p)
    assert auth.get_session_secret() == "file-secret"


def test_get_session_secret_generates_file(monkeypatch, tmp_path):
    monkeypatch.delenv(config.SESSION_SECRET_ENV, raising=False)
    p = tmp_path / ".session_new"
    monkeypatch.setattr(config, "SESSION_SECRET_FILE", p)
    s = auth.get_session_secret()
    assert len(s) >= 32
    assert p.is_file()
