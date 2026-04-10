"""Designer UI reference page."""


def test_designer_requires_auth(client):
    r = client.get("/designer", follow_redirects=False)
    assert r.status_code in (302, 303, 307, 401)


def test_designer_ok_when_authed(authed_client):
    r = authed_client.get("/designer", follow_redirects=True)
    assert r.status_code == 200
    assert "Content" in r.text
    assert "gc-designer" in r.text


def test_designer_navigation_redirects_to_content(authed_client):
    r = authed_client.get("/designer/navigation", follow_redirects=False)
    assert r.status_code == 302
    assert r.headers.get("location", "").rstrip("/").endswith("/designer/content")


def test_designer_controls_page(authed_client):
    r = authed_client.get("/designer/controls")
    assert r.status_code == 200
    assert "Controls" in r.text
    assert "gc-designer-controls-ipv4" in r.text
    assert "gc-designer-controls-ipv6" in r.text
    assert "dotted IPv4 address" in r.text
    assert "valid IPv6 address" in r.text


def test_designer_modals_page(authed_client):
    r = authed_client.get("/designer/modals")
    assert r.status_code == 200
    assert "Modals" in r.text
    assert "Dialogs" in r.text
    assert "gc-designer-dialog-modal" in r.text
    assert "view-flyout" in r.text
    assert "persistent-banner" in r.text
    assert "Banners" in r.text
    assert "gc-designer-demo-banner-host" in r.text
    assert "gc-designer-banner-more-popover" in r.text
    assert "gc-designer-demo-banner-persistent-progress" in r.text
    assert "gc-designer-demo-banner-finish-persistent" in r.text
    assert "gc-designer-flyout-edit-secondary" in r.text
    assert "gc-designer-flyout-edit-primary-skeleton" in r.text
