"""Tests for ``app.crypto``."""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet

import app.crypto as crypto


def test_encrypt_decrypt_roundtrip(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("GROUND_CONTROL_FERNET_KEY", key)
    plain = "secret-password"
    tok = crypto.encrypt_secret(plain)
    assert crypto.decrypt_secret(tok) == plain


def test_decrypt_invalid_token(monkeypatch):
    monkeypatch.setenv("GROUND_CONTROL_FERNET_KEY", Fernet.generate_key().decode())
    with pytest.raises(ValueError, match="Could not decrypt"):
        crypto.decrypt_secret("not-a-valid-token")


def test_fernet_missing_key(monkeypatch):
    import app.config as app_config

    monkeypatch.setattr(app_config, "fernet_key", lambda: "")
    with pytest.raises(RuntimeError, match="GROUND_CONTROL_FERNET_KEY"):
        crypto.encrypt_secret("x")
