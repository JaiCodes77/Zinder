import json
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional
from fastapi import (
    FastAPI,
    Depends,
    Response,
    status,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis.asyncio as redis
import httpx
import websockets

from app.config import settings
from app.dependencies.auth import validate_session, get_redis
from shared.internal_auth import internal_headers

PROFILE_SERVICE_URL = settings.PROFILE_SERVICE_URL
MATCHER_SERVICE_URL = settings.MATCHER_SERVICE_URL
CHAT_SERVICE_URL = settings.CHAT_SERVICE_URL


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Keep shared.internal_auth in sync with pydantic-loaded .env
    import os

    os.environ.setdefault(
        "INTERNAL_SERVICE_SECRET", settings.INTERNAL_SERVICE_SECRET
    )
    app.state.memory_sessions = {}
    try:
        app.state.redis_pool = redis.ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=50,
            decode_responses=False,
        )
    except Exception:
        app.state.redis_pool = None
    yield
    if getattr(app.state, "redis_pool", None) is not None:
        try:
            await app.state.redis_pool.disconnect()
        except Exception:
            pass


app = FastAPI(
    title="Zinder API Gateway",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# REQUEST SCHEMAS
# ==========================================
class UserRegister(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")
    name: str = Field(..., min_length=2, description="User full name")


class UserLogin(BaseModel):
    email: str = Field(..., description="User email or username")
    password: str = Field(..., description="User password")


class ProfileUpdate(BaseModel):
    age: Optional[int] = Field(None, ge=18, le=120)
    distance: Optional[str] = None
    bio: Optional[str] = None
    image: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    looking_for: Optional[str] = None
    radius_limit: Optional[int] = Field(None, ge=0)
    lat: Optional[float] = None
    lng: Optional[float] = None


class SwipeRequest(BaseModel):
    swiped_id: int = Field(..., description="The ID of the user being swiped on")
    action: str = Field(..., description="Swipe action: 'LIKE', 'PASS', 'SUPERLIKE'")


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=3, description="Project title")
    description: str = Field(..., min_length=10, description="Project description")
    tech_stack: List[str] = Field(..., description="List of technologies used")


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, min_length=10)
    tech_stack: Optional[List[str]] = None


class ProjectStatusUpdate(BaseModel):
    status: str
    helper_user_id: Optional[int] = None


class InterestedCreate(BaseModel):
    note: Optional[str] = None


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class MessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class ReadUpdate(BaseModel):
    up_to_message_id: int


def _session_user_id(session: Dict[str, Any]) -> int:
    user_id = session.get("userId")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session payload is missing user identification credentials",
        )
    return int(user_id)


async def _proxy_json(
    method: str,
    url: str,
    user_id: Optional[int] = None,
    json_body: Any = None,
    params: Optional[dict] = None,
    expected: Optional[set] = None,
) -> Any:
    expected = expected or {200, 201, 204}
    headers = internal_headers(user_id) if user_id is not None else internal_headers()
    async with httpx.AsyncClient() as client:
        try:
            response = await client.request(
                method,
                url,
                headers=headers,
                json=json_body,
                params=params,
                timeout=10.0,
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Downstream service unavailable: {exc}",
            )
    if response.status_code not in expected:
        detail = "Downstream service error"
        try:
            detail = response.json().get("detail", detail)
        except Exception:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)
    if response.status_code == 204 or not response.content:
        return None
    return response.json()


# ==========================================
# AUTH
# ==========================================

