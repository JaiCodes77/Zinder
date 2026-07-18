"""Shared fixtures: isolated temp SQLite DBs + FastAPI TestClients."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("INTERNAL_SERVICE_SECRET", "test-internal-secret")
os.environ.setdefault("SEED_AUTO_LIKE", "false")


@pytest.fixture()
def tmp_dbs(tmp_path, monkeypatch):
    profile_db = tmp_path / "profile.db"
    matcher_db = tmp_path / "matcher.db"
    chat_db = tmp_path / "chat.db"
    monkeypatch.setenv("PROFILE_DB_PATH", str(profile_db))
    monkeypatch.setenv("MATCHER_DB_PATH", str(matcher_db))
    monkeypatch.setenv("CHAT_DB_PATH", str(chat_db))
    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "test-internal-secret")
    monkeypatch.setenv("SEED_AUTO_LIKE", "false")
    return {"profile": profile_db, "matcher": matcher_db, "chat": chat_db}


@pytest.fixture()
def profile_client(tmp_dbs):
    # Re-import modules so DB_PATH picks up env
    import importlib
    import profile_service.database as pdb
    import profile_service.main as pmain

    importlib.reload(pdb)
    importlib.reload(pmain)
    pdb.init_db()
    with TestClient(pmain.app) as client:
        yield client


@pytest.fixture()
def chat_client(tmp_dbs):
    import importlib
    import chat_service.database as cdb
    import chat_service.main as cmain

    importlib.reload(cdb)
    importlib.reload(cmain)
    cdb.init_db()
    with TestClient(cmain.app) as client:
        yield client


@pytest.fixture()
def matcher_client(tmp_dbs, monkeypatch):
    import importlib
    import matcher_service.database as mdb
    import matcher_service.main as mmain

    importlib.reload(mdb)
    importlib.reload(mmain)
    mdb.init_db()
    with TestClient(mmain.app) as client:
        yield client


@pytest.fixture()
def gateway_client(tmp_dbs, monkeypatch):
    """Gateway with in-memory sessions; stubs Redis as unavailable."""
    import importlib
    import profile_service.database as pdb
    import profile_service.main as pmain
    import matcher_service.database as mdb
    import matcher_service.main as mmain
    import chat_service.database as cdb
    import chat_service.main as cmain
    import app.main as gmain

    importlib.reload(pdb)
    importlib.reload(pmain)
    importlib.reload(mdb)
    importlib.reload(mmain)
    importlib.reload(cdb)
    importlib.reload(cmain)
    pdb.init_db()
    mdb.init_db()
    cdb.init_db()

    # Mount services in-process is hard; gateway tests that need full stack
    # use httpx mocking or the unit fixtures above. This fixture only boots gateway.
    importlib.reload(gmain)
    with TestClient(gmain.app) as client:
        yield client


def auth_headers(user_id: int) -> dict:
    return {
        "X-Internal-Secret": "test-internal-secret",
        "X-User-Id": str(user_id),
    }


def secret_headers() -> dict:
    return {"X-Internal-Secret": "test-internal-secret"}
