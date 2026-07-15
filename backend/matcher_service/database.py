import os
import sqlite3
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional

# Resolved relative to the backend package root (backend/data/matcher.db) so the
# service runs identically regardless of the current working directory or host machine.
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.getenv("MATCHER_DB_PATH", os.path.join(_BACKEND_ROOT, "data", "matcher.db"))

@contextmanager
def get_db_conn() -> Generator[sqlite3.Connection, None, None]:
    """Obtain database connection with foreign keys enabled."""
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
    """Initialize database tables for swipes and matches."""
    with get_db_conn() as conn:
        cursor = conn.cursor()
        
        # Create swipes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS swipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                swiper_id INTEGER NOT NULL,
                swiped_id INTEGER NOT NULL,
                action TEXT NOT NULL, -- 'LIKE', 'PASS', 'SUPERLIKE'
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(swiper_id, swiped_id)
            );
        """)
        
        # Create matches table
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

def record_swipe(swiper_id: int, swiped_id: int, action: str) -> None:
    """Logs a swipe action, replacing it if the user somehow swiped again."""
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO swipes (swiper_id, swiped_id, action)
            VALUES (?, ?, ?)
            ON CONFLICT(swiper_id, swiped_id) DO UPDATE SET
                action = excluded.action,
                timestamp = CURRENT_TIMESTAMP;
        """, (swiper_id, swiped_id, action.strip().upper()))
        conn.commit()

def get_swiped_user_ids(swiper_id: int) -> List[int]:
    """Retrieves all user IDs that the swiper_id has swiped on."""
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT swiped_id FROM swipes WHERE swiper_id = ?", (swiper_id,))
        rows = cursor.fetchall()
        return [row["swiped_id"] for row in rows]

def check_reciprocal_swipe(swiper_id: int, swiped_id: int) -> bool:
    """Checks if swiped_id has liked swiper_id (mutual swipe)."""
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id FROM swipes
            WHERE swiper_id = ? AND swiped_id = ? AND action IN ('LIKE', 'SUPERLIKE');
        """, (swiped_id, swiper_id))
        row = cursor.fetchone()
        return row is not None

def create_match(user1_id: int, user2_id: int) -> Optional[int]:
    """
    Establishes a match record.
    user1_id is always smaller than user2_id to ensure database uniqueness.
    Returns the match ID.
    """
    u1, u2 = min(user1_id, user2_id), max(user1_id, user2_id)
    with get_db_conn() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO matches (user1_id, user2_id)
                VALUES (?, ?)
                ON CONFLICT(user1_id, user2_id) DO UPDATE SET
                    timestamp = CURRENT_TIMESTAMP;
            """, (u1, u2))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None

def get_matches(user_id: int) -> List[Dict[str, Any]]:
    """Retrieves all matches involving the user, sorted by timestamp descending."""
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM matches
            WHERE user1_id = ? OR user2_id = ?
            ORDER BY timestamp DESC;
        """, (user_id, user_id))
        rows = cursor.fetchall()
        
    matches = []
    for row in rows:
        match_record = dict(row)
        # Determine the target user's ID
        matched_id = match_record["user2_id"] if match_record["user1_id"] == user_id else match_record["user1_id"]
        matches.append({
            "match_id": match_record["id"],
            "matched_user_id": matched_id,
            "timestamp": str(match_record["timestamp"])
        })
    return matches