@app.post("/api/v1/auth/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister) -> Dict[str, Any]:
    return await _proxy_json(
        "POST",
        f"{PROFILE_SERVICE_URL}/api/v1/users",
        json_body=user_data.model_dump(),
        expected={201},
    )


@app.post("/api/v1/auth/login", status_code=status.HTTP_200_OK)
async def login(
    credentials: UserLogin,
    response: Response,
    redis_client: redis.Redis | None = Depends(get_redis),
) -> Dict[str, Any]:
    user_data = await _proxy_json(
        "POST",
        f"{PROFILE_SERVICE_URL}/api/v1/users/verify",
        json_body=credentials.model_dump(),
        expected={200},
    )

    session_id = str(uuid.uuid4())
    session_payload = {
        "userId": user_data.get("id"),
        "email": user_data.get("email"),
        "name": user_data.get("name"),
        "role": user_data.get("role", "user"),
    }

    session_written = False
    if redis_client is not None:
        try:
            await redis_client.set(
                name=f"session:{session_id}",
                value=json.dumps(session_payload),
                ex=86400,
            )
            session_written = True
        except Exception:
            pass

    if not session_written:
        memory_sessions = getattr(app.state, "memory_sessions", None)
        if memory_sessions is not None:
            memory_sessions[f"session:{session_id}"] = json.dumps(session_payload)
        else:
            from app.dependencies.auth import MEMORY_SESSIONS

            MEMORY_SESSIONS[f"session:{session_id}"] = json.dumps(session_payload)

    response.set_cookie(
        key="sessionId",
        value=session_id,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=86400,
    )

    # Contract: { id, email, name } + Set-Cookie
    return {
        "id": user_data.get("id"),
        "email": user_data.get("email"),
        "name": user_data.get("name"),
    }


@app.post("/api/v1/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    redis_client: redis.Redis | None = Depends(get_redis),
):
    session_id = request.cookies.get("sessionId")
    if session_id:
        if redis_client is not None:
            try:
                await redis_client.delete(f"session:{session_id}")
            except Exception:
                pass
        memory_sessions = getattr(request.app.state, "memory_sessions", None)
        if memory_sessions is not None:
            memory_sessions.pop(f"session:{session_id}", None)
        else:
            from app.dependencies.auth import MEMORY_SESSIONS

            MEMORY_SESSIONS.pop(f"session:{session_id}", None)

    response.delete_cookie(key="sessionId")
    return None


@app.get("/api/v1/auth/me", status_code=status.HTTP_200_OK)
async def auth_me(session: Dict[str, Any] = Depends(validate_session)) -> Dict[str, Any]:
    user_id = session.get("userId")
    email = session.get("email")
    name = session.get("name")
    # Refresh name from profile service when missing from older sessions
    if user_id and (not name or not email):
        profile = await _proxy_json(
            "GET",
            f"{PROFILE_SERVICE_URL}/api/v1/profiles/me",
            user_id=int(user_id),
            expected={200},
        )
        return {
            "id": profile["user"]["id"],
            "email": profile["user"]["email"],
            "name": profile["user"]["name"],
        }
    return {"id": user_id, "email": email, "name": name}


# ==========================================
# MATCHER
# ==========================================

@app.get("/api/v1/matcher/browse", status_code=status.HTTP_200_OK)
async def browse(
    request: Request,
    session: Dict[str, Any] = Depends(validate_session),
) -> Any:
    user_id = _session_user_id(session)
    params = dict(request.query_params)
    return await _proxy_json(
        "GET",
        f"{MATCHER_SERVICE_URL}/api/v1/matcher/browse",
        user_id=user_id,
        params=params,
        expected={200},
    )


@app.post("/api/v1/matcher/swipe", status_code=status.HTTP_200_OK)
async def swipe(
    swipe_data: SwipeRequest,
    session: Dict[str, Any] = Depends(validate_session),
) -> Dict[str, Any]:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "POST",
        f"{MATCHER_SERVICE_URL}/api/v1/matcher/swipe",
        user_id=user_id,
        json_body=swipe_data.model_dump(),
        expected={200},
    )


@app.delete("/api/v1/matcher/swipe/last", status_code=status.HTTP_200_OK)
async def undo_swipe(session: Dict[str, Any] = Depends(validate_session)) -> Dict[str, Any]:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "DELETE",
        f"{MATCHER_SERVICE_URL}/api/v1/matcher/swipe/last",
        user_id=user_id,
        expected={200},
    )


@app.get("/api/v1/matcher/matches", status_code=status.HTTP_200_OK)
async def get_matches(session: Dict[str, Any] = Depends(validate_session)) -> Any:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "GET",
        f"{MATCHER_SERVICE_URL}/api/v1/matcher/matches",
        user_id=user_id,
        expected={200},
    )


# ==========================================
# PROFILES
# ==========================================

@app.get("/api/v1/profiles/me", status_code=status.HTTP_200_OK)
async def get_my_profile(session: Dict[str, Any] = Depends(validate_session)) -> Dict[str, Any]:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "GET",
        f"{PROFILE_SERVICE_URL}/api/v1/profiles/me",
        user_id=user_id,
        expected={200},
    )


