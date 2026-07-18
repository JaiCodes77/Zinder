import os
import sqlite3
import json
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.getenv("PROFILE_DB_PATH", os.path.join(_BACKEND_ROOT, "data", "profile.db"))


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


def _column_exists(cursor: sqlite3.Cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row["name"] == column for row in cursor.fetchall())


def _ensure_column(cursor: sqlite3.Cursor, table: str, column: str, ddl: str) -> None:
    if not _column_exists(cursor, table, column):
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db() -> None:
    with get_db_conn() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                user_id INTEGER UNIQUE NOT NULL,
                age INTEGER,
                distance TEXT,
                bio TEXT,
                image TEXT,
                interests TEXT,
                looking_for TEXT,
                radius_limit INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                tech_stack TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        # Additive migrations for existing SQLite files
        _ensure_column(cursor, "profiles", "lat", "lat REAL")
        _ensure_column(cursor, "profiles", "lng", "lng REAL")
        _ensure_column(cursor, "profiles", "last_active_at", "last_active_at DATETIME")
        _ensure_column(cursor, "projects", "status", "status TEXT NOT NULL DEFAULT 'pending'")
        _ensure_column(cursor, "projects", "helper_user_id", "helper_user_id INTEGER")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_interested (
                project_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                note TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (project_id, user_id),
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                body TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        conn.commit()

        # Idempotent demo seed (safe to re-run; upserts by email / project title).
        from profile_service.seed import seed_demo_data

        seed_demo_data(conn)


# --- User Operations ---

def create_user(email: str, password_hash: str, name: str) -> int:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
            (email.strip().lower(), password_hash, name.strip()),
        )
        conn.commit()
        return cursor.lastrowid


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM users WHERE LOWER(email) = ?",
            (email.strip().lower(),),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def update_password_hash(user_id: int, password_hash: str) -> None:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (password_hash, user_id),
        )
        conn.commit()


# --- Profile Operations ---

def _parse_interests(raw: Any) -> List[str]:
    if not raw:
        return []
    try:
        return json.loads(raw) if isinstance(raw, str) else list(raw)
    except (json.JSONDecodeError, TypeError):
        return []


def get_profile_by_user_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        profile = dict(row)
        profile["interests"] = _parse_interests(profile.get("interests"))
        return profile


def touch_last_active(user_id: int) -> None:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE profiles SET last_active_at = CURRENT_TIMESTAMP WHERE user_id = ?
            """,
            (user_id,),
        )
        if cursor.rowcount == 0:
            # Profile row may not exist yet — ignore
            pass
        conn.commit()


def create_or_update_profile(
    user_id: int,
    age: Optional[int] = None,
    distance: Optional[str] = None,
    bio: Optional[str] = None,
    image: Optional[str] = None,
    interests: Optional[List[str]] = None,
    looking_for: Optional[str] = None,
    radius_limit: Optional[int] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> None:
    interests_json = json.dumps(interests if interests is not None else [])

    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO profiles (
                user_id, age, distance, bio, image, interests, looking_for,
                radius_limit, lat, lng, last_active_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                age = excluded.age,
                distance = excluded.distance,
                bio = excluded.bio,
                image = excluded.image,
                interests = excluded.interests,
                looking_for = excluded.looking_for,
                radius_limit = excluded.radius_limit,
                lat = COALESCE(excluded.lat, profiles.lat),
                lng = COALESCE(excluded.lng, profiles.lng),
                last_active_at = CURRENT_TIMESTAMP
            """,
            (
                user_id,
                age,
                distance,
                bio,
                image,
                interests_json,
                looking_for,
                radius_limit,
                lat,
                lng,
            ),
        )
        conn.commit()


