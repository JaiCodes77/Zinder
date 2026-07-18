"""Chat Service — REST history + WebSocket fanout for match conversations."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Dict, Optional, Set

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from shared.internal_auth import require_internal_secret, require_internal_user
from chat_service.database import (
    init_db,
    upsert_match_participants,
    get_match_participants,
    user_in_match,
    create_message,
    get_messages,
    mark_read,
    get_activity,
    delete_match_participants,
)
from chat_service.schemas import (
    MessageCreate,
    MessageResponse,
    MessagesPage,
    ReadUpdate,
    MatchParticipants,
    ActivityResponse,
)


class ConnectionManager:
    """In-memory WebSocket rooms keyed by match_id."""

    def __init__(self) -> None:
        self.rooms: Dict[int, Set[WebSocket]] = {}
        self.presence: Dict[int, Set[int]] = {}  # match_id -> user_ids online
        self.ws_user: Dict[WebSocket, int] = {}
        self.ws_match: Dict[WebSocket, int] = {}

    async def connect(self, websocket: WebSocket, match_id: int, user_id: int) -> None:
        await websocket.accept()
        self.rooms.setdefault(match_id, set()).add(websocket)
        self.presence.setdefault(match_id, set()).add(user_id)
        self.ws_user[websocket] = user_id
        self.ws_match[websocket] = match_id
        await self.broadcast(
            match_id,
            {"type": "presence", "match_id": match_id, "user_id": user_id, "online": True},
            exclude=None,
        )

    def disconnect(self, websocket: WebSocket) -> None:
        match_id = self.ws_match.pop(websocket, None)
        user_id = self.ws_user.pop(websocket, None)
        if match_id is not None and websocket in self.rooms.get(match_id, set()):
            self.rooms[match_id].discard(websocket)
            if not self.rooms[match_id]:
                self.rooms.pop(match_id, None)
        if match_id is not None and user_id is not None:
            online = self.presence.get(match_id, set())
            online.discard(user_id)
            if not online:
                self.presence.pop(match_id, None)

    async def broadcast(
        self,
        match_id: int,
        payload: dict,
        exclude: Optional[WebSocket] = None,
    ) -> None:
        dead: list[WebSocket] = []
        for ws in list(self.rooms.get(match_id, set())):
            if exclude is not None and ws is exclude:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Zinder Chat Service",
    description="Real-time messaging for matched developers.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _ensure_participant(match_id: int, user_id: int) -> None:
    if not user_in_match(match_id, user_id):
        # Participants may not be synced yet — reject rather than open the door
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a participant of this match, or match is unknown to chat service.",
        )


# ==========================================
# INTERNAL: match registration / activity
# ==========================================

@app.post("/api/v1/internal/matches", status_code=status.HTTP_204_NO_CONTENT)
def register_match(
    body: MatchParticipants,
    _: None = Depends(require_internal_secret),
):
    """Matcher calls this when a match is created so chat can authorize participants."""
    upsert_match_participants(body.match_id, body.user1_id, body.user2_id)
    return None


@app.delete("/api/v1/internal/matches/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
def unregister_match(
    match_id: int,
    _: None = Depends(require_internal_secret),
):
    delete_match_participants(match_id)
    return None


@app.get(
    "/api/v1/internal/matches/{match_id}/activity",
    response_model=ActivityResponse,
)
def match_activity(
    match_id: int,
    _: None = Depends(require_internal_secret),
):
    return ActivityResponse(**get_activity(match_id))


# ==========================================
# REST messaging
# ==========================================

@app.get(
    "/api/v1/chat/conversations/{match_id}/messages",
    response_model=MessagesPage,
)
def list_messages(
    match_id: int,
    before: Optional[int] = None,
    limit: int = 50,
    user_id: int = Depends(require_internal_user),
):
    _ensure_participant(match_id, user_id)
    messages, next_before = get_messages(match_id, before=before, limit=limit)
    return MessagesPage(
        messages=[MessageResponse(**m) for m in messages],
        next_before=next_before,
    )


@app.post(
    "/api/v1/chat/conversations/{match_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_message(
    match_id: int,
    body: MessageCreate,
    user_id: int = Depends(require_internal_user),
):
    _ensure_participant(match_id, user_id)
    msg = create_message(match_id, user_id, body.text)
    event = {"type": "message", **msg}
    await manager.broadcast(match_id, event)
    return MessageResponse(**msg)


@app.post(
    "/api/v1/chat/conversations/{match_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def post_read(
    match_id: int,
    body: ReadUpdate,
    user_id: int = Depends(require_internal_user),
):
    _ensure_participant(match_id, user_id)
    mark_read(match_id, user_id, body.up_to_message_id)
    await manager.broadcast(
        match_id,
        {
            "type": "read",
            "match_id": match_id,
            "reader_id": user_id,
            "up_to_message_id": body.up_to_message_id,
        },
    )
    return None


# ==========================================
# WebSocket
# ==========================================

@app.websocket("/api/v1/chat/ws")
async def chat_ws(websocket: WebSocket):
    """
    Authenticated via headers set by the gateway after session validation:
      X-Internal-Secret, X-User-Id
    Client sends JSON: { "type": "subscribe", "match_id": N }
    Also accepts: { "type": "typing", "match_id": N, "is_typing": true }
    """
    secret = websocket.headers.get("x-internal-secret")
    user_header = websocket.headers.get("x-user-id")
    from shared.internal_auth import get_internal_secret

    if secret != get_internal_secret() or not user_header:
        await websocket.close(code=4401)
        return
    try:
        user_id = int(user_header)
    except ValueError:
        await websocket.close(code=4400)
        return

    await websocket.accept()
    subscribed_match: Optional[int] = None

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON"})
                continue

            msg_type = data.get("type")
            if msg_type == "subscribe":
                match_id = data.get("match_id")
                if match_id is None:
                    await websocket.send_json({"type": "error", "detail": "match_id required"})
                    continue
                match_id = int(match_id)
                if not user_in_match(match_id, user_id):
                    await websocket.send_json(
                        {"type": "error", "detail": "Not a participant of this match"}
                    )
                    continue
                if subscribed_match is not None:
                    manager.disconnect(websocket)
                # Re-bind: ConnectionManager.connect calls accept — already accepted.
                # Manually join room without re-accept.
                manager.rooms.setdefault(match_id, set()).add(websocket)
                manager.presence.setdefault(match_id, set()).add(user_id)
                manager.ws_user[websocket] = user_id
                manager.ws_match[websocket] = match_id
                subscribed_match = match_id
                await websocket.send_json(
                    {"type": "subscribed", "match_id": match_id}
                )
                await manager.broadcast(
                    match_id,
                    {
                        "type": "presence",
                        "match_id": match_id,
                        "user_id": user_id,
                        "online": True,
                    },
                    exclude=websocket,
                )
            elif msg_type == "typing":
                match_id = int(data.get("match_id", subscribed_match or 0))
                if not match_id or not user_in_match(match_id, user_id):
                    continue
                await manager.broadcast(
                    match_id,
                    {
                        "type": "typing",
                        "match_id": match_id,
                        "user_id": user_id,
                        "is_typing": bool(data.get("is_typing", True)),
                    },
                    exclude=websocket,
                )
            else:
                await websocket.send_json(
                    {"type": "error", "detail": f"Unknown type '{msg_type}'"}
                )
    except WebSocketDisconnect:
        if subscribed_match is not None:
            offline_user = user_id
            manager.disconnect(websocket)
            await manager.broadcast(
                subscribed_match,
                {
                    "type": "presence",
                    "match_id": subscribed_match,
                    "user_id": offline_user,
                    "online": False,
                },
            )


if __name__ == "__main__":
    uvicorn.run("chat_service.main:app", host="0.0.0.0", port=8083, reload=True)
