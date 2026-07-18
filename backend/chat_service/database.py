import os
import sqlite3
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional, Tuple

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.getenv("CHAT_DB_PATH", os.path.join(_BACKEND_ROOT, "data", "chat.db"))


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
        # Local mirror of match participants for authZ without calling matcher on every message
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS match_participants (
                match_id INTEGER PRIMARY KEY,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id INTEGER NOT NULL,
                sender_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                read_at DATETIME,
                FOREIGN KEY (match_id) REFERENCES match_participants (match_id)
            );
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_match_created ON messages(match_id, id);"
        )
        conn.commit()


def upsert_match_participants(match_id: int, user1_id: int, user2_id: int) -> None:
    u1, u2 = min(user1_id, user2_id), max(user1_id, user2_id)
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO match_participants (match_id, user1_id, user2_id)
            VALUES (?, ?, ?)
            ON CONFLICT(match_id) DO UPDATE SET
                user1_id = excluded.user1_id,
                user2_id = excluded.user2_id
            """,
            (match_id, u1, u2),
        )
        conn.commit()


def get_match_participants(match_id: int) -> Optional[Tuple[int, int]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user1_id, user2_id FROM match_participants WHERE match_id = ?",
            (match_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return int(row["user1_id"]), int(row["user2_id"])


def user_in_match(match_id: int, user_id: int) -> bool:
    participants = get_match_participants(match_id)
    if not participants:
        return False
    return user_id in participants


def create_message(match_id: int, sender_id: int, text: str) -> Dict[str, Any]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO messages (match_id, sender_id, text)
            VALUES (?, ?, ?)
            """,
            (match_id, sender_id, text.strip()),
        )
        msg_id = cursor.lastrowid
        conn.commit()
        cursor.execute("SELECT * FROM messages WHERE id = ?", (msg_id,))
        row = cursor.fetchone()
    return _row_to_message(row)


def _row_to_message(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "match_id": row["match_id"],
        "sender_id": row["sender_id"],
        "text": row["text"],
        "created_at": str(row["created_at"]),
        "read_at": str(row["read_at"]) if row["read_at"] else None,
    }


def get_messages(
    match_id: int,
    before: Optional[int] = None,
    limit: int = 50,
) -> Tuple[List[Dict[str, Any]], Optional[int]]:
    limit = max(1, min(limit, 100))
    with get_db_conn() as conn:
        cursor = conn.cursor()
        if before is not None:
            cursor.execute(
                """
                SELECT * FROM messages
                WHERE match_id = ? AND id < ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (match_id, before, limit),
            )
        else:
            cursor.execute(
                """
                SELECT * FROM messages
                WHERE match_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (match_id, limit),
            )
        rows = cursor.fetchall()

    messages = [_row_to_message(r) for r in reversed(rows)]
    next_before = messages[0]["id"] if len(messages) == limit and messages else None
    # next_before should point to oldest id in this page for further pagination
    if len(rows) == limit and messages:
        next_before = messages[0]["id"]
    else:
        next_before = None
    return messages, next_before


def mark_read(match_id: int, reader_id: int, up_to_message_id: int) -> int:
    """
    Mark messages from the other participant as read up to up_to_message_id.
    Returns number of rows updated.
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE messages
            SET read_at = CURRENT_TIMESTAMP
            WHERE match_id = ?
              AND id <= ?
              AND sender_id != ?
              AND read_at IS NULL
            """,
            (match_id, up_to_message_id, reader_id),
        )
        conn.commit()
        return cursor.rowcount


def get_activity(match_id: int) -> Dict[str, Any]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM messages WHERE match_id = ?",
            (match_id,),
        )
        count = int(cursor.fetchone()["cnt"])
    return {
        "match_id": match_id,
        "has_messages": count > 0,
        "message_count": count,
    }


def delete_match_participants(match_id: int) -> None:
    """Used when a match is undone with no activity."""
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM messages WHERE match_id = ?", (match_id,))
        cursor.execute("DELETE FROM match_participants WHERE match_id = ?", (match_id,))
        conn.commit()
