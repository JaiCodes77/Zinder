import sqlite3
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from shared.internal_auth import require_internal_secret, require_internal_user
from shared.security import hash_password, verify_and_migrate
from profile_service.database import (
    init_db,
    create_user as db_create_user,
    get_user_by_email,
    get_user_by_id,
    get_profile_by_user_id,
    create_or_update_profile,
    add_project,
    get_all_profiles,
    update_password_hash,
    touch_last_active,
    list_projects,
    get_project_row,
    update_project_fields,
    update_project_status,
    add_interested,
    remove_interested,
    get_interested,
    add_comment,
    get_comments,
)
from profile_service.schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    ProfileCreate,
    ProfileResponse,
    PublicProfileResponse,
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetailResponse,
    ProjectStatusUpdate,
    InterestedCreate,
    InterestedResponse,
    CommentCreate,
    CommentResponse,
)


def _project_error_status(msg: str) -> int:
    """Map domain ValueErrors to HTTP codes — authZ → 403."""
    lower = msg.lower()
    if "not found" in lower:
        return status.HTTP_404_NOT_FOUND
    if lower.startswith("only the"):
        return status.HTTP_403_FORBIDDEN
    return status.HTTP_400_BAD_REQUEST


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Zinder Profile Service",
    description="Microservice managing user registration, profiles, and project help requests.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_profile_by_user_id_or_default(user_id: int) -> ProfileResponse:
    user_record = get_user_by_id(user_id)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    profile_record = get_profile_by_user_id(user_id)
    user_data = UserResponse(
        id=user_record["id"],
        email=user_record["email"],
        name=user_record["name"],
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
            radius_limit=None,
            lat=None,
            lng=None,
            last_active_at=None,
        )

    last_active = profile_record.get("last_active_at")
    return ProfileResponse(
        user_id=profile_record["user_id"],
        user=user_data,
        age=profile_record["age"],
        distance=profile_record["distance"],
        bio=profile_record["bio"],
        image=profile_record["image"],
        interests=profile_record["interests"],
        looking_for=profile_record["looking_for"],
        radius_limit=profile_record["radius_limit"],
        lat=profile_record.get("lat"),
        lng=profile_record.get("lng"),
        last_active_at=str(last_active) if last_active else None,
    )


def _to_public_profile(raw: dict) -> PublicProfileResponse:
    return PublicProfileResponse(
        user_id=raw["user_id"],
        name=raw["name"],
        age=raw.get("age"),
        distance=raw.get("distance"),
        bio=raw.get("bio"),
        image=raw.get("image"),
        interests=raw.get("interests") or [],
        looking_for=raw.get("looking_for"),
        radius_limit=raw.get("radius_limit"),
        lat=raw.get("lat"),
        lng=raw.get("lng"),
        last_active_at=raw.get("last_active_at"),
    )


def _to_project_response(row: dict) -> ProjectResponse:
    return ProjectResponse(
        id=row["id"],
        user_id=row["user_id"],
        user_name=row["user_name"],
        title=row["title"],
        description=row["description"],
        tech_stack=row["tech_stack"],
        timestamp=row["timestamp"],
        status=row.get("status") or "pending",
        helper_user_id=row.get("helper_user_id"),
    )


# ==========================================
# USER ENDPOINTS
# ==========================================

@app.post("/api/v1/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserRegister):
    password_hash = hash_password(user.password)
    try:
        user_id = db_create_user(
            email=user.email.lower().strip(),
            password_hash=password_hash,
            name=user.name.strip(),
        )
        return UserResponse(
            id=user_id,
            email=user.email.lower().strip(),
            name=user.name.strip(),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )


@app.post("/api/v1/users/verify", response_model=UserResponse)
def verify_user(credentials: UserLogin):
    """Verifies credentials; upgrades legacy SHA-256 hashes to bcrypt on success."""
    user_record = get_user_by_email(credentials.email)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    ok, new_hash = verify_and_migrate(credentials.password, user_record["password_hash"])
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if new_hash:
        update_password_hash(user_record["id"], new_hash)

    touch_last_active(user_record["id"])

    return UserResponse(
        id=user_record["id"],
        email=user_record["email"],
        name=user_record["name"],
    )


# ==========================================
# PROFILE ENDPOINTS
# ==========================================

@app.get("/api/v1/profiles/me", response_model=ProfileResponse)
def get_my_profile(user_id: int = Depends(require_internal_user)):
    touch_last_active(user_id)
    return fetch_profile_by_user_id_or_default(user_id)


@app.get("/api/v1/profiles", response_model=List[PublicProfileResponse])
def get_profiles_endpoint(user_id: int = Depends(require_internal_user)):
    """
    Authenticated, scoped profile listing for discovery (matcher).

    SECURITY: Requires X-Internal-Secret + X-User-Id. Never returns emails.
    Caller's own row is included; matcher filters it out.
    """
    touch_last_active(user_id)
    raw_profiles = get_all_profiles(include_email=False)
    return [_to_public_profile(raw) for raw in raw_profiles]


@app.get("/api/v1/profiles/{target_user_id}", response_model=ProfileResponse)
def get_profile_by_id_endpoint(
    target_user_id: int,
    user_id: int = Depends(require_internal_user),
):
    """
    Fetch a single profile. Email is only returned when viewing your own profile;
    otherwise email is redacted to an empty string in the nested user object.
    """
    profile = fetch_profile_by_user_id_or_default(target_user_id)
    if target_user_id != user_id:
        profile.user.email = ""
    return profile


@app.get("/api/v1/internal/profiles/{target_user_id}", response_model=ProfileResponse)
def get_profile_internal(
    target_user_id: int,
    _: None = Depends(require_internal_secret),
):
    """
    Privileged service-to-service profile fetch (includes email).
    Used only for gated seed/dev tooling — not exposed via the public gateway.
    """
    return fetch_profile_by_user_id_or_default(target_user_id)


@app.post("/api/v1/profiles", response_model=ProfileResponse)
def manage_profile(
    profile: ProfileCreate,
    user_id: int = Depends(require_internal_user),
):
    user_record = get_user_by_id(user_id)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Cannot manage profile for a non-existent user.",
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
            radius_limit=profile.radius_limit,
            lat=profile.lat,
            lng=profile.lng,
        )
        return fetch_profile_by_user_id_or_default(user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save profile: {e}",
        )


