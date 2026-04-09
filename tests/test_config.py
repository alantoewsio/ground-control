"""Tests for ``app.config``."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet

import app.config as config


def test_database_urls_default_sqlite_paths():
    assert config.database_url().startswith("sqlite:///")
    assert config.monitor_database_url().startswith("sqlite:///")
    assert config.secrets_database_url().startswith("sqlite:///")


def test_database_urls_from_env(monkeypatch):
    monkeypatch.setenv("GROUND_CONTROL_DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("GROUND_CONTROL_MONITOR_DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("GROUND_CONTROL_SECRETS_DATABASE_URL", "sqlite:///:memory:")
    assert config.database_url() == "sqlite:///:memory:"
    assert config.monitor_database_url() == "sqlite:///:memory:"
    assert config.secrets_database_url() == "sqlite:///:memory:"


def test_database_urls_built_from_docker_postgres_secret(monkeypatch):
    monkeypatch.delenv("GROUND_CONTROL_DATABASE_URL", raising=False)
    monkeypatch.delenv("GROUND_CONTROL_MONITOR_DATABASE_URL", raising=False)
    monkeypatch.delenv("GROUND_CONTROL_SECRETS_DATABASE_URL", raising=False)
    monkeypatch.setenv("GROUND_CONTROL_DOCKER", "1")
    monkeypatch.setenv("GROUND_CONTROL_POSTGRES_PASSWORD", "p@ss word")
    monkeypatch.setenv("GROUND_CONTROL_POSTGRES_HOST", "postgres")
    monkeypatch.setenv("GROUND_CONTROL_POSTGRES_USER", "ground_control")
    monkeypatch.setattr(config, "in_docker_deployment", lambda: True)
    assert config.database_url() == (
        "postgresql+psycopg://ground_control:p%40ss+word@postgres:5432/ground_control"
    )
    assert config.monitor_database_url() == (
        "postgresql+psycopg://ground_control:p%40ss+word@postgres:5432/ground_control_monitor"
    )
    assert config.secrets_database_url() == (
        "postgresql+psycopg://ground_control:p%40ss+word@postgres:5432/ground_control_secrets"
    )


def test_database_url_docker_without_password_raises(monkeypatch):
    monkeypatch.delenv("GROUND_CONTROL_DATABASE_URL", raising=False)
    monkeypatch.delenv("GROUND_CONTROL_MONITOR_DATABASE_URL", raising=False)
    monkeypatch.delenv("GROUND_CONTROL_SECRETS_DATABASE_URL", raising=False)
    monkeypatch.setenv("GROUND_CONTROL_DOCKER", "1")
    monkeypatch.delenv("GROUND_CONTROL_POSTGRES_PASSWORD", raising=False)
    monkeypatch.setattr(config, "in_docker_deployment", lambda: True)
    with pytest.raises(RuntimeError):
        config.database_url()


def test_http_listen_port_defaults_to_8000(monkeypatch):
    for key in ("GROUND_CONTROL_HTTP_PORT", "GROUND_CONTROL_PORT", "PORT"):
        monkeypatch.delenv(key, raising=False)
    assert config.http_listen_port() == 8000


def test_http_listen_port_ground_control_http_wins(monkeypatch):
    monkeypatch.setenv("GROUND_CONTROL_HTTP_PORT", "3000")
    monkeypatch.setenv("GROUND_CONTROL_PORT", "4000")
    monkeypatch.setenv("PORT", "5000")
    assert config.http_listen_port() == 3000


def test_http_listen_port_fallback_order(monkeypatch):
    monkeypatch.delenv("GROUND_CONTROL_HTTP_PORT", raising=False)
    monkeypatch.setenv("GROUND_CONTROL_PORT", "4001")
    monkeypatch.setenv("PORT", "5001")
    assert config.http_listen_port() == 4001


def test_http_listen_port_port_env_when_others_unset(monkeypatch):
    monkeypatch.delenv("GROUND_CONTROL_HTTP_PORT", raising=False)
    monkeypatch.delenv("GROUND_CONTROL_PORT", raising=False)
    monkeypatch.setenv("PORT", "9000")
    assert config.http_listen_port() == 9000


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("", 8000),
        ("abc", 8000),
        ("0", 8000),
        ("65536", 8000),
    ],
)
def test_http_listen_port_invalid_falls_back(monkeypatch, raw, expected):
    monkeypatch.delenv("GROUND_CONTROL_HTTP_PORT", raising=False)
    monkeypatch.delenv("GROUND_CONTROL_PORT", raising=False)
    monkeypatch.delenv("PORT", raising=False)
    monkeypatch.setenv("GROUND_CONTROL_HTTP_PORT", raw)
    assert config.http_listen_port() == expected


def test_https_listen_port_defaults_to_8443_when_unset(monkeypatch):
    monkeypatch.delenv("GROUND_CONTROL_HTTPS_PORT", raising=False)
    assert config.https_listen_port() == 8443


def test_https_listen_port_from_env(monkeypatch):
    monkeypatch.setenv("GROUND_CONTROL_HTTPS_PORT", "8443")
    assert config.https_listen_port() == 8443


def test_https_listen_port_invalid_env_falls_back_to_8443(monkeypatch):
    monkeypatch.setenv("GROUND_CONTROL_HTTPS_PORT", "65536")
    assert config.https_listen_port() == 8443


def test_bind_listen_host_unset(monkeypatch):
    monkeypatch.delenv("GROUND_CONTROL_BIND_ADDRESS", raising=False)
    assert config.bind_listen_host() is None


def test_bind_listen_host_from_env(monkeypatch):
    monkeypatch.setenv("GROUND_CONTROL_BIND_ADDRESS", " 0.0.0.0 ")
    assert config.bind_listen_host() == "0.0.0.0"


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("", 5.0),
        ("notfloat", 5.0),
        ("0.1", 0.5),
        ("200", 120.0),
        ("30", 30.0),
    ],
)
def test_monitor_tcp_timeout_seconds(monkeypatch, raw, expected):
    monkeypatch.setenv("GROUND_CONTROL_MONITOR_TCP_TIMEOUT_SEC", raw)
    assert config.monitor_tcp_timeout_seconds() == expected


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("", 60),
        ("abc", 60),
        ("-1", 60),
        ("0", 0),
        ("120", 120),
        ("999999", 525600),
    ],
)
def test_session_idle_timeout_minutes(monkeypatch, raw, expected):
    monkeypatch.setenv("GROUND_CONTROL_SESSION_IDLE_MINUTES", raw)
    assert config.session_idle_timeout_minutes() == expected


def test_fernet_key_from_env(monkeypatch):
    monkeypatch.setenv("GROUND_CONTROL_FERNET_KEY", "k" * 40)
    assert config.fernet_key() == "k" * 40


def test_fernet_key_from_file(monkeypatch, tmp_path):
    monkeypatch.delenv("GROUND_CONTROL_FERNET_KEY", raising=False)
    persist = tmp_path / "persist"
    persist.mkdir()
    (persist / ".fernet_key").write_text("filekey\n", encoding="utf-8")
    monkeypatch.setenv("GROUND_CONTROL_PERSIST_DIR", str(persist))
    assert config.fernet_key().strip() == "filekey"


def test_fernet_key_empty(monkeypatch, tmp_path):
    monkeypatch.delenv("GROUND_CONTROL_FERNET_KEY", raising=False)
    persist = tmp_path / "empty"
    persist.mkdir()
    monkeypatch.setenv("GROUND_CONTROL_PERSIST_DIR", str(persist))
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    assert config.fernet_key() == ""


def test_fernet_key_legacy_base_dir_when_persist_unset(monkeypatch, tmp_path):
    monkeypatch.delenv("GROUND_CONTROL_FERNET_KEY", raising=False)
    monkeypatch.delenv("GROUND_CONTROL_PERSIST_DIR", raising=False)
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    (tmp_path / ".fernet_key").write_text("legacykey\n", encoding="utf-8")
    assert config.fernet_key().strip() == "legacykey"


def test_ensure_local_fernet_key_creates_file_under_persist(monkeypatch, tmp_path):
    monkeypatch.delenv("GROUND_CONTROL_FERNET_KEY", raising=False)
    persist = tmp_path / "data"
    persist.mkdir()
    monkeypatch.setenv("GROUND_CONTROL_PERSIST_DIR", str(persist))
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    config.ensure_local_fernet_key()
    assert (persist / ".fernet_key").is_file()
    assert config.fernet_key()


def test_ensure_local_fernet_key_noop_when_key_set(monkeypatch, tmp_path):
    monkeypatch.setenv("GROUND_CONTROL_FERNET_KEY", Fernet.generate_key().decode())
    persist = tmp_path / "data"
    persist.mkdir()
    monkeypatch.setenv("GROUND_CONTROL_PERSIST_DIR", str(persist))
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    config.ensure_local_fernet_key()
    assert not (persist / ".fernet_key").exists()


def test_migrate_fernet_from_base_dir_to_persist(monkeypatch, tmp_path):
    monkeypatch.delenv("GROUND_CONTROL_FERNET_KEY", raising=False)
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    (tmp_path / ".fernet_key").write_text("migrated\n", encoding="utf-8")
    persist = tmp_path / "vol"
    persist.mkdir()
    monkeypatch.setenv("GROUND_CONTROL_PERSIST_DIR", str(persist))
    config.ensure_local_fernet_key()
    assert (persist / ".fernet_key").read_text(encoding="utf-8").strip() == "migrated"
    assert config.fernet_key().strip() == "migrated"


def test_load_dotenv_import_error_returns_early():
    import app.config as cfg

    with patch.dict("sys.modules", {"dotenv": None}):
        import builtins

        real_import = builtins.__import__

        def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "dotenv":
                raise ImportError("blocked")
            return real_import(name, globals, locals, fromlist, level)

        with patch("builtins.__import__", fake_import):
            cfg._load_dotenv()  # noqa: SLF001