@app.get("/api/v1/profiles/{target_user_id}", status_code=status.HTTP_200_OK)
async def get_public_profile(
    target_user_id: int,
    session: Dict[str, Any] = Depends(validate_session),
) -> Dict[str, Any]:
    """Public profile for another user (email redacted server-side when not self)."""
    user_id = _session_user_id(session)
    return await _proxy_json(
        "GET",
        f"{PROFILE_SERVICE_URL}/api/v1/profiles/{target_user_id}",
        user_id=user_id,
        expected={200},
    )


@app.post("/api/v1/profiles", status_code=status.HTTP_200_OK)
async def update_profile(
    profile_data: ProfileUpdate,
    session: Dict[str, Any] = Depends(validate_session),
) -> Dict[str, Any]:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "POST",
        f"{PROFILE_SERVICE_URL}/api/v1/profiles",
        user_id=user_id,
        json_body=profile_data.model_dump(),
        expected={200},
    )


# ==========================================
# PROJECTS
# ==========================================

@app.get("/api/v1/projects", status_code=status.HTTP_200_OK)
async def get_projects(session: Dict[str, Any] = Depends(validate_session)) -> Any:
    _session_user_id(session)
    return await _proxy_json(
        "GET",
        f"{PROFILE_SERVICE_URL}/api/v1/projects",
        expected={200},
    )


@app.post("/api/v1/projects", status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    session: Dict[str, Any] = Depends(validate_session),
) -> Dict[str, Any]:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "POST",
        f"{PROFILE_SERVICE_URL}/api/v1/projects",
        user_id=user_id,
        json_body=project_data.model_dump(),
        expected={201},
    )


@app.get("/api/v1/projects/{project_id}", status_code=status.HTTP_200_OK)
async def get_project(
    project_id: int,
    session: Dict[str, Any] = Depends(validate_session),
) -> Any:
    _session_user_id(session)
    return await _proxy_json(
        "GET",
        f"{PROFILE_SERVICE_URL}/api/v1/projects/{project_id}",
        expected={200},
    )


@app.patch("/api/v1/projects/{project_id}", status_code=status.HTTP_200_OK)
async def patch_project(
    project_id: int,
    body: ProjectUpdate,
    session: Dict[str, Any] = Depends(validate_session),
) -> Any:
    """Owner edit of title / description / tech_stack (pending only)."""
    user_id = _session_user_id(session)
    return await _proxy_json(
        "PATCH",
        f"{PROFILE_SERVICE_URL}/api/v1/projects/{project_id}",
        user_id=user_id,
        json_body=body.model_dump(exclude_none=True),
        expected={200},
    )


@app.patch("/api/v1/projects/{project_id}/status", status_code=status.HTTP_200_OK)
async def patch_project_status(
    project_id: int,
    body: ProjectStatusUpdate,
    session: Dict[str, Any] = Depends(validate_session),
) -> Any:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "PATCH",
        f"{PROFILE_SERVICE_URL}/api/v1/projects/{project_id}/status",
        user_id=user_id,
        json_body=body.model_dump(),
        expected={200},
    )


@app.post("/api/v1/projects/{project_id}/interested", status_code=status.HTTP_201_CREATED)
async def post_interested(
    project_id: int,
    body: InterestedCreate,
    session: Dict[str, Any] = Depends(validate_session),
) -> Any:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "POST",
        f"{PROFILE_SERVICE_URL}/api/v1/projects/{project_id}/interested",
        user_id=user_id,
        json_body=body.model_dump(),
        expected={201},
    )


