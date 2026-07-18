"""Auth: register / login verify / bcrypt migration / logout / me."""

from __future__ import annotations

import hashlib
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth_headers, secret_headers


def test_profiles_list_requires_auth(profile_client):
    res = profile_client.get("/api/v1/profiles")
    assert res.status_code == 401


def test_profiles_list_rejects_spoofed_user_id_without_secret(profile_client):
    res = profile_client.get("/api/v1/profiles", headers={"X-User-Id": "1"})
    assert res.status_code == 401


def test_profiles_list_scoped_no_emails(profile_client):
    res = profile_client.get("/api/v1/profiles", headers=auth_headers(1))
    assert res.status_code == 200
    profiles = res.json()
    assert len(profiles) >= 2
    for p in profiles:
        assert "email" not in p
        assert "name" in p
        assert "user_id" in p


def test_register_and_verify_bcrypt(profile_client):
    reg = profile_client.post(
        "/api/v1/users",
        json={
            "email": "newdev@example.com",
            "password": "securepass99",
            "name": "New Dev",
        },
    )
    assert reg.status_code == 201
    body = reg.json()
    assert body["email"] == "newdev@example.com"
    assert body["name"] == "New Dev"

    verify = profile_client.post(
        "/api/v1/users/verify",
        json={"email": "newdev@example.com", "password": "securepass99"},
    )
    assert verify.status_code == 200
    assert verify.json()["id"] == body["id"]

    # Stored hash should be bcrypt, not SHA-256 hex
    from profile_service.database import get_user_by_email

    user = get_user_by_email("newdev@example.com")
    assert user["password_hash"].startswith("$2")


def test_legacy_sha256_rehash_on_login(profile_client, tmp_dbs):
    from profile_service.database import get_db_conn, get_user_by_email

    legacy = hashlib.sha256(b"oldpassword1").hexdigest()
    with get_db_conn() as conn:
        conn.execute(
            "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
            ("legacy@example.com", legacy, "Legacy User"),
        )
        conn.commit()

    bad = profile_client.post(
        "/api/v1/users/verify",
        json={"email": "legacy@example.com", "password": "wrong"},
    )
    assert bad.status_code == 401

    ok = profile_client.post(
        "/api/v1/users/verify",
        json={"email": "legacy@example.com", "password": "oldpassword1"},
    )
    assert ok.status_code == 200

    user = get_user_by_email("legacy@example.com")
    assert user["password_hash"].startswith("$2")
    assert user["password_hash"] != legacy

    # Still logs in after upgrade
    again = profile_client.post(
        "/api/v1/users/verify",
        json={"email": "legacy@example.com", "password": "oldpassword1"},
    )
    assert again.status_code == 200


def test_gateway_login_logout_me(tmp_dbs, monkeypatch):
    import importlib
    import profile_service.database as pdb
    import profile_service.main as pmain
    import app.main as gmain
    from shared.security import hash_password

    importlib.reload(pdb)
    importlib.reload(pmain)
    pdb.init_db()

    # Ensure a known user exists
    from profile_service.database import create_user, get_user_by_email

    if not get_user_by_email("gw@example.com"):
        create_user("gw@example.com", hash_password("password123"), "GW User")

    importlib.reload(gmain)

    # Patch _proxy_json for verify to hit profile app in-process
    profile_tc = TestClient(pmain.app)

    async def proxy_side_effect(method, url, user_id=None, json_body=None, params=None, expected=None):
        if url.endswith("/users/verify") and method == "POST":
            r = profile_tc.post("/api/v1/users/verify", json=json_body)
            if r.status_code != 200:
                from fastapi import HTTPException

                raise HTTPException(status_code=r.status_code, detail=r.json().get("detail"))
            return r.json()
        if url.endswith("/profiles/me") and method == "GET":
            r = profile_tc.get("/api/v1/profiles/me", headers=auth_headers(user_id))
            return r.json()
        raise AssertionError(f"Unexpected proxy {method} {url}")

    monkeypatch.setattr(gmain, "_proxy_json", proxy_side_effect)

    async def _no_redis():
        yield None

    monkeypatch.setattr(gmain, "get_redis", _no_redis)

    with TestClient(gmain.app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "gw@example.com", "password": "password123"},
        )
        assert login.status_code == 200
        data = login.json()
        assert data["email"] == "gw@example.com"
        assert "id" in data
        assert "sessionId" in login.cookies

        me = client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == "gw@example.com"

        logout = client.post("/api/v1/auth/logout")
        assert logout.status_code == 204

        me_after = client.get("/api/v1/auth/me")
        assert me_after.status_code == 401
