"""Project Help lifecycle: status transitions, interested, comments."""

from __future__ import annotations

from tests.conftest import auth_headers, secret_headers


def _create_project(client, user_id=1, title="Need pair programming help now"):
    res = client.post(
        "/api/v1/projects",
        json={
            "title": title,
            "description": "Looking for someone to help debug a race condition in workers.",
            "tech_stack": ["Python", "FastAPI"],
        },
        headers=auth_headers(user_id),
    )
    assert res.status_code == 201
    return res.json()


def test_project_detail_includes_interested_and_comments(profile_client):
    project = _create_project(profile_client, user_id=1)
    pid = project["id"]

    interest = profile_client.post(
        f"/api/v1/projects/{pid}/interested",
        json={"note": "I can help"},
        headers=auth_headers(2),
    )
    assert interest.status_code == 201

    comment = profile_client.post(
        f"/api/v1/projects/{pid}/comments",
        json={"body": "What's the stack version?"},
        headers=auth_headers(2),
    )
    assert comment.status_code == 201

    detail = profile_client.get(
        f"/api/v1/projects/{pid}",
        headers=secret_headers(),
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "pending"
    assert len(body["interested"]) == 1
    assert body["interested"][0]["user_id"] == 2
    assert len(body["comments"]) == 1
    assert body["comments"][0]["body"] == "What's the stack version?"


def test_status_forward_transitions(profile_client):
    project = _create_project(profile_client, user_id=1)
    pid = project["id"]

    profile_client.post(
        f"/api/v1/projects/{pid}/interested",
        json={},
        headers=auth_headers(2),
    )

    # Non-owner cannot accept (authZ → 403)
    denied = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "accepted", "helper_user_id": 2},
        headers=auth_headers(2),
    )
    assert denied.status_code == 403
    assert "owner" in denied.json()["detail"].lower()

    accepted = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "accepted", "helper_user_id": 2},
        headers=auth_headers(1),
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["helper_user_id"] == 2

    # Helper can move to in_progress
    progress = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "in_progress"},
        headers=auth_headers(2),
    )
    assert progress.status_code == 200
    assert progress.json()["status"] == "in_progress"

    done = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "completed"},
        headers=auth_headers(1),
    )
    assert done.status_code == 200
    assert done.json()["status"] == "completed"


def test_reject_invalid_and_backward_transitions(profile_client):
    project = _create_project(profile_client, user_id=1)
    pid = project["id"]

    # Skip ahead pending → in_progress
    skip = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "in_progress"},
        headers=auth_headers(1),
    )
    assert skip.status_code == 400

    profile_client.post(
        f"/api/v1/projects/{pid}/interested",
        json={},
        headers=auth_headers(2),
    )
    profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "accepted", "helper_user_id": 2},
        headers=auth_headers(1),
    )

    # Backward accepted → pending
    back = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "pending"},
        headers=auth_headers(1),
    )
    assert back.status_code == 400

    # Stranger cannot change status (authZ → 403)
    stranger = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "in_progress"},
        headers=auth_headers(99),
    )
    assert stranger.status_code == 403


def test_owner_cancel_allowed(profile_client):
    project = _create_project(profile_client, user_id=1)
    pid = project["id"]

    # Helper cannot cancel (authZ → 403)
    profile_client.post(
        f"/api/v1/projects/{pid}/interested",
        json={},
        headers=auth_headers(2),
    )
    profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "accepted", "helper_user_id": 2},
        headers=auth_headers(1),
    )
    helper_cancel = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "cancelled"},
        headers=auth_headers(2),
    )
    assert helper_cancel.status_code == 403

    owner_cancel = profile_client.patch(
        f"/api/v1/projects/{pid}/status",
        json={"status": "cancelled"},
        headers=auth_headers(1),
    )
    assert owner_cancel.status_code == 200
    assert owner_cancel.json()["status"] == "cancelled"


def test_remove_interested(profile_client):
    project = _create_project(profile_client, user_id=1)
    pid = project["id"]
    profile_client.post(
        f"/api/v1/projects/{pid}/interested",
        json={"note": "me"},
        headers=auth_headers(2),
    )
    deleted = profile_client.delete(
        f"/api/v1/projects/{pid}/interested",
        headers=auth_headers(2),
    )
    assert deleted.status_code == 204
    detail = profile_client.get(f"/api/v1/projects/{pid}", headers=secret_headers())
    assert detail.json()["interested"] == []
