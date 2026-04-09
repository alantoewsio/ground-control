"""Designer UI reference page."""


def test_designer_requires_auth(client):
    r = client.get("/designer", follow_redirects=False)
    assert r.status_code in (302, 303, 307, 401)


def test_designer_ok_when_authed(authed_client):
    r = authed_client.get("/designer")
    assert r.status_code == 200
    assert "Designer" in r.text
    assert "/designer" in r.text or "gc-designer" in r.text
