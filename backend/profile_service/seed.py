"""Idempotent demo seed data for profiles + Project Help.

Safe to re-run: users upserted by email, projects by (owner email, title),
interested/comments inserted only when missing.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

from shared.security import hash_password

SEED_PASSWORD = "password123"

# Bay Area-ish coords with small spreads for nearby sort
_SF = (37.7749, -122.4194)

# Discover filter tags the FE / product surface uses, plus a few extras.
ALL_STACK_TAGS = [
    "Python",
    "Redis",
    "FastAPI",
    "React",
    "Node.js",
    "Rust",
    "TypeScript",
    "WebSockets",
    "Monaco Editor",
    "Go",
    "Docker",
    "GraphQL",
]


def _hours_ago(hours: float) -> str:
    ts = datetime.now(timezone.utc) - timedelta(hours=hours)
    return ts.strftime("%Y-%m-%d %H:%M:%S")


def _avatar(seed: str) -> str:
    # Varied images without shipping dozens of local assets.
    return f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed}"


# (email, name, age, bio, interests, looking_for, radius_km, lat_off, lng_off, hours_ago, image_seed)
SEED_DEVELOPERS: List[Tuple[Any, ...]] = [
    (
        "alice@zinder.internal",
        "Alice Smith",
        25,
        "Frontend wizard looking for a backend buddy to build scaling systems.",
        ["React", "CSS", "UI/UX", "Vite", "TypeScript"],
        "Backend Partner",
        10,
        0.0,
        0.0,
        1,
        "alice",
    ),
    (
        "bob@zinder.internal",
        "Bob Johnson",
        30,
        "Rustacean and systems engineer. I like building compilers and database engines.",
        ["Rust", "Systems", "Compilers", "Databases", "Monaco Editor"],
        "Frontend Developer",
        15,
        0.01,
        0.01,
        5,
        "bob",
    ),
    (
        "cara@zinder.internal",
        "Cara Nguyen",
        27,
        "Full-stack Pythonist shipping FastAPI services and Redis-backed queues.",
        ["Python", "FastAPI", "Redis", "Docker"],
        "Frontend Partner",
        25,
        0.02,
        -0.01,
        0.5,
        "cara",
    ),
    (
        "devon@zinder.internal",
        "Devon Park",
        29,
        "React + TypeScript specialist. Obsessed with accessible design systems.",
        ["React", "TypeScript", "CSS", "GraphQL"],
        "Backend Partner",
        20,
        -0.015,
        0.02,
        3,
        "devon",
    ),
    (
        "elena@zinder.internal",
        "Elena Vasquez",
        32,
        "Node.js realtime engineer. WebSockets, Redis pub/sub, and backpressure.",
        ["Node.js", "WebSockets", "Redis", "TypeScript"],
        "Systems Engineer",
        40,
        0.03,
        0.015,
        8,
        "elena",
    ),
    (
        "farid@zinder.internal",
        "Farid Hassan",
        26,
        "Go services, Dockerized deploys, and GraphQL gateways for product teams.",
        ["Go", "Docker", "GraphQL", "PostgreSQL"],
        "Frontend Developer",
        30,
        -0.02,
        -0.02,
        12,
        "farid",
    ),
    (
        "gia@zinder.internal",
        "Gia Romano",
        24,
        "Editor tooling nerd — Monaco Editor, TypeScript language services, LSP.",
        ["Monaco Editor", "TypeScript", "React", "Node.js"],
        "Language Tools Partner",
        18,
        0.025,
        -0.03,
        2,
        "gia",
    ),
    (
        "hiro@zinder.internal",
        "Hiro Tanaka",
        34,
        "Rust performance work and WebAssembly bridges into React apps.",
        ["Rust", "WebAssembly", "React", "Docker"],
        "Product Engineer",
        50,
        -0.03,
        0.025,
        20,
        "hiro",
    ),
    (
        "isla@zinder.internal",
        "Isla Brooks",
        28,
        "Python data APIs with FastAPI, Redis caching, and clean OpenAPI docs.",
        ["Python", "FastAPI", "Redis", "GraphQL"],
        "Frontend Partner",
        22,
        0.04,
        0.01,
        6,
        "isla",
    ),
    (
        "jules@zinder.internal",
        "Jules Okonkwo",
        31,
        "Node.js platform engineer. Event-driven services and WebSockets at scale.",
        ["Node.js", "TypeScript", "WebSockets", "Docker"],
        "Backend Partner",
        35,
        -0.01,
        0.035,
        14,
        "jules",
    ),
    (
        "kai@zinder.internal",
        "Kai Lindström",
        23,
        "Junior-friendly mentor energy. React, TypeScript, and learning Rust.",
        ["React", "TypeScript", "Rust", "CSS"],
        "Mentor / Pair",
        12,
        0.015,
        -0.015,
        0.25,
        "kai",
    ),
    (
        "lena@zinder.internal",
        "Lena Cho",
        33,
        "GraphQL schema design, Go microservices, and Docker Compose for local DX.",
        ["GraphQL", "Go", "Docker", "PostgreSQL"],
        "API Partner",
        45,
        -0.04,
        -0.01,
        28,
        "lena",
    ),
    (
        "miles@zinder.internal",
        "Miles Barrett",
        36,
        "Infra-minded: Redis, Docker, FastAPI health checks, and boring reliability.",
        ["Redis", "Docker", "Python", "FastAPI"],
        "SRE / Backend",
        60,
        0.05,
        0.02,
        36,
        "miles",
    ),
    (
        "nina@zinder.internal",
        "Nina Okada",
        27,
        "Realtime collab UIs — React, WebSockets, and Monaco Editor multiplayer cursors.",
        ["React", "WebSockets", "Monaco Editor", "TypeScript"],
        "Realtime Partner",
        16,
        -0.025,
        0.04,
        4,
        "nina",
    ),
    (
        "omar@zinder.internal",
        "Omar Rahman",
        29,
        "Rust + Go for networking tooling. Happy to pair on CLI UX too.",
        ["Rust", "Go", "Docker", "Systems"],
        "Frontend Developer",
        28,
        0.018,
        -0.028,
        48,
        "omar",
    ),
    (
        "priya@zinder.internal",
        "Priya Desai",
        30,
        "TypeScript full-stack. Node.js APIs, React dashboards, GraphQL clients.",
        ["TypeScript", "Node.js", "React", "GraphQL"],
        "Backend Partner",
        20,
        -0.035,
        0.018,
        9,
        "priya",
    ),
    (
        "quinn@zinder.internal",
        "Quinn Avery",
        22,
        "Hackathon regular. Python scripts, FastAPI prototypes, Redis for session caches.",
        ["Python", "FastAPI", "Redis", "React"],
        "Hackathon Teammate",
        8,
        0.008,
        0.008,
        1.5,
        "quinn",
    ),
    (
        "rina@zinder.internal",
        "Rina Patel",
        35,
        "Staff-level Node.js. WebSockets fan-out, Redis streams, careful backpressure.",
        ["Node.js", "WebSockets", "Redis", "Docker"],
        "Platform Engineer",
        55,
        0.06,
        -0.04,
        72,
        "rina",
    ),
    (
        "samir@zinder.internal",
        "Samir Ali",
        28,
        "Monaco Editor plugins and TypeScript tooling for in-browser IDEs.",
        ["Monaco Editor", "TypeScript", "Node.js", "React"],
        "Editor Partner",
        14,
        -0.012,
        -0.035,
        7,
        "samir",
    ),
    (
        "tess@zinder.internal",
        "Tess Moreno",
        26,
        "Go + GraphQL APIs with Dockerized CI. Looking for a React counterpart.",
        ["Go", "GraphQL", "Docker", "TypeScript"],
        "Frontend Developer",
        32,
        0.022,
        0.03,
        18,
        "tess",
    ),
    (
        "uma@zinder.internal",
        "Uma Sharma",
        31,
        "Python ML-adjacent APIs — FastAPI, Redis job queues, clear error contracts.",
        ["Python", "FastAPI", "Redis", "Docker"],
        "Product Engineer",
        24,
        -0.045,
        0.012,
        11,
        "uma",
    ),
    (
        "vito@zinder.internal",
        "Vito Costa",
        38,
        "Legacy-to-modern migrations. Rust cores wrapped in Node.js and React shells.",
        ["Rust", "Node.js", "React", "TypeScript"],
        "Migration Partner",
        70,
        0.07,
        0.05,
        96,
        "vito",
    ),
]


# Stable seed projects: keyed by (owner_email, title)
# interested_emails: who marked interest (only applied while pending or before status bump)
# comments: list of (author_email, body)
# status + helper_email for non-pending
SEED_PROJECTS: List[Dict[str, Any]] = [
    {
        "owner": "alice@zinder.internal",
        "title": "Need help scaling WebSockets",
        "description": (
            "URGENT production issue: React frontend needs horizontal scaling for "
            "WebSocket connections. Looking for Redis pub/sub guidance ASAP."
        ),
        "tech_stack": ["WebSockets", "React", "Node.js", "Redis"],
        "status": "pending",
        "helper": None,
        "interested": ["elena@zinder.internal", "jules@zinder.internal", "rina@zinder.internal"],
        "comments": [
            (
                "alice@zinder.internal",
                "We're seeing fan-out lag above ~2k concurrent sockets. Current plan is Redis pub/sub.",
            ),
            (
                "elena@zinder.internal",
                "Happy to help. Have you measured sticky sessions vs a shared Redis channel?",
            ),
            (
                "jules@zinder.internal",
                "I can sketch a Node.js adapter + backpressure notes this week.",
            ),
        ],
    },
    {
        "owner": "bob@zinder.internal",
        "title": "Building a custom compiler in Rust",
        "description": (
            "I am building a toy compiler in Rust and need help with Monaco Editor "
            "syntax highlighting. Stuck on tokenizer sync."
        ),
        "tech_stack": ["Rust", "Monaco Editor", "TypeScript"],
        "status": "pending",
        "helper": None,
        "interested": ["gia@zinder.internal", "samir@zinder.internal"],
        "comments": [
            (
                "bob@zinder.internal",
                "Monaco tokenization is drifting from the Rust lexer. Looking for a paired approach.",
            ),
            (
                "gia@zinder.internal",
                "We can drive the editor from the same AST walker — I have a similar LSP bridge.",
            ),
        ],
    },
    {
        "owner": "cara@zinder.internal",
        "title": "FastAPI + Redis cache invalidation",
        "description": (
            "Critical: cache stampedes after deploys. Need a FastAPI middleware pattern "
            "with Redis and request coalescing."
        ),
        "tech_stack": ["Python", "FastAPI", "Redis", "Docker"],
        "status": "accepted",
        "helper": "miles@zinder.internal",
        "interested": ["miles@zinder.internal", "isla@zinder.internal", "uma@zinder.internal"],
        "comments": [
            (
                "cara@zinder.internal",
                "Invalidation races show up under load tests. Prefer boring, proven patterns.",
            ),
            (
                "miles@zinder.internal",
                "Accepted — I'll propose a singleflight wrapper + TTL jitter tomorrow.",
            ),
            (
                "isla@zinder.internal",
                "Also consider stale-while-revalidate headers for the read path.",
            ),
        ],
    },
    {
        "owner": "devon@zinder.internal",
        "title": "GraphQL client cache with React",
        "description": "Help needed designing normalized GraphQL cache updates for a React dashboard.",
        "tech_stack": ["React", "TypeScript", "GraphQL"],
        "status": "in_progress",
        "helper": "priya@zinder.internal",
        "interested": ["priya@zinder.internal", "lena@zinder.internal"],
        "comments": [],
    },
    {
        "owner": "elena@zinder.internal",
        "title": "Dockerize Node.js WebSocket gateway",
        "description": "This week we need a Docker Compose setup for a Node.js WebSocket gateway + Redis.",
        "tech_stack": ["Docker", "Node.js", "WebSockets", "Redis"],
        "status": "pending",
        "helper": None,
        "interested": [],
        "comments": [],
    },
    {
        "owner": "farid@zinder.internal",
        "title": "Go GraphQL gateway auth hooks",
        "description": "Looking for someone to review JWT middleware on a Go GraphQL gateway.",
        "tech_stack": ["Go", "GraphQL", "Docker"],
        "status": "completed",
        "helper": "tess@zinder.internal",
        "interested": ["tess@zinder.internal", "lena@zinder.internal"],
        "comments": [
            (
                "farid@zinder.internal",
                "Auth hooks landed — thanks Tess. Closing this out as completed.",
            ),
            (
                "tess@zinder.internal",
                "Ship it. Follow-up: rotate signing keys via env, not baked secrets.",
            ),
        ],
    },
    {
        "owner": "gia@zinder.internal",
        "title": "Monaco multiplayer cursors",
        "description": (
            "ASAP blocker: multiplayer cursors in Monaco Editor over WebSockets are dropping "
            "on reconnect."
        ),
        "tech_stack": ["Monaco Editor", "WebSockets", "TypeScript", "React"],
        "status": "pending",
        "helper": None,
        "interested": ["nina@zinder.internal"],
        "comments": [],
    },
    {
        "owner": "hiro@zinder.internal",
        "title": "Rust WASM bridge into React",
        "description": "Need a clean pattern to call Rust WASM from a React/TypeScript UI soon.",
        "tech_stack": ["Rust", "React", "TypeScript", "Docker"],
        "status": "accepted",
        "helper": "vito@zinder.internal",
        "interested": ["vito@zinder.internal", "kai@zinder.internal"],
        "comments": [],
    },
    {
        "owner": "isla@zinder.internal",
        "title": "Python worker pool with Redis streams",
        "description": "Designing a FastAPI + Redis streams worker for async jobs. Looking for a pair.",
        "tech_stack": ["Python", "FastAPI", "Redis"],
        "status": "pending",
        "helper": None,
        "interested": ["quinn@zinder.internal", "uma@zinder.internal", "cara@zinder.internal"],
        "comments": [
            (
                "isla@zinder.internal",
                "Want consumer groups with at-least-once delivery and dead-letter handling.",
            ),
        ],
    },
    {
        "owner": "jules@zinder.internal",
        "title": "TypeScript SDK for internal APIs",
        "description": "Low urgency: generate a typed SDK from OpenAPI for Node.js and React clients.",
        "tech_stack": ["TypeScript", "Node.js", "React"],
        "status": "pending",
        "helper": None,
        "interested": [],
        "comments": [],
    },
    {
        "owner": "kai@zinder.internal",
        "title": "First Rust PR review",
        "description": "Stuck on ownership errors in a small Rust CLI. Mentorship appreciated.",
        "tech_stack": ["Rust", "CLI"],
        "status": "in_progress",
        "helper": "omar@zinder.internal",
        "interested": ["omar@zinder.internal", "bob@zinder.internal"],
        "comments": [
            (
                "kai@zinder.internal",
                "Compiler keeps yelling about moving a String into a loop. Minimal repro attached conceptually.",
            ),
            (
                "omar@zinder.internal",
                "In progress — we'll walk through borrow scopes and when to clone vs reference.",
            ),
        ],
    },
    {
        "owner": "lena@zinder.internal",
        "title": "GraphQL federation local Docker stack",
        "description": "Help needed assembling a Docker Compose GraphQL federation sandbox.",
        "tech_stack": ["GraphQL", "Docker", "Go"],
        "status": "pending",
        "helper": None,
        "interested": ["farid@zinder.internal"],
        "comments": [],
    },
    {
        "owner": "miles@zinder.internal",
        "title": "Redis latency spike investigation",
        "description": (
            "Production Redis p99 spiked after a deploy. Critical — need another set of eyes "
            "on slowlog + client buffering."
        ),
        "tech_stack": ["Redis", "Python", "Docker"],
        "status": "completed",
        "helper": "rina@zinder.internal",
        "interested": ["rina@zinder.internal", "elena@zinder.internal"],
        "comments": [
            (
                "miles@zinder.internal",
                "Root cause was large KEYS usage in a health script. Replaced with SCAN.",
            ),
        ],
    },
    {
        "owner": "nina@zinder.internal",
        "title": "React realtime presence UI",
        "description": "Building presence indicators over WebSockets. Looking for UX + protocol feedback.",
        "tech_stack": ["React", "WebSockets", "TypeScript"],
        "status": "pending",
        "helper": None,
        "interested": ["devon@zinder.internal", "elena@zinder.internal"],
        "comments": [],
    },
    {
        "owner": "priya@zinder.internal",
        "title": "Node.js GraphQL dataloader patterns",
        "description": "Soon shipping batching — need a review of dataloader usage in Node.js/GraphQL.",
        "tech_stack": ["Node.js", "GraphQL", "TypeScript"],
        "status": "accepted",
        "helper": "tess@zinder.internal",
        "interested": ["tess@zinder.internal"],
        "comments": [],
    },
]


def _get_user_id(cursor: sqlite3.Cursor, email: str) -> Optional[int]:
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email.strip().lower(),))
    row = cursor.fetchone()
    return int(row["id"]) if row else None


def _upsert_user(cursor: sqlite3.Cursor, email: str, password_hash: str, name: str) -> int:
    email_n = email.strip().lower()
    existing = _get_user_id(cursor, email_n)
    if existing is not None:
        # Keep existing password_hash so re-seed does not re-bcrypt every boot.
        cursor.execute(
            "UPDATE users SET name = ? WHERE id = ?",
            (name.strip(), existing),
        )
        return existing
    cursor.execute(
        "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
        (email_n, password_hash, name.strip()),
    )
    return int(cursor.lastrowid)


def _upsert_profile(
    cursor: sqlite3.Cursor,
    user_id: int,
    *,
    age: int,
    bio: str,
    image: str,
    interests: Sequence[str],
    looking_for: str,
    radius_limit: int,
    lat: float,
    lng: float,
    last_active_at: str,
) -> None:
    miles = max(1, int(round(radius_limit * 0.621371 / 2)))
    distance = f"{miles} miles away"
    interests_json = json.dumps(list(interests))
    cursor.execute("SELECT user_id FROM profiles WHERE user_id = ?", (user_id,))
    if cursor.fetchone():
        cursor.execute(
            """
            UPDATE profiles SET
                age = ?, distance = ?, bio = ?, image = ?, interests = ?,
                looking_for = ?, radius_limit = ?, lat = ?, lng = ?,
                last_active_at = ?
            WHERE user_id = ?
            """,
            (
                age,
                distance,
                bio,
                image,
                interests_json,
                looking_for,
                radius_limit,
                lat,
                lng,
                last_active_at,
                user_id,
            ),
        )
    else:
        cursor.execute(
            """
            INSERT INTO profiles (
                user_id, age, distance, bio, image, interests, looking_for,
                radius_limit, lat, lng, last_active_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                last_active_at,
            ),
        )


