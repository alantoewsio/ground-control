"""Hosts & Services combined view: merge key from a chosen column."""

from types import SimpleNamespace

from app.hosts_services_table import build_hs_table_rows_combined


def test_build_hs_table_rows_combined_by_column() -> None:
    ent1 = SimpleNamespace(id=1, external_name="e1")
    ent2 = SimpleNamespace(id=2, external_name="e2")
    fw1 = SimpleNamespace(id=10, name="Alpha", host="")
    fw2 = SimpleNamespace(id=20, name="Beta", host="")
    data1 = {"Name": "Row A", "Type": "A", "Description": "SharedDesc"}
    data2 = {"Name": "Row B", "Type": "B", "Description": "SharedDesc"}
    parsed = [(ent1, fw1, data1), (ent2, fw2, data2)]

    flat = build_hs_table_rows_combined(
        parsed, entity_type="mac_host", combine_by="Description"
    )
    assert len(flat["rows"]) == 1
    row = flat["rows"][0]
    assert "Alpha" in row["cells"]["__firewalls"] and "Beta" in row["cells"]["__firewalls"]
    assert row["cells"]["__name"] == "Row A"
