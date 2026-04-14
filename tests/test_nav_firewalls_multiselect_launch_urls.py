"""Nav multiselect must expose WebAdmin/SSH launch URLs (gc_launch), not deep proxy paths."""

from __future__ import annotations

from app.models import Firewall


def test_nav_multiselect_webadmin_and_ssh_use_launch_routes(authed_client, main_session):
    fw = Firewall(host="10.0.0.99", port=4444, username="admin", monitor_enabled=False)
    main_session.add(fw)
    main_session.commit()
    main_session.refresh(fw)

    r = authed_client.get("/api/firewalls/nav-multiselect")
    assert r.status_code == 200
    data = r.json()
    entry = next(x for x in data if x["id"] == fw.id)
    assert entry.get("host") == "10.0.0.99"
    assert entry.get("serial_number") in (None, "")
    urls = entry["urls"]
    assert urls["webadmin"].rstrip("/").endswith(f"/firewalls/{fw.id}/webadmin/launch")
    assert urls["ssh"].rstrip("/").endswith(f"/firewalls/{fw.id}/ssh/launch")