def _get_project_id(cursor: sqlite3.Cursor, owner_id: int, title: str) -> Optional[int]:
    cursor.execute(
        "SELECT id FROM projects WHERE user_id = ? AND title = ?",
        (owner_id, title),
    )
    row = cursor.fetchone()
    return int(row["id"]) if row else None


def _upsert_project(
    cursor: sqlite3.Cursor,
    owner_id: int,
    *,
    title: str,
    description: str,
    tech_stack: Sequence[str],
    status: str,
    helper_user_id: Optional[int],
) -> int:
    tech_json = json.dumps(list(tech_stack))
    existing = _get_project_id(cursor, owner_id, title)
    if existing is not None:
        cursor.execute(
            """
            UPDATE projects SET
                description = ?, tech_stack = ?, status = ?, helper_user_id = ?
            WHERE id = ?
            """,
            (description, tech_json, status, helper_user_id, existing),
        )
        return existing
    cursor.execute(
        """
        INSERT INTO projects (user_id, title, description, tech_stack, status, helper_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (owner_id, title, description, tech_json, status, helper_user_id),
    )
    return int(cursor.lastrowid)


def _ensure_interested(
    cursor: sqlite3.Cursor, project_id: int, user_id: int, note: Optional[str] = None
) -> None:
    cursor.execute(
        """
        INSERT OR IGNORE INTO project_interested (project_id, user_id, note)
        VALUES (?, ?, ?)
        """,
        (project_id, user_id, note),
    )


def _ensure_comment(
    cursor: sqlite3.Cursor, project_id: int, user_id: int, body: str
) -> None:
    cursor.execute(
        """
        SELECT 1 FROM project_comments
        WHERE project_id = ? AND user_id = ? AND body = ?
        LIMIT 1
        """,
        (project_id, user_id, body),
    )
    if cursor.fetchone():
        return
    cursor.execute(
        """
        INSERT INTO project_comments (project_id, user_id, body)
        VALUES (?, ?, ?)
        """,
        (project_id, user_id, body),
    )


def seed_demo_data(conn: sqlite3.Connection) -> Dict[str, int]:
    """Upsert demo developers + Project Help rows. Returns simple counts."""
    cursor = conn.cursor()
    pass_hash = hash_password(SEED_PASSWORD)
    email_to_id: Dict[str, int] = {}

    for (
        email,
        name,
        age,
        bio,
        interests,
        looking_for,
        radius,
        lat_off,
        lng_off,
        hours,
        image_seed,
    ) in SEED_DEVELOPERS:
        uid = _upsert_user(cursor, email, pass_hash, name)
        email_to_id[email.lower()] = uid
        lat = _SF[0] + float(lat_off)
        lng = _SF[1] + float(lng_off)
        _upsert_profile(
            cursor,
            uid,
            age=int(age),
            bio=str(bio),
            image=_avatar(str(image_seed)),
            interests=list(interests),
            looking_for=str(looking_for),
            radius_limit=int(radius),
            lat=lat,
            lng=lng,
            last_active_at=_hours_ago(float(hours)),
        )

    project_count = 0
    comment_count = 0
    interested_count = 0
    for proj in SEED_PROJECTS:
        owner_id = email_to_id.get(proj["owner"].lower()) or _get_user_id(cursor, proj["owner"])
        if owner_id is None:
            continue
        helper_id = None
        if proj.get("helper"):
            helper_id = email_to_id.get(proj["helper"].lower()) or _get_user_id(
                cursor, proj["helper"]
            )
        pid = _upsert_project(
            cursor,
            owner_id,
            title=proj["title"],
            description=proj["description"],
            tech_stack=proj["tech_stack"],
            status=proj["status"],
            helper_user_id=helper_id,
        )
        project_count += 1
        for iemail in proj.get("interested") or []:
            iid = email_to_id.get(iemail.lower()) or _get_user_id(cursor, iemail)
            if iid is None or iid == owner_id:
                continue
            _ensure_interested(cursor, pid, iid, note="Seed interest")
            interested_count += 1
        for cemail, body in proj.get("comments") or []:
            cid = email_to_id.get(cemail.lower()) or _get_user_id(cursor, cemail)
            if cid is None:
                continue
            _ensure_comment(cursor, pid, cid, body)
            comment_count += 1

    conn.commit()
    return {
        "developers": len(SEED_DEVELOPERS),
        "projects": project_count,
        "interested_rows": interested_count,
        "comments": comment_count,
        "stack_tags_covered": len(ALL_STACK_TAGS),
    }
