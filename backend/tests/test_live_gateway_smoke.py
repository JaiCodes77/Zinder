"""
Optional live smoke against a running stack (gateway :8080 + services + Redis).

  LIVE_GATEWAY=1 python3 -m pytest tests/test_live_gateway_smoke.py -v

Skipped by default so CI/unit runs stay offline.
"""

from __future__ import annotations

import os
import time
import uuid

import httpx
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("LIVE_GATEWAY") != "1",
    reason="Set LIVE_GATEWAY=1 with gateway on :8080 to run live smoke",
)

BASE = os.getenv("LIVE_GATEWAY_URL", "http://localhost:8080/api/v1").rstrip("/")

PROFILE_BODY = {
    "age": 28,
    "bio": "Live smoke profile for browse/match journey.",
    "interests": ["Python", "React"],
    "looking_for": "Collaborators",
    "radius_limit": 50,
}


def _register_login_profile(client: httpx.Client, name: str) -> dict:
    email = f"smoke_{uuid.uuid4().hex[:10]}@zinder.live"
    password = "SmokeTest1!"
    reg = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert reg.status_code in (200, 201), reg.text

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text

    me = client.get("/auth/me")
    assert me.status_code == 200, me.text
    assert me.json().get("email") == email
    user = me.json()
    user_id = user.get("id") or user.get("user_id")
    assert user_id is not None, user

    profile = client.post("/profiles", json=PROFILE_BODY)
    assert profile.status_code == 200, profile.text

    # Prefer profile/me if auth/me shape is thin
    if user.get("id") is None:
        me_prof = client.get("/profiles/me")
        assert me_prof.status_code == 200, me_prof.text
        user_id = me_prof.json()["user"]["id"]

    return {"email": email, "password": password, "user_id": int(user_id), "name": name}


def test_live_auth_browse_projects_matches():
    with httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as client:
        _register_login_profile(client, "Smoke Tester")

        browse = client.get("/matcher/browse", params={"limit": 5, "sort": "best"})
        assert browse.status_code == 200, browse.text
        body = browse.json()
        assert "items" in body or isinstance(body, list)

        # tags= filter (contract: comma-separated interests)
        tagged = client.get(
            "/matcher/browse",
            params={"limit": 10, "sort": "best", "tags": "Python,React"},
        )
        assert tagged.status_code == 200, tagged.text
        tagged_body = tagged.json()
        assert "items" in tagged_body or isinstance(tagged_body, list)

        projects = client.get("/projects")
        assert projects.status_code == 200, projects.text
        assert isinstance(projects.json(), list)

        matches = client.get("/matcher/matches")
        assert matches.status_code == 200, matches.text

        logout = client.post("/auth/logout")
        assert logout.status_code in (200, 204), logout.text

        time.sleep(0.05)
        me_after = client.get("/auth/me")
        assert me_after.status_code in (401, 403), me_after.text


def test_live_browse_cursor_pagination():
    """GET /matcher/browse respects limit + next_cursor Load-more contract."""
    with (
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as viewer,
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as peer_a,
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as peer_b,
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as peer_c,
    ):
        _register_login_profile(viewer, "Smoke Cursor Viewer")
        # Seed a few peers so browse has more than one page at limit=1
        for i, client in enumerate((peer_a, peer_b, peer_c), start=1):
            _register_login_profile(client, f"Smoke Cursor Peer {i}")

        page1 = viewer.get("/matcher/browse", params={"limit": 1, "sort": "best"})
        assert page1.status_code == 200, page1.text
        body1 = page1.json()
        assert isinstance(body1, dict) and "items" in body1, body1
        assert len(body1["items"]) <= 1
        next_cursor = body1.get("next_cursor")
        if not next_cursor:
            # Deck may be thin in a fresh DB — still assert shape is correct
            assert body1.get("next_cursor") in (None, "")
            for c in (viewer, peer_a, peer_b, peer_c):
                assert c.post("/auth/logout").status_code in (200, 204)
            return

        page2 = viewer.get(
            "/matcher/browse",
            params={"limit": 1, "sort": "best", "cursor": next_cursor},
        )
        assert page2.status_code == 200, page2.text
        body2 = page2.json()
        assert isinstance(body2, dict) and "items" in body2, body2
        ids1 = {item.get("user_id") for item in body1["items"]}
        ids2 = {item.get("user_id") for item in body2["items"]}
        assert ids1.isdisjoint(ids2), (ids1, ids2)

        for c in (viewer, peer_a, peer_b, peer_c):
            assert c.post("/auth/logout").status_code in (200, 204)


