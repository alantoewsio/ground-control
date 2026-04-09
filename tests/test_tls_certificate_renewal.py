"""TLS auto-renewal helpers (expiry window parsing)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.tls_certificate_renewal import (
    certificate_not_after_utc,
    tls_certificate_expires_within,
)


def test_certificate_not_after_utc_parses_z_suffix() -> None:
    exp = datetime(2030, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
    s = exp.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    dt = certificate_not_after_utc({"not_after": s, "present": True})
    assert dt is not None
    assert dt == exp


def test_tls_certificate_expires_within() -> None:
    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=10)
    summ = {"present": True, "not_after": soon.isoformat()}
    assert tls_certificate_expires_within(summ, within_days=30) is True
    assert tls_certificate_expires_within(summ, within_days=5) is False

    missing = {"present": False, "not_after": None}
    assert tls_certificate_expires_within(missing, within_days=30) is False
