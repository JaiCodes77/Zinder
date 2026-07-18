import os
import sqlite3
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.getenv("MATCHER_DB_PATH", os.path.join(_BACKEND_ROOT, "data", "matcher.db"))


@contextmanager
def get_db_conn() -> Generator[sqlite3.Connection, None, None]:
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    with get_db_conn() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS swipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                swiper_id INTEGER NOT NULL,
                swiped_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(swiper_id, swiped_id)
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user1_id, user2_id)
            );
        """)

        conn.commit()


def record_swipe(swiper_id: int, swiped_id: int, action: str) -> int:
    """Logs a swipe action. Returns swipe row id."""
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO swipes (swiper_id, swiped_id, action)
            VALUES (?, ?, ?)
            ON CONFLICT(swiper_id, swiped_id) DO UPDATE SET
                action = excluded.action,
                timestamp = CURRENT_TIMESTAMP;
            """,
            (swiper_id, swiped_id, action.strip().upper()),
        )
        conn.commit()
        cursor.execute(
            "SELECT id FROM swipes WHERE swiper_id = ? AND swiped_id = ?",
            (swiper_id, swiped_id),
        )
        row = cursor.fetchone()
        return int(row["id"]) if row else cursor.lastrowid


def get_swiped_user_ids(swiper_id: int) -> List[int]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT swiped_id FROM swipes WHERE swiper_id = ?", (swiper_id,))
        rows = cursor.fetchall()
        return [row["swiped_id"] for row in rows]


def check_reciprocal_swipe(swiper_id: int, swiped_id: int) -> bool:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id FROM swipes
            WHERE swiper_id = ? AND swiped_id = ? AND action IN ('LIKE', 'SUPERLIKE');
            """,
            (swiped_id, swiper_id),
        )
        row = cursor.fetchone()
        return row is not None


def create_match(user1_id: int, user2_id: int) -> Optional[int]:
    u1, u2 = min(user1_id, user2_id), max(user1_id, user2_id)
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO matches (user1_id, user2_id)
            VALUES (?, ?)
            ON CONFLICT(user1_id, user2_id) DO NOTHING;
            """,
            (u1, u2),
        )
        conn.commit()
        cursor.execute(
            "SELECT id FROM matches WHERE user1_id = ? AND user2_id = ?",
            (u1, u2),
        )
        row = cursor.fetchone()
        return int(row["id"]) if row else None


def get_match_between(user_a: int, user_b: int) -> Optional[Dict[str, Any]]:
    u1, u2 = min(user_a, user_b), max(user_a, user_b)
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM matches WHERE user1_id = ? AND user2_id = ?",
            (u1, u2),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_match(match_id: int) -> bool:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM matches WHERE id = ?", (match_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_last_swipe(swiper_id: int) -> Optional[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM swipes
            WHERE swiper_id = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT 1
            """,
            (swiper_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_swipe(swipe_id: int, swiper_id: int) -> bool:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM swipes WHERE id = ? AND swiper_id = ?",
            (swipe_id, swiper_id),
        )
        conn.commit()
        return cursor.rowcount > 0


def get_matches(user_id: int) -> List[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM matches
            WHERE user1_id = ? OR user2_id = ?
            ORDER BY timestamp DESC;
            """,
            (user_id, user_id),
        )
        rows = cursor.fetchall()

    matches = []
    for row in rows:
        match_record = dict(row)
        matched_id = (
            match_record["user2_id"]
            if match_record["user1_id"] == user_id
            else match_record["user1_id"]
        )
        matches.append(
            {
                "match_id": match_record["id"],
                "matched_user_id": matched_id,
                "timestamp": str(match_record["timestamp"]),
            }
        )
    return matches
