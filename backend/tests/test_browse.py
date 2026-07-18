"""Browse scoring, sort, pagination, and seed-auto-like gate."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from matcher_service.scoring import compute_score, jaccard, filter_by_tags
from tests.conftest import auth_headers


def test_jaccard_overlap():
    assert jaccard(["React", "Go"], ["react", "Python"]) == pytest.approx(1 / 3)
    assert jaccard([], ["React"]) == 0.0


def test_compute_score_range_and_interest_boost():
    viewer = {
        "interests": ["React", "TypeScript", "CSS"],
        "looking_for": "Backend Partner",
        "lat": 37.77,
        "lng": -122.42,
        "radius_limit": 25,
    }
    strong = {
        "interests": ["React", "TypeScript", "Node"],
        "looking_for": "Frontend",
        "lat": 37.78,
        "lng": -122.41,
        "last_active_at": "2099-01-01 00:00:00",
    }
    weak = {
        "interests": ["COBOL"],
        "looking_for": "Mainframe",
        "lat": 40.0,
        "lng": -74.0,
        "last_active_at": None,
    }
    s_strong = compute_score(viewer, strong)["score"]
    s_weak = compute_score(viewer, weak)["score"]
    assert 0 <= s_strong <= 100
    assert 0 <= s_weak <= 100
    assert s_strong > s_weak


def test_filter_by_tags():
    cands = [
        {"user_id": 1, "interests": ["React", "Go"]},
        {"user_id": 2, "interests": ["Rust"]},
    ]
    filtered = filter_by_tags(cands, ["go"])
    assert len(filtered) == 1
    assert filtered[0]["user_id"] == 1


def test_empty_tags_means_no_filter():
    cands = [
        {"user_id": 1, "interests": ["React", "Go"]},
        {"user_id": 2, "interests": ["Rust"]},
    ]
    assert filter_by_tags(cands, None) == cands
    assert filter_by_tags(cands, []) == cands
    # Empty / whitespace-only tags must not require matching zero tags
    assert filter_by_tags(cands, ["", "  "]) == cands


def test_browse_sort_pagination_and_score_field(matcher_client, monkeypatch):
    profiles = [
        {
            "user_id": 1,
            "name": "Viewer",
            "interests": ["React", "CSS"],
            "looking_for": "Backend",
            "lat": 37.77,
            "lng": -122.42,
            "radius_limit": 50,
            "last_active_at": "2026-07-18 12:00:00",
        },
        {
            "user_id": 2,
            "name": "Alice",
            "age": 25,
            "bio": "fe",
            "image": "/a.png",
            "interests": ["React", "Vite"],
            "looking_for": "Backend Partner",
            "lat": 37.78,
            "lng": -122.41,
            "last_active_at": "2026-07-18 11:00:00",
        },
        {
            "user_id": 3,
            "name": "Bob",
            "age": 30,
            "bio": "be",
            "image": "/b.png",
            "interests": ["Rust", "Systems"],
            "looking_for": "Frontend Developer",
            "lat": 37.79,
            "lng": -122.40,
            "last_active_at": "2026-07-17 11:00:00",
        },
        {
            "user_id": 4,
            "name": "Cara",
            "interests": ["React"],
            "looking_for": "Pair",
            "lat": 37.775,
            "lng": -122.415,
            "last_active_at": "2026-07-18 10:00:00",
        },
    ]

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = profiles

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("matcher_service.main.httpx.AsyncClient", return_value=mock_client):
        res = matcher_client.get(
            "/api/v1/matcher/browse",
            params={"sort": "best", "limit": 2},
            headers=auth_headers(1),
        )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "next_cursor" in data
    assert len(data["items"]) == 2
    assert data["next_cursor"] is not None
    for item in data["items"]:
        assert "score" in item
        assert 0 <= item["score"] <= 100
        assert "email" not in item

    # Scores should be non-increasing for sort=best
    scores = [i["score"] for i in data["items"]]
    assert scores == sorted(scores, reverse=True)

    with patch("matcher_service.main.httpx.AsyncClient", return_value=mock_client):
        page2 = matcher_client.get(
            "/api/v1/matcher/browse",
            params={"sort": "best", "limit": 2, "cursor": data["next_cursor"]},
            headers=auth_headers(1),
        )
    assert page2.status_code == 200
    assert len(page2.json()["items"]) == 1

    with patch("matcher_service.main.httpx.AsyncClient", return_value=mock_client):
        tagged = matcher_client.get(
            "/api/v1/matcher/browse",
            params={"tags": "Rust", "sort": "best"},
            headers=auth_headers(1),
        )
    assert tagged.status_code == 200
    assert all("Rust" in (i["interests"] or []) for i in tagged.json()["items"])


def test_seed_auto_like_off_by_default(matcher_client, monkeypatch):
    import matcher_service.main as mmain

    assert mmain.SEED_AUTO_LIKE is False

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "user": {"email": "alice@zinder.internal", "name": "Alice"}
    }

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.post = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("matcher_service.main.httpx.AsyncClient", return_value=mock_client):
        res = matcher_client.post(
            "/api/v1/matcher/swipe",
            json={"swiped_id": 2, "action": "LIKE"},
            headers=auth_headers(1),
        )
    assert res.status_code == 200
    # With auto-like off and no reciprocal, no match
    assert res.json()["is_match"] is False
    # Internal privileged profile fetch should NOT have been needed/called for seed
    # (may still be called 0 times)
    assert mock_client.get.await_count == 0