# ==========================================
# PROJECT HELP REQUEST ENDPOINTS
# ==========================================

@app.get("/api/v1/projects", response_model=List[ProjectResponse])
def get_projects(_: None = Depends(require_internal_secret)):
    return [_to_project_response(p) for p in list_projects()]


@app.post("/api/v1/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    user_id: int = Depends(require_internal_user),
):
    user_record = get_user_by_id(user_id)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Cannot post project request for a non-existent user.",
        )

    try:
        project_id = add_project(
            user_id=user_id,
            title=project.title,
            description=project.description,
            tech_stack=project.tech_stack,
        )
        row = get_project_row(project_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve project after creation.",
            )
        return _to_project_response(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit project helper request: {e}",
        )


@app.get("/api/v1/projects/{project_id}", response_model=ProjectDetailResponse)
def get_project_detail(
    project_id: int,
    _: None = Depends(require_internal_secret),
):
    row = get_project_row(project_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    interested = get_interested(project_id)
    comments = get_comments(project_id)
    base = _to_project_response(row)
    return ProjectDetailResponse(
        **base.model_dump(),
        interested=[InterestedResponse(**i) for i in interested],
        comments=[CommentResponse(**c) for c in comments],
    )


@app.patch("/api/v1/projects/{project_id}", response_model=ProjectResponse)
def patch_project(
    project_id: int,
    body: ProjectUpdate,
    user_id: int = Depends(require_internal_user),
):
    try:
        row = update_project_fields(
            project_id=project_id,
            actor_user_id=user_id,
            title=body.title,
            description=body.description,
            tech_stack=body.tech_stack,
        )
        return _to_project_response(row)
    except ValueError as e:
        msg = str(e)
        raise HTTPException(status_code=_project_error_status(msg), detail=msg)


@app.patch("/api/v1/projects/{project_id}/status", response_model=ProjectResponse)
def patch_project_status(
    project_id: int,
    body: ProjectStatusUpdate,
    user_id: int = Depends(require_internal_user),
):
    try:
        row = update_project_status(
            project_id=project_id,
            new_status=body.status,
            actor_user_id=user_id,
            helper_user_id=body.helper_user_id,
        )
        return _to_project_response(row)
    except ValueError as e:
        msg = str(e)
        raise HTTPException(status_code=_project_error_status(msg), detail=msg)


@app.post(
    "/api/v1/projects/{project_id}/interested",
    response_model=InterestedResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_interested(
    project_id: int,
    body: InterestedCreate,
    user_id: int = Depends(require_internal_user),
):
    try:
        result = add_interested(project_id, user_id, body.note)
        user = get_user_by_id(user_id)
        return InterestedResponse(
            project_id=result["project_id"],
            user_id=result["user_id"],
            user_name=user["name"] if user else None,
            note=result.get("note"),
            created_at=result["created_at"],
        )
    except ValueError as e:
        msg = str(e)
        raise HTTPException(status_code=_project_error_status(msg), detail=msg)


@app.delete("/api/v1/projects/{project_id}/interested", status_code=status.HTTP_204_NO_CONTENT)
def delete_interested(
    project_id: int,
    user_id: int = Depends(require_internal_user),
):
    removed = remove_interested(project_id, user_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interest record not found.",
        )
    return None


@app.get("/api/v1/projects/{project_id}/comments", response_model=List[CommentResponse])
def list_comments(
    project_id: int,
    _: None = Depends(require_internal_secret),
):
    if not get_project_row(project_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return [CommentResponse(**c) for c in get_comments(project_id)]


@app.post(
    "/api/v1/projects/{project_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_comment(
    project_id: int,
    body: CommentCreate,
    user_id: int = Depends(require_internal_user),
):
    try:
        return CommentResponse(**add_comment(project_id, user_id, body.body))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("profile_service.main:app", host="0.0.0.0", port=8081, reload=True)
