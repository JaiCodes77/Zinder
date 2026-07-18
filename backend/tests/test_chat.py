"""Chat service: history, send, read, authorization."""

from __future__ import annotations

from tests.conftest import auth_headers, secret_headers


def _register_match(chat_client, match_id=1, u1=1, u2=2):
    res = chat_client.post(
        "/api/v1/internal/matches",
        json={"match_id": match_id, "user1_id": u1, "user2_id": u2},
        headers=secret_headers(),
    )
    assert res.status_code == 204


def test_chat_requires_participant(chat_client):
    _register_match(chat_client)
    # User 99 is not a participant
    res = chat_client.get(
        "/api/v1/chat/conversations/1/messages",
        headers=auth_headers(99),
    )
    assert res.status_code == 403


def test_chat_send_and_history_pagination(chat_client):
    _register_match(chat_client, match_id=10, u1=1, u2=2)

    for i in range(5):
        res = chat_client.post(
            f"/api/v1/chat/conversations/10/messages",
            json={"text": f"msg-{i}"},
            headers=auth_headers(1),
        )
        assert res.status_code == 201
        body = res.json()
        assert body["text"] == f"msg-{i}"
        assert body["sender_id"] == 1
        assert body["match_id"] == 10
        assert "id" in body
        assert "created_at" in body

    page = chat_client.get(
        "/api/v1/chat/conversations/10/messages",
        params={"limit": 3},
        headers=auth_headers(2),
    )
    assert page.status_code == 200
    data = page.json()
    assert len(data["messages"]) == 3
    assert data["next_before"] is not None

    older = chat_client.get(
        "/api/v1/chat/conversations/10/messages",
        params={"limit": 3, "before": data["next_before"]},
        headers=auth_headers(2),
    )
    assert older.status_code == 200
    older_msgs = older.json()["messages"]
    assert len(older_msgs) == 2
    # No overlap with first page ids
    first_ids = {m["id"] for m in data["messages"]}
    older_ids = {m["id"] for m in older_msgs}
    assert first_ids.isdisjoint(older_ids)


def test_chat_mark_read(chat_client):
    _register_match(chat_client, match_id=20, u1=1, u2=2)
    sent = chat_client.post(
        "/api/v1/chat/conversations/20/messages",
        json={"text": "hello"},
        headers=auth_headers(1),
    )
    msg_id = sent.json()["id"]

    read = chat_client.post(
        "/api/v1/chat/conversations/20/read",
        json={"up_to_message_id": msg_id},
        headers=auth_headers(2),
    )
    assert read.status_code == 204

    hist = chat_client.get(
        "/api/v1/chat/conversations/20/messages",
        headers=auth_headers(2),
    )
    assert hist.status_code == 200
    msg = hist.json()["messages"][0]
    assert msg["read_at"] is not None


def test_chat_activity_endpoint(chat_client):
    _register_match(chat_client, match_id=30, u1=1, u2=2)
    empty = chat_client.get(
        "/api/v1/internal/matches/30/activity",
        headers=secret_headers(),
    )
    assert empty.status_code == 200
    assert empty.json()["has_messages"] is False

    chat_client.post(
        "/api/v1/chat/conversations/30/messages",
        json={"text": "hi"},
        headers=auth_headers(1),
    )
    active = chat_client.get(
        "/api/v1/internal/matches/30/activity",
        headers=secret_headers(),
    )
    assert active.json()["has_messages"] is True
    assert active.json()["message_count"] == 1


def test_chat_rejects_missing_internal_secret(chat_client):
    _register_match(chat_client)
    res = chat_client.post(
        "/api/v1/chat/conversations/1/messages",
        json={"text": "nope"},
        headers={"X-User-Id": "1"},
    )
    assert res.status_code == 401