def test_live_swipe_match_chat():
    """Two users: reciprocal LIKE → match → REST chat send/history."""
    with (
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as client_a,
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as client_b,
    ):
        user_a = _register_login_profile(client_a, "Smoke A")
        user_b = _register_login_profile(client_b, "Smoke B")

        # A likes B (no match yet)
        swipe_ab = client_a.post(
            "/matcher/swipe",
            json={"swiped_id": user_b["user_id"], "action": "LIKE"},
        )
        assert swipe_ab.status_code == 200, swipe_ab.text
        assert swipe_ab.json().get("is_match") is False

        # B likes A → match
        swipe_ba = client_b.post(
            "/matcher/swipe",
            json={"swiped_id": user_a["user_id"], "action": "LIKE"},
        )
        assert swipe_ba.status_code == 200, swipe_ba.text
        swipe_body = swipe_ba.json()
        assert swipe_body.get("is_match") is True, swipe_body
        match_id = swipe_body.get("match_id")
        assert match_id is not None, swipe_body

        matches_a = client_a.get("/matcher/matches")
        assert matches_a.status_code == 200, matches_a.text
        match_ids_a = {m.get("match_id") for m in matches_a.json()}
        assert match_id in match_ids_a, matches_a.text

        # Brief settle for matcher → chat internal register
        time.sleep(0.15)

        text = f"live smoke hello {uuid.uuid4().hex[:8]}"
        sent = client_a.post(
            f"/chat/conversations/{match_id}/messages",
            json={"text": text},
        )
        assert sent.status_code in (200, 201), sent.text
        sent_body = sent.json()
        assert sent_body.get("text") == text
        assert sent_body.get("match_id") == match_id

        hist = client_b.get(
            f"/chat/conversations/{match_id}/messages",
            params={"limit": 10},
        )
        assert hist.status_code == 200, hist.text
        hist_body = hist.json()
        messages = hist_body.get("messages", hist_body if isinstance(hist_body, list) else [])
        texts = [m.get("text") for m in messages]
        assert text in texts, hist_body

        msg_id = sent_body.get("id")
        assert isinstance(msg_id, int), sent_body
        read = client_b.post(
            f"/chat/conversations/{match_id}/read",
            json={"up_to_message_id": msg_id},
        )
        assert read.status_code in (200, 204), read.text

        hist_after = client_a.get(
            f"/chat/conversations/{match_id}/messages",
            params={"limit": 10},
        )
        assert hist_after.status_code == 200, hist_after.text
        after_msgs = hist_after.json().get("messages", [])
        marked = next((m for m in after_msgs if m.get("id") == msg_id), None)
        assert marked is not None, hist_after.text
        assert marked.get("read_at") is not None, marked

        # Cleanup sessions
        assert client_a.post("/auth/logout").status_code in (200, 204)
        assert client_b.post("/auth/logout").status_code in (200, 204)


def test_live_swipe_undo_pass():
    """PASS then DELETE /matcher/swipe/last restores the candidate for undo."""
    with (
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as client_a,
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as client_b,
    ):
        _register_login_profile(client_a, "Smoke Undo A")
        user_b = _register_login_profile(client_b, "Smoke Undo B")

        swipe = client_a.post(
            "/matcher/swipe",
            json={"swiped_id": user_b["user_id"], "action": "PASS"},
        )
        assert swipe.status_code == 200, swipe.text

        undo = client_a.delete("/matcher/swipe/last")
        assert undo.status_code == 200, undo.text
        body = undo.json()
        assert body.get("undone") is True, body
        assert body.get("swiped_id") == user_b["user_id"], body
        assert body.get("match_removed") is False, body

        # Peer still browsable after undo
        browse = client_a.get("/matcher/browse", params={"limit": 50, "sort": "best"})
        assert browse.status_code == 200, browse.text
        browse_body = browse.json()
        items = browse_body.get("items", browse_body if isinstance(browse_body, list) else [])
        ids = {item.get("user_id") for item in items}
        assert user_b["user_id"] in ids, browse_body

        assert client_a.post("/auth/logout").status_code in (200, 204)
        assert client_b.post("/auth/logout").status_code in (200, 204)


