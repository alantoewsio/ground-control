"""Configuration inventory: cache entry counts per configuration."""

from __future__ import annotations

from app.main import _configuration_cache_entry_counts_by_id
from app.models import Configuration, ConfigurationConfigEntry


def test_configuration_cache_entry_counts_by_id(main_session):
    db = main_session
    c1 = Configuration(name="A")
    c2 = Configuration(name="B")
    db.add_all([c1, c2])
    db.commit()
    db.refresh(c1)
    db.refresh(c2)
    pay = "{}"
    db.add(
        ConfigurationConfigEntry(
            configuration_id=c1.id,
            entity_type="interface",
            external_name="Port1",
            payload_json=pay,
        )
    )
    db.add(
        ConfigurationConfigEntry(
            configuration_id=c1.id,
            entity_type="interface",
            external_name="Port2",
            payload_json=pay,
        )
    )
    db.commit()

    counts = _configuration_cache_entry_counts_by_id(db)
    assert counts[c1.id] == 2
    assert counts.get(c2.id, 0) == 0
