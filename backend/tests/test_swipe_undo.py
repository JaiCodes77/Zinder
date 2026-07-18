"""Swipe undo semantics including match removal with chat activity guard."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import auth_headers


def test_undo_last_swipe(matcher_client):
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    # activity check / register not needed for PASS
    mock_client.get = AsyncMock()
    mock_client.post = AsyncMock()
    mock_client.delete = AsyncMock()

    with patch("matcher_service.main.httpx.AsyncClient", return_value=mock_client):
        swipe = matcher_client.post(
            "/api/v1/matcher/swipe",
            json={"swiped_id": 2, "action": "PASS"},
            headers=auth_headers(1),
        )
        assert swipe.status_code == 200

        undo = matcher_client.delete(
            "/api/v1/matcher/swipe/last",
            headers=auth_headers(1),
        )
    assert undo.status_code == 200
    body = undo.json()
    assert body["undone"] is True
    assert body["swiped_id"] == 2
    assert body["match_removed"] is False


def test_undo_match_blocked_when_messages_exist(matcher_client):
    # Create reciprocal likes → match
    activity = MagicMock()
    activity.status_code = 200
    activity.json.return_value = {"has_messages": True, "message_count": 1}

    register = MagicMock()
    register.status_code = 204

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=register)
    mock_client.get = AsyncMock(return_value=activity)
    mock_client.delete = AsyncMock()

    with patch("matcher_service.main.httpx.AsyncClient", return_value=mock_client):
        matcher_client.post(
            "/api/v1/matcher/swipe",
            json={"swiped_id": 1, "action": "LIKE"},
            headers=auth_headers(2),
        )
        matcher_client.post(
            "/api/v1/matcher/swipe",
            json={"swiped_id": 2, "action": "LIKE"},
            headers=auth_headers(1),
        )
        blocked = matcher_client.delete(
            "/api/v1/matcher/swipe/last",
            headers=auth_headers(1),
        )
    assert blocked.status_code == 409


def test_undo_match_allowed_without_messages(matcher_client):
    activity = MagicMock()
    activity.status_code = 200
    activity.json.return_value = {"has_messages": False, "message_count": 0}

    ok_resp = MagicMock()
    ok_resp.status_code = 204

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=ok_resp)
    mock_client.get = AsyncMock(return_value=activity)
    mock_client.delete = AsyncMock(return_value=ok_resp)

    with patch("matcher_service.main.httpx.AsyncClient", return_value=mock_client):
        matcher_client.post(
            "/api/v1/matcher/swipe",
            json={"swiped_id": 1, "action": "LIKE"},
            headers=auth_headers(2),
        )
        swipe = matcher_client.post(
            "/api/v1/matcher/swipe",
            json={"swiped_id": 2, "action": "LIKE"},
            headers=auth_headers(1),
        )
        assert swipe.json()["is_match"] is True

        undo = matcher_client.delete(
            "/api/v1/matcher/swipe/last",
            headers=auth_headers(1),
        )
    assert undo.status_code == 200
    assert undo.json()["match_removed"] is True