def test_live_project_create():
    """POST /projects then appear in GET /projects and GET /projects/{id}."""
    with httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as client:
        _register_login_profile(client, "Smoke PH")
        title = f"Live smoke project {uuid.uuid4().hex[:8]}"
        created = client.post(
            "/projects",
            json={
                "title": title,
                "description": "Need a pair for live gateway smoke coverage of Project Help create.",
                "tech_stack": ["Python", "React"],
            },
        )
        assert created.status_code in (200, 201), created.text
        body = created.json()
        project_id = body.get("id")
        assert project_id is not None, body
        assert body.get("title") == title

        listed = client.get("/projects")
        assert listed.status_code == 200, listed.text
        ids = {p.get("id") for p in listed.json()}
        assert project_id in ids, listed.text

        detail = client.get(f"/projects/{project_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json().get("title") == title

        assert client.post("/auth/logout").status_code in (200, 204)


def test_live_project_edit():
    """Owner PATCH /projects/{id} updates title/description while pending."""
    with httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as client:
        _register_login_profile(client, "Smoke Edit")
        created = client.post(
            "/projects",
            json={
                "title": f"Edit me {uuid.uuid4().hex[:8]}",
                "description": "Original description for live gateway edit smoke path.",
                "tech_stack": ["Go"],
            },
        )
        assert created.status_code in (200, 201), created.text
        project_id = created.json().get("id")
        assert project_id is not None, created.text

        new_title = f"Edited {uuid.uuid4().hex[:8]}"
        new_desc = "Updated description after owner PATCH on a pending request."
        patched = client.patch(
            f"/projects/{project_id}",
            json={
                "title": new_title,
                "description": new_desc,
                "tech_stack": ["Go", "Rust"],
            },
        )
        if patched.status_code == 405:
            pytest.skip(
                "Live gateway lacks PATCH /projects/{id} — restart gateway to pick up route"
            )
        assert patched.status_code == 200, patched.text
        assert patched.json().get("title") == new_title
        assert patched.json().get("description") == new_desc

        detail = client.get(f"/projects/{project_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json().get("title") == new_title
        assert "Rust" in (detail.json().get("tech_stack") or [])

        assert client.post("/auth/logout").status_code in (200, 204)


def test_live_project_offer_help():
    """Owner creates project; helper POST interested + comment; detail reflects both."""
    with (
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as owner,
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as helper,
    ):
        _register_login_profile(owner, "Smoke Owner")
        helper_user = _register_login_profile(helper, "Smoke Helper")

        created = owner.post(
            "/projects",
            json={
                "title": f"Need helper {uuid.uuid4().hex[:8]}",
                "description": "Live smoke: offer-help path via interested + comment APIs.",
                "tech_stack": ["Go", "React"],
            },
        )
        assert created.status_code in (200, 201), created.text
        project_id = created.json().get("id")
        assert project_id is not None, created.text

        note = f"happy to pair {uuid.uuid4().hex[:6]}"
        interest = helper.post(
            f"/projects/{project_id}/interested",
            json={"note": note},
        )
        assert interest.status_code in (200, 201), interest.text

        comment_body = f"Offer note: {note}"
        comment = helper.post(
            f"/projects/{project_id}/comments",
            json={"body": comment_body},
        )
        assert comment.status_code in (200, 201), comment.text
        assert comment.json().get("body") == comment_body

        detail = owner.get(f"/projects/{project_id}")
        assert detail.status_code == 200, detail.text
        detail_body = detail.json()
        interested = detail_body.get("interested") or []
        comments = detail_body.get("comments") or []
        interested_ids = {
            row.get("user_id") or row.get("userId") for row in interested
        }
        assert helper_user["user_id"] in interested_ids, detail_body
        assert any(c.get("body") == comment_body for c in comments), detail_body

        assert owner.post("/auth/logout").status_code in (200, 204)
        assert helper.post("/auth/logout").status_code in (200, 204)


def test_live_project_uninterest():
    """Helper POST interested then DELETE interested removes them from the list."""
    with (
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as owner,
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as helper,
    ):
        _register_login_profile(owner, "Smoke Uninterest Owner")
        helper_user = _register_login_profile(helper, "Smoke Uninterest Helper")

        created = owner.post(
            "/projects",
            json={
                "title": f"Uninterest {uuid.uuid4().hex[:8]}",
                "description": "Live smoke: withdraw interest via DELETE /projects/{id}/interested.",
                "tech_stack": ["Python"],
            },
        )
        assert created.status_code in (200, 201), created.text
        project_id = created.json().get("id")
        assert project_id is not None, created.text

        interest = helper.post(
            f"/projects/{project_id}/interested",
            json={"note": "signing up then withdrawing"},
        )
        assert interest.status_code in (200, 201), interest.text

        gone = helper.delete(f"/projects/{project_id}/interested")
        assert gone.status_code in (200, 204), gone.text

        detail = owner.get(f"/projects/{project_id}")
        assert detail.status_code == 200, detail.text
        interested = detail.json().get("interested") or []
        interested_ids = {
            row.get("user_id") or row.get("userId") for row in interested
        }
        assert helper_user["user_id"] not in interested_ids, detail.text

        assert owner.post("/auth/logout").status_code in (200, 204)
        assert helper.post("/auth/logout").status_code in (200, 204)


def test_live_project_cancel():
    """Owner PATCH status=cancelled on a pending project."""
    with httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as client:
        _register_login_profile(client, "Smoke Cancel")
        created = client.post(
            "/projects",
            json={
                "title": f"Cancel me {uuid.uuid4().hex[:8]}",
                "description": "Live smoke: owner cancels a pending Project Help request.",
                "tech_stack": ["Rust"],
            },
        )
        assert created.status_code in (200, 201), created.text
        project_id = created.json().get("id")
        assert project_id is not None, created.text

        cancelled = client.patch(
            f"/projects/{project_id}/status",
            json={"status": "cancelled"},
        )
        assert cancelled.status_code == 200, cancelled.text
        assert cancelled.json().get("status") == "cancelled"

        detail = client.get(f"/projects/{project_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json().get("status") == "cancelled"

        assert client.post("/auth/logout").status_code in (200, 204)


def test_live_project_accept_helper():
    """Helper interests → owner PATCH accepted with helper_user_id."""
    with (
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as owner,
        httpx.Client(base_url=BASE, timeout=8.0, follow_redirects=True) as helper,
    ):
        _register_login_profile(owner, "Smoke Accept Owner")
        helper_user = _register_login_profile(helper, "Smoke Accept Helper")

        created = owner.post(
            "/projects",
            json={
                "title": f"Accept helper {uuid.uuid4().hex[:8]}",
                "description": "Live smoke: accept an interested helper on Project Help.",
                "tech_stack": ["TypeScript"],
            },
        )
        assert created.status_code in (200, 201), created.text
        project_id = created.json().get("id")
        assert project_id is not None, created.text

        interest = helper.post(
            f"/projects/{project_id}/interested",
            json={"note": "I can take this"},
        )
        assert interest.status_code in (200, 201), interest.text

        accepted = owner.patch(
            f"/projects/{project_id}/status",
            json={"status": "accepted", "helper_user_id": helper_user["user_id"]},
        )
        assert accepted.status_code == 200, accepted.text
        body = accepted.json()
        assert body.get("status") == "accepted", body
        assert body.get("helper_user_id") == helper_user["user_id"], body

        # Owner or helper may advance accepted → in_progress
        progressed = owner.patch(
            f"/projects/{project_id}/status",
            json={"status": "in_progress"},
        )
        assert progressed.status_code == 200, progressed.text
        assert progressed.json().get("status") == "in_progress"

        assert owner.post("/auth/logout").status_code in (200, 204)
        assert helper.post("/auth/logout").status_code in (200, 204)