def get_all_profiles(include_email: bool = False) -> List[Dict[str, Any]]:
    """
    Retrieve all profiles. Email is omitted unless include_email=True
    (service-internal privileged callers only).
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        if include_email:
            cursor.execute(
                """
                SELECT u.id as user_id, u.email, u.name,
                       p.age, p.distance, p.bio, p.image, p.interests,
                       p.looking_for, p.radius_limit, p.lat, p.lng, p.last_active_at
                FROM users u
                LEFT JOIN profiles p ON u.id = p.user_id
                """
            )
        else:
            cursor.execute(
                """
                SELECT u.id as user_id, u.name,
                       p.age, p.distance, p.bio, p.image, p.interests,
                       p.looking_for, p.radius_limit, p.lat, p.lng, p.last_active_at
                FROM users u
                LEFT JOIN profiles p ON u.id = p.user_id
                """
            )
        rows = cursor.fetchall()

    profiles = []
    for row in rows:
        profile = dict(row)
        profile["interests"] = _parse_interests(profile.get("interests"))
        if not include_email:
            profile.pop("email", None)
        if profile.get("last_active_at") is not None:
            profile["last_active_at"] = str(profile["last_active_at"])
        profiles.append(profile)
    return profiles


# --- Project Operations ---

PROJECT_STATUSES = ("pending", "accepted", "in_progress", "completed", "cancelled")
FORWARD_TRANSITIONS = {
    "pending": {"accepted"},
    "accepted": {"in_progress"},
    "in_progress": {"completed"},
    "completed": set(),
    "cancelled": set(),
}


def add_project(user_id: int, title: str, description: str, tech_stack: List[str]) -> int:
    tech_stack_json = json.dumps(tech_stack if tech_stack is not None else [])
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO projects (user_id, title, description, tech_stack, status)
            VALUES (?, ?, ?, ?, 'pending')
            """,
            (user_id, title.strip(), description.strip(), tech_stack_json),
        )
        conn.commit()
        return cursor.lastrowid


def _parse_tech(raw: Any) -> List[str]:
    if not raw:
        return []
    try:
        return json.loads(raw) if isinstance(raw, str) else list(raw)
    except (json.JSONDecodeError, TypeError):
        return []


def get_project_row(project_id: int) -> Optional[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT p.id, p.user_id, u.name AS user_name, p.title, p.description,
                   p.tech_stack, p.timestamp, p.status, p.helper_user_id
            FROM projects p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
            """,
            (project_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        proj = dict(row)
        proj["tech_stack"] = _parse_tech(proj.get("tech_stack"))
        proj["timestamp"] = str(proj["timestamp"])
        proj["status"] = proj.get("status") or "pending"
        return proj


def list_projects() -> List[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT p.id, p.user_id, u.name AS user_name, p.title, p.description,
                   p.tech_stack, p.timestamp, p.status, p.helper_user_id
            FROM projects p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.timestamp DESC;
            """
        )
        rows = cursor.fetchall()
    projects = []
    for row in rows:
        proj = dict(row)
        proj["tech_stack"] = _parse_tech(proj.get("tech_stack"))
        proj["timestamp"] = str(proj["timestamp"])
        proj["status"] = proj.get("status") or "pending"
        projects.append(proj)
    return projects


def update_project_fields(
    project_id: int,
    actor_user_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    tech_stack: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Owner-only edit of title/description/tech while status is pending."""
    project = get_project_row(project_id)
    if not project:
        raise ValueError("Project not found.")
    if actor_user_id != project["user_id"]:
        raise ValueError("Only the project owner can edit.")
    if (project.get("status") or "pending") != "pending":
        raise ValueError("Only pending projects can be edited.")
    if title is None and description is None and tech_stack is None:
        raise ValueError("No fields to update.")

    next_title = title.strip() if title is not None else project["title"]
    next_desc = description.strip() if description is not None else project["description"]
    next_tech = tech_stack if tech_stack is not None else project.get("tech_stack") or []
    if not next_title or len(next_title) < 3:
        raise ValueError("Title needs at least 3 characters.")
    if not next_desc or len(next_desc) < 10:
        raise ValueError("Description needs at least 10 characters.")

    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE projects
            SET title = ?, description = ?, tech_stack = ?
            WHERE id = ?
            """,
            (next_title, next_desc, json.dumps(list(next_tech)), project_id),
        )
        conn.commit()

    updated = get_project_row(project_id)
    if not updated:
        raise ValueError("Project not found after update.")
    return updated


