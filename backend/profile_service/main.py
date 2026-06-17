import os
import json
import hashlib
import sqlite3
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException, status, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from profile_service.database import (
    init_db,
    get_db_conn,
    create_user as db_create_user,
    get_user_by_email,
    get_user_by_id,
    get_profile_by_user_id,
    create_or_update_profile,
    add_project,
    get_all_profiles
)
from profile_service.schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    ProfileCreate,
    ProfileResponse,
    ProjectCreate,
    ProjectResponse,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema and seeds
    init_db()
    yield

app = FastAPI(
    title="Zinder Profile Service",
    description="Microservice managing user registration, profiles, and project help requests.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def hash_password(password: str) -> str:
    """Hash user passwords using SHA-256 for local development security."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def fetch_profile_by_user_id_or_default(user_id: int) -> ProfileResponse:
    """Helper to fetch profile with nested user details, returning a default empty profile if not yet created."""
    user_record = get_user_by_id(user_id)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    
    profile_record = get_profile_by_user_id(user_id)
    
    user_data = UserResponse(
        id=user_record["id"],
        email=user_record["email"],
        name=user_record["name"]
    )
    
    if not profile_record:
        return ProfileResponse(
            user_id=user_id,
            user=user_data,
            age=None,
            distance=None,
            bio=None,
            image=None,
            interests=[],
            looking_for=None,
            radius_limit=None
        )
        
    return ProfileResponse(
        user_id=profile_record["user_id"],
        user=user_data,
        age=profile_record["age"],
        distance=profile_record["distance"],
        bio=profile_record["bio"],
        image=profile_record["image"],
        interests=profile_record["interests"],
        looking_for=profile_record["looking_for"],
        radius_limit=profile_record["radius_limit"]
    )

# ==========================================
# USER ENDPOINTS
# ==========================================

@app.post("/api/v1/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserRegister):
    """Creates a new user record."""
    password_hash = hash_password(user.password)
    try:
        user_id = db_create_user(
            email=user.email.lower().strip(),
            password_hash=password_hash,
            name=user.name.strip()
        )
        return UserResponse(id=user_id, email=user.email.lower().strip(), name=user.name.strip())
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered."
        )

@app.post("/api/v1/users/verify", response_model=UserResponse)
def verify_user(credentials: UserLogin):
    """Verifies user credentials. Returns user info if valid, else 401."""
    user_record = get_user_by_email(credentials.email)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    stored_hash = user_record["password_hash"]
    input_hash = hash_password(credentials.password)
    if stored_hash != input_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    return UserResponse(
        id=user_record["id"],
        email=user_record["email"],
        name=user_record["name"]
    )

# ==========================================
# PROFILE ENDPOINTS
# ==========================================

@app.get("/api/v1/profiles/me", response_model=ProfileResponse)
def get_my_profile(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Retrieves authenticated user's own profile based on X-User-Id header."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-User-Id header."
        )
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-User-Id header format."
        )
    return fetch_profile_by_user_id_or_default(user_id)

@app.get("/api/v1/profiles", response_model=List[ProfileResponse])
def get_profiles_endpoint():
    """Retrieves all user profiles in the system (used for Matcher Service discovery)."""
    raw_profiles = get_all_profiles()
    profiles_list = []
    for raw in raw_profiles:
        # Construct UserResponse model
        user_data = UserResponse(
            id=raw["user_id"],
            email=raw["email"],
            name=raw["name"]
        )
        
        # Build ProfileResponse
        profiles_list.append(
            ProfileResponse(
                user_id=raw["user_id"],
                user=user_data,
                age=raw["age"],
                distance=raw["distance"],
                bio=raw["bio"],
                image=raw["image"],
                interests=raw["interests"],
                looking_for=raw["looking_for"],
                radius_limit=raw["radius_limit"]
            )
        )
    return profiles_list

@app.get("/api/v1/profiles/{user_id}", response_model=ProfileResponse)
def get_profile_by_id_endpoint(user_id: int):
    """Retrieves profile details for a given user ID."""
    return fetch_profile_by_user_id_or_default(user_id)

@app.post("/api/v1/profiles", response_model=ProfileResponse)
def manage_profile(
    profile: ProfileCreate,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    """Creates or updates profile details for a user."""
    # Resolve user_id from header or body
    user_id = None
    if x_user_id:
        try:
            user_id = int(x_user_id)
        except ValueError:
            pass
    if user_id is None:
        user_id = profile.user_id
        
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing user identity (X-User-Id header or user_id in body required)."
        )
    
    # Check that user exists
    user_record = get_user_by_id(user_id)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Cannot manage profile for a non-existent user."
        )
    
    try:
        create_or_update_profile(
            user_id=user_id,
            age=profile.age,
            distance=profile.distance,
            bio=profile.bio,
            image=profile.image,
            interests=profile.interests,
            looking_for=profile.looking_for,
            radius_limit=profile.radius_limit
        )
        return fetch_profile_by_user_id_or_default(user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save profile: {e}"
        )

# ==========================================
# PROJECT HELP REQUEST ENDPOINTS
# ==========================================

@app.get("/api/v1/projects", response_model=List[ProjectResponse])
def get_projects():
    """Retrieves all project help requests sorted by timestamp descending, including poster's user_name."""
    with get_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT p.id, p.user_id, u.name AS user_name, p.title, p.description, p.tech_stack, p.timestamp
            FROM projects p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.timestamp DESC;
            """
        )
        rows = cursor.fetchall()
        
    projects = []
    for row in rows:
        tech_str = row["tech_stack"]
        try:
            tech_stack = json.loads(tech_str) if tech_str else []
        except Exception:
            tech_stack = []
            
        projects.append(
            ProjectResponse(
                id=row["id"],
                user_id=row["user_id"],
                user_name=row["user_name"],
                title=row["title"],
                description=row["description"],
                tech_stack=tech_stack,
                timestamp=str(row["timestamp"])
            )
        )
    return projects

@app.post("/api/v1/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    """Submits a new project help request."""
    # Resolve user_id from header or body
    user_id = None
    if x_user_id:
        try:
            user_id = int(x_user_id)
        except ValueError:
            pass
    if user_id is None:
        user_id = project.user_id
        
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing user identity (X-User-Id header or user_id in body required)."
        )
        
    # Check that user exists
    user_record = get_user_by_id(user_id)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Cannot post project request for a non-existent user."
        )
        
    try:
        project_id = add_project(
            user_id=user_id,
            title=project.title,
            description=project.description,
            tech_stack=project.tech_stack
        )
        
        # Retrieve the newly inserted project record including user name
        with get_db_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT p.id, p.user_id, u.name AS user_name, p.title, p.description, p.tech_stack, p.timestamp
                FROM projects p
                JOIN users u ON p.user_id = u.id
                WHERE p.id = ?;
                """,
                (project_id,)
            )
            row = cursor.fetchone()
            
        if not row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve project after creation."
            )
            
        tech_str = row["tech_stack"]
        try:
            tech_stack = json.loads(tech_str) if tech_str else []
        except Exception:
            tech_stack = []
            
        return ProjectResponse(
            id=row["id"],
            user_id=row["user_id"],
            user_name=row["user_name"],
            title=row["title"],
            description=row["description"],
            tech_stack=tech_stack,
            timestamp=str(row["timestamp"])
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit project helper request: {e}"
        )

if __name__ == "__main__":
    uvicorn.run("profile_service.main:app", host="0.0.0.0", port=8081, reload=True)
