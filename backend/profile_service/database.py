import os
import sqlite3
import json
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional

# The local SQLite database path for Profile Service
DB_PATH = "/Users/jaipandey/Desktop/projects/zinder/backend/data/profile.db"

@contextmanager
def get_db_conn() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager to safely obtain a database connection to the SQLite database.
    Ensures that the parent directories exist and SQLite foreign keys are enabled.
    """
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    # Enable SQLite foreign key constraints (disabled by default in SQLite)
    conn.execute("PRAGMA foreign_keys = ON;")
    # Allow row access by column names as dictionaries
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """
    Initialize the database tables if they do not exist.
    Created tables:
    1. users: id, email, password_hash, name
    2. profiles: user_id (UNIQUE FK), age, distance, bio, image, interests (JSON), looking_for, radius_limit
    3. projects: id, user_id (FK), title, description, tech_stack (JSON), timestamp
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL
            );
        """)
        
        # Create profiles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                user_id INTEGER UNIQUE NOT NULL,
                age INTEGER,
                distance TEXT,
                bio TEXT,
                image TEXT,
                interests TEXT, -- Stores JSON list of interests
                looking_for TEXT,
                radius_limit INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)
        
        # Create projects table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                tech_stack TEXT NOT NULL, -- Stores JSON list of technologies
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)
        
        conn.commit()

        # Seed the database if no users exist
        cursor.execute("SELECT COUNT(*) FROM users;")
        count = cursor.fetchone()[0]
        if count == 0:
            import hashlib
            pass_hash = hashlib.sha256(b"password123").hexdigest()
            
            # Seed Alice
            cursor.execute(
                "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?);",
                ("alice@zinder.internal", pass_hash, "Alice Smith")
            )
            alice_id = cursor.lastrowid
            
            cursor.execute(
                """
                INSERT INTO profiles (user_id, age, distance, bio, image, interests, looking_for, radius_limit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    alice_id,
                    25,
                    "3 miles away",
                    "Frontend wizard looking for a backend buddy to build scaling systems.",
                    "/profile_alice.png",
                    json.dumps(["React", "CSS", "UI/UX", "Vite"]),
                    "Backend Partner",
                    10
                )
            )
            
            cursor.execute(
                """
                INSERT INTO projects (user_id, title, description, tech_stack)
                VALUES (?, ?, ?, ?);
                """,
                (
                    alice_id,
                    "Need help scaling WebSockets",
                    "I have a React frontend and need help designing the horizontal scaling for WebSocket connections.",
                    json.dumps(["WebSockets", "React", "Node.js"])
                )
            )
            
            # Seed Bob
            cursor.execute(
                "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?);",
                ("bob@zinder.internal", pass_hash, "Bob Johnson")
            )
            bob_id = cursor.lastrowid
            
            cursor.execute(
                """
                INSERT INTO profiles (user_id, age, distance, bio, image, interests, looking_for, radius_limit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    bob_id,
                    30,
                    "5 miles away",
                    "Rustacean and systems engineer. I like building compilers and database engines.",
                    "/profile_bob.png",
                    json.dumps(["Rust", "Systems", "Compilers", "Databases"]),
                    "Frontend Developer",
                    15
                )
            )
            
            cursor.execute(
                """
                INSERT INTO projects (user_id, title, description, tech_stack)
                VALUES (?, ?, ?, ?);
                """,
                (
                    bob_id,
                    "Building a custom compiler in Rust",
                    "I am building a toy compiler in Rust and need someone to help build the Monaco editor syntax highlighting.",
                    json.dumps(["Rust", "Monaco Editor", "TypeScript"])
                )
            )
            
            conn.commit()



# ==========================================
# CRUD HELPER FUNCTIONS
# ==========================================

# --- User Operations ---

def create_user(email: str, password_hash: str, name: str) -> int:
    """
    Inserts a new user record. Returns the generated user ID.
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
            (email.strip().lower(), password_hash, name.strip())
        )
        conn.commit()
        return cursor.lastrowid


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Retrieves user record by id.
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves user record by email (case-insensitive).
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email.strip().lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None


# --- Profile Operations ---

def get_profile_by_user_id(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Retrieves the profile of a user. The JSON string interests are parsed to a list.
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        profile = dict(row)
        if profile.get("interests"):
            try:
                profile["interests"] = json.loads(profile["interests"])
            except (json.JSONDecodeError, TypeError):
                profile["interests"] = []
        else:
            profile["interests"] = []
            
        return profile


def create_or_update_profile(
    user_id: int,
    age: Optional[int] = None,
    distance: Optional[str] = None,
    bio: Optional[str] = None,
    image: Optional[str] = None,
    interests: Optional[List[str]] = None,
    looking_for: Optional[str] = None,
    radius_limit: Optional[int] = None
) -> None:
    """
    Creates or updates the profile for a given user. Interests list is stored as a JSON string.
    """
    interests_json = json.dumps(interests if interests is not None else [])
    
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO profiles (user_id, age, distance, bio, image, interests, looking_for, radius_limit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                age = excluded.age,
                distance = excluded.distance,
                bio = excluded.bio,
                image = excluded.image,
                interests = excluded.interests,
                looking_for = excluded.looking_for,
                radius_limit = excluded.radius_limit
        """, (user_id, age, distance, bio, image, interests_json, looking_for, radius_limit))
        conn.commit()


# --- Project Operations ---

def add_project(user_id: int, title: str, description: str, tech_stack: List[str]) -> int:
    """
    Adds a new project associated with a user. The tech_stack is stored as a JSON string.
    Returns the generated project ID.
    """
    tech_stack_json = json.dumps(tech_stack if tech_stack is not None else [])
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO projects (user_id, title, description, tech_stack)
            VALUES (?, ?, ?, ?)
        """, (user_id, title.strip(), description.strip(), tech_stack_json))
        conn.commit()
        return cursor.lastrowid


def get_projects_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    """
    Retrieves all projects associated with a user, sorted by timestamp descending.
    The tech_stack is returned as a Python list.
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE user_id = ? ORDER BY timestamp DESC, id DESC", (user_id,))
        rows = cursor.fetchall()
        projects = []
        for row in rows:
            proj = dict(row)
            if proj.get("tech_stack"):
                try:
                    proj["tech_stack"] = json.loads(proj["tech_stack"])
                except (json.JSONDecodeError, TypeError):
                    proj["tech_stack"] = []
            else:
                proj["tech_stack"] = []
            projects.append(proj)
        return projects


def delete_project(project_id: int, user_id: int) -> bool:
    """
    Deletes a project by ID and user_id to ensure ownership before deletion.
    Returns True if deletion succeeded, False otherwise.
    """
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