@app.delete("/api/v1/projects/{project_id}/interested", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interested(
    project_id: int,
    session: Dict[str, Any] = Depends(validate_session),
):
    user_id = _session_user_id(session)
    await _proxy_json(
        "DELETE",
        f"{PROFILE_SERVICE_URL}/api/v1/projects/{project_id}/interested",
        user_id=user_id,
        expected={204},
    )
    return None


@app.get("/api/v1/projects/{project_id}/comments", status_code=status.HTTP_200_OK)
async def get_comments(
    project_id: int,
    session: Dict[str, Any] = Depends(validate_session),
) -> Any:
    _session_user_id(session)
    return await _proxy_json(
        "GET",
        f"{PROFILE_SERVICE_URL}/api/v1/projects/{project_id}/comments",
        expected={200},
    )


@app.post("/api/v1/projects/{project_id}/comments", status_code=status.HTTP_201_CREATED)
async def post_comment(
    project_id: int,
    body: CommentCreate,
    session: Dict[str, Any] = Depends(validate_session),
) -> Any:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "POST",
        f"{PROFILE_SERVICE_URL}/api/v1/projects/{project_id}/comments",
        user_id=user_id,
        json_body=body.model_dump(),
        expected={201},
    )


# ==========================================
# CHAT
# ==========================================

@app.get("/api/v1/chat/conversations/{match_id}/messages", status_code=status.HTTP_200_OK)
async def chat_messages(
    match_id: int,
    session: Dict[str, Any] = Depends(validate_session),
    before: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    user_id = _session_user_id(session)
    params: dict = {"limit": limit}
    if before is not None:
        params["before"] = before
    return await _proxy_json(
        "GET",
        f"{CHAT_SERVICE_URL}/api/v1/chat/conversations/{match_id}/messages",
        user_id=user_id,
        params=params,
        expected={200},
    )


@app.post(
    "/api/v1/chat/conversations/{match_id}/messages",
    status_code=status.HTTP_201_CREATED,
)
async def chat_post_message(
    match_id: int,
    body: MessageCreate,
    session: Dict[str, Any] = Depends(validate_session),
) -> Any:
    user_id = _session_user_id(session)
    return await _proxy_json(
        "POST",
        f"{CHAT_SERVICE_URL}/api/v1/chat/conversations/{match_id}/messages",
        user_id=user_id,
        json_body=body.model_dump(),
        expected={201},
    )


@app.post(
    "/api/v1/chat/conversations/{match_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def chat_read(
    match_id: int,
    body: ReadUpdate,
    session: Dict[str, Any] = Depends(validate_session),
):
    user_id = _session_user_id(session)
    await _proxy_json(
        "POST",
        f"{CHAT_SERVICE_URL}/api/v1/chat/conversations/{match_id}/read",
        user_id=user_id,
        json_body=body.model_dump(),
        expected={204},
    )
    return None


@app.websocket("/api/v1/chat/ws")
async def chat_ws_proxy(websocket: WebSocket):
    """
    Validate session cookie, then bridge to the Chat Service WebSocket,
    injecting X-Internal-Secret + X-User-Id so the chat service never trusts
    a raw browser-supplied user id.
    """
    await websocket.accept()
    session_id = websocket.cookies.get("sessionId")
    if not session_id:
        await websocket.close(code=4401)
        return

    session_data = None
    # Try Redis via app pool
    pool = getattr(websocket.app.state, "redis_pool", None)
    if pool is not None:
        client = redis.Redis(connection_pool=pool)
        try:
            raw = await client.get(f"session:{session_id}")
            if raw:
                session_data = json.loads(raw.decode("utf-8"))
        except Exception:
            pass
        finally:
            try:
                await client.close()
            except Exception:
                pass

    if session_data is None:
        memory_sessions = getattr(websocket.app.state, "memory_sessions", {})
        session_str = memory_sessions.get(f"session:{session_id}")
        if session_str:
            try:
                session_data = json.loads(session_str)
            except Exception:
                session_data = None

    if not session_data or not session_data.get("userId"):
        await websocket.close(code=4401)
        return

    user_id = session_data["userId"]
    headers = [
        ("X-Internal-Secret", internal_headers()["X-Internal-Secret"]),
        ("X-User-Id", str(user_id)),
    ]
    ws_url = CHAT_SERVICE_URL.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_url}/api/v1/chat/ws"

    try:
        async with websockets.connect(ws_url, additional_headers=headers) as upstream:
            async def client_to_upstream():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await upstream.send(data)
                except WebSocketDisconnect:
                    await upstream.close()

            async def upstream_to_client():
                try:
                    async for message in upstream:
                        await websocket.send_text(message)
                except Exception:
                    await websocket.close()

            import asyncio

            await asyncio.gather(client_to_upstream(), upstream_to_client())
    except Exception:
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
