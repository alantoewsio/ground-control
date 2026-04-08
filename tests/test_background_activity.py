"""Tests for ``app.background_activity``."""

from __future__ import annotations

import app.background_activity as ba


def test_register_unregister_snapshot():
    uid = "user-1"
    ba.register(uid, "msg-a")
    s = ba.snapshot(uid)
    assert s["active"] is True
    assert s["count"] == 1
    assert s["message"] == "msg-a"
    ba.register(uid, "msg-b")
    assert ba.snapshot(uid)["count"] == 2
    ba.unregister(uid)
    assert ba.snapshot(uid)["count"] == 1
    ba.unregister(uid)
    assert ba.snapshot(uid)["active"] is False


def test_unregister_unknown_user():
    ba.unregister("no-such-user")


def test_register_default_message():
    uid = "user-2"
    ba.register(uid, None)
    assert ba.snapshot(uid)["active"] is True
    assert ba.snapshot(uid)["message"] == ba.DEFAULT_MESSAGE
    ba.unregister(uid)
