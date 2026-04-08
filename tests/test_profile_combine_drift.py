"""Combined-view drift normalization for Profiles policy tables."""

from app.profiles_entities_table import _normalize_drift_scalar


def test_schedule_drift_ignores_case_and_spacing() -> None:
    a = _normalize_drift_scalar("__schedule", "All The Time")
    b = _normalize_drift_scalar("__schedule", "All the time")
    c = _normalize_drift_scalar("__schedule", "  All  the  time  ")
    assert a == b == c


def test_name_drift_stays_case_sensitive() -> None:
    assert _normalize_drift_scalar("__name", "Foo") != _normalize_drift_scalar("__name", "foo")