def update_project_status(
    project_id: int,
    new_status: str,
    actor_user_id: int,
    helper_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Enforce status transition rules.
    Returns updated project row or raises ValueError with a clear message.
    """
    project = get_project_row(project_id)
    if not project:
        raise ValueError("Project not found.")

    current = project["status"] or "pending"
    new_status = new_status.strip().lower()
    if new_status not in PROJECT_STATUSES:
        raise ValueError(f"Invalid status '{new_status}'.")

    is_owner = actor_user_id == project["user_id"]
    is_helper = (
        project.get("helper_user_id") is not None
        and actor_user_id == project["helper_user_id"]
    )

    if new_status == "cancelled":
        if not is_owner:
            raise ValueError("Only the project owner can cancel.")
        if current in ("completed", "cancelled"):
            raise ValueError(f"Cannot cancel a project in status '{current}'.")
    else:
        if not (is_owner or is_helper):
            raise ValueError("Only the owner or accepted helper can change status.")
        allowed = FORWARD_TRANSITIONS.get(current, set())
        if new_status not in allowed:
            raise ValueError(
                f"Invalid transition from '{current}' to '{new_status}'."
            )
        if new_status == "accepted":
            if not is_owner:
                raise ValueError("Only the project owner can accept a helper.")
            if helper_user_id is None:
                raise ValueError("helper_user_id is required when accepting.")
            interested = get_interested(project_id)
            if not any(i["user_id"] == helper_user_id for i in interested):
                raise ValueError("helper_user_id must be on the interested list.")

    with get_db_conn() as conn:
        cursor = conn.cursor()
        if new_status == "accepted":
            cursor.execute(
                """
                UPDATE projects
                SET status = ?, helper_user_id = ?
                WHERE id = ?
                """,
                (new_status, helper_user_id, project_id),
            )
        else:
            cursor.execute(
                "UPDATE projects SET status = ? WHERE id = ?",
                (new_status, project_id),
            )
        conn.commit()

    updated = get_project_row(project_id)
    if not updated:
        raise ValueError("Project not found after update.")
    return updated


def add_interested(project_id: int, user_id: int, note: Optional[str] = None) -> Dict[str, Any]:
    project = get_project_row(project_id)
    if not project:
        raise ValueError("Project not found.")
    if project["user_id"] == user_id:
        raise ValueError("Owner cannot mark interest on their own project.")
    if project["status"] != "pending":
        raise ValueError("Can only express interest while project is pending.")

    with get_db_conn() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO project_interested (project_id, user_id, note)
                VALUES (?, ?, ?)
                """,
                (project_id, user_id, note),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError("Already marked as interested.")

    return {
        "project_id": project_id,
        "user_id": user_id,
        "note": note,
        "created_at": _get_interested_created_at(project_id, user_id),
    }


def _get_interested_created_at(project_id: int, user_id: int) -> str:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT created_at FROM project_interested
            WHERE project_id = ? AND user_id = ?
            """,
            (project_id, user_id),
        )
        row = cursor.fetchone()
        return str(row["created_at"]) if row else ""


def remove_interested(project_id: int, user_id: int) -> bool:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            DELETE FROM project_interested
            WHERE project_id = ? AND user_id = ?
            """,
            (project_id, user_id),
        )
        conn.commit()
        return cursor.rowcount > 0


def get_interested(project_id: int) -> List[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT i.project_id, i.user_id, u.name AS user_name, i.note, i.created_at
            FROM project_interested i
            JOIN users u ON u.id = i.user_id
            WHERE i.project_id = ?
            ORDER BY i.created_at ASC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()
    return [
        {
            "project_id": r["project_id"],
            "user_id": r["user_id"],
            "user_name": r["user_name"],
            "note": r["note"],
            "created_at": str(r["created_at"]),
        }
        for r in rows
    ]


def add_comment(project_id: int, user_id: int, body: str) -> Dict[str, Any]:
    if not get_project_row(project_id):
        raise ValueError("Project not found.")
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO project_comments (project_id, user_id, body)
            VALUES (?, ?, ?)
            """,
            (project_id, user_id, body.strip()),
        )
        comment_id = cursor.lastrowid
        conn.commit()
        cursor.execute(
            """
            SELECT c.id, c.project_id, c.user_id, u.name AS user_name, c.body, c.created_at
            FROM project_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = ?
            """,
            (comment_id,),
        )
        row = cursor.fetchone()
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "user_id": row["user_id"],
        "user_name": row["user_name"],
        "body": row["body"],
        "created_at": str(row["created_at"]),
    }


def get_comments(project_id: int) -> List[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.id, c.project_id, c.user_id, u.name AS user_name, c.body, c.created_at
            FROM project_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.project_id = ?
            ORDER BY c.created_at ASC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()
    return [
        {
            "id": r["id"],
            "project_id": r["project_id"],
            "user_id": r["user_id"],
            "user_name": r["user_name"],
            "body": r["body"],
            "created_at": str(r["created_at"]),
        }
        for r in rows
    ]


def get_projects_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM projects
            WHERE user_id = ?
            ORDER BY timestamp DESC, id DESC
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        projects = []
        for row in rows:
            proj = dict(row)
            proj["tech_stack"] = _parse_tech(proj.get("tech_stack"))
            projects.append(proj)
        return projects


def delete_project(project_id: int, user_id: int) -> bool:
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        )
        conn.commit()
        return cursor.rowcount > 0
