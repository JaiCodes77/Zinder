import base64
import json
import os
from contextlib import asynccontextmanager
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, status, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from shared.internal_auth import require_internal_user, internal_headers
from matcher_service.database import (
    init_db,
    record_swipe,
    get_swiped_user_ids,
    check_reciprocal_swipe,
    create_match,
    get_matches,
    get_last_swipe,
    delete_swipe,
    get_match_between,
    delete_match,
)
from matcher_service.schemas import (
    SwipeRequest,
    SwipeResponse,
    UndoSwipeResponse,
    MatchDetails,
    BrowseItem,
    BrowseResponse,
)
from matcher_service.scoring import compute_score, filter_by_tags

PROFILE_SERVICE_URL = os.getenv("PROFILE_SERVICE_URL", "http://localhost:8081")
CHAT_SERVICE_URL = os.getenv("CHAT_SERVICE_URL", "http://localhost:8083")
# Dev-only: auto-like-back for @zinder.internal seed accounts. Default OFF.
SEED_AUTO_LIKE = os.getenv("SEED_AUTO_LIKE", "false").lower() in ("1", "true", "yes")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Zinder Matcher Service",
    description="Swiping, mutual matches, and server-side browse ranking.",
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


def _encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(json.dumps({"o": offset}).encode()).decode()


def _decode_cursor(cursor: Optional[str]) -> int:
    if not cursor:
        return 0
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        return max(0, int(data.get("o", 0)))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cursor.",
        )


async def _register_match_with_chat(match_id: int, user_a: int, user_b: int) -> None:
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{CHAT_SERVICE_URL}/api/v1/internal/matches",
                json={"match_id": match_id, "user1_id": user_a, "user2_id": user_b},
                headers=internal_headers(),
                timeout=3.0,
            )
        except httpx.RequestError:
            pass


async def _chat_has_activity(match_id: int) -> bool:
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(
                f"{CHAT_SERVICE_URL}/api/v1/internal/matches/{match_id}/activity",
                headers=internal_headers(),
                timeout=3.0,
            )
            if res.status_code == 200:
                return bool(res.json().get("has_messages"))
        except httpx.RequestError:
            # Fail closed: if chat is unreachable, do not delete the match
            return True
    return False


async def _unregister_match_with_chat(match_id: int) -> None:
    async with httpx.AsyncClient() as client:
        try:
            await client.delete(
                f"{CHAT_SERVICE_URL}/api/v1/internal/matches/{match_id}",
                headers=internal_headers(),
                timeout=3.0,
            )
        except httpx.RequestError:
            pass


@app.get("/api/v1/matcher/browse", response_model=BrowseResponse)
async def browse(
    user_id: int = Depends(require_internal_user),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    sort: str = Query("best", pattern="^(best|newest|nearby)$"),
    tags: Optional[str] = Query(None, description="Comma-separated interest tags"),
    offset: Optional[int] = Query(None, ge=0, description="Legacy offset; prefer cursor"),
):
    """
    Ranked candidate feed.
    Response shape (contract): { items: [...], next_cursor }.
    Each item includes server-computed `score` (0–100).
    """
    swiped_ids = set(get_swiped_user_ids(user_id))
    tag_list = [t.strip() for t in tags.split(",")] if tags else []

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{PROFILE_SERVICE_URL}/api/v1/profiles",
                headers=internal_headers(user_id),
                timeout=5.0,
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to retrieve profiles from Profile Service.",
                )
            all_profiles = response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Profile Service is offline: {exc}",
            )

    viewer = next((p for p in all_profiles if p.get("user_id") == user_id), None)
    if viewer is None:
        viewer = {"user_id": user_id, "interests": [], "looking_for": None}

    candidates = []
    for profile in all_profiles:
        pid = profile.get("user_id")
        if pid == user_id or pid in swiped_ids:
            continue
        # Skip users with no profile content yet
        if not profile.get("name") and not profile.get("interests"):
            continue
        candidates.append(profile)

    candidates = filter_by_tags(candidates, tag_list)

    scored = []
    for c in candidates:
        meta = compute_score(viewer, c)
        # Nearby sort / radius filter: drop outside radius when both have coords
        if sort == "nearby" and meta["distance_km"] is not None:
            radius = viewer.get("radius_limit") or 50
            if meta["distance_km"] > float(radius):
                continue
        scored.append({**c, **meta})

    if sort == "best":
        scored.sort(key=lambda x: (-x["score"], x.get("user_id") or 0))
    elif sort == "newest":
        scored.sort(
            key=lambda x: (x.get("last_active_at") or "", x.get("user_id") or 0),
            reverse=True,
        )
    elif sort == "nearby":
        scored.sort(
            key=lambda x: (
                x["distance_km"] if x["distance_km"] is not None else 1e9,
                -x["score"],
            )
        )

    start = offset if offset is not None else _decode_cursor(cursor)
    page = scored[start : start + limit]
    next_cursor = (
        _encode_cursor(start + limit) if start + limit < len(scored) else None
    )

    items = [
        BrowseItem(
            user_id=p["user_id"],
            name=p.get("name") or "Developer",
            age=p.get("age"),
            bio=p.get("bio"),
            image=p.get("image"),
            interests=p.get("interests") or [],
            looking_for=p.get("looking_for"),
            score=int(p["score"]),
            distance_km=p.get("distance_km"),
            last_active_at=p.get("last_active_at"),
            lat=p.get("lat"),
            lng=p.get("lng"),
        )
        for p in page
    ]
    return BrowseResponse(items=items, next_cursor=next_cursor)


@app.post("/api/v1/matcher/swipe", response_model=SwipeResponse)
async def swipe(
    request: SwipeRequest,
    swiper_id: int = Depends(require_internal_user),
):
    action = request.action.strip().upper()
    if action not in ("LIKE", "PASS", "SUPERLIKE"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action must be LIKE, PASS, or SUPERLIKE.",
        )

    record_swipe(swiper_id, request.swiped_id, action)

    # Dev-only seed auto-like-back — gated; never runs against real data by default
    if SEED_AUTO_LIKE and action in ("LIKE", "SUPERLIKE"):
        async with httpx.AsyncClient() as client:
            try:
                profile_res = await client.get(
                    f"{PROFILE_SERVICE_URL}/api/v1/internal/profiles/{request.swiped_id}",
                    headers=internal_headers(),
                    timeout=2.0,
                )
                if profile_res.status_code == 200:
                    email = profile_res.json().get("user", {}).get("email", "")
                    if email.endswith("@zinder.internal"):
                        record_swipe(request.swiped_id, swiper_id, "LIKE")
            except Exception:
                pass

    is_match = False
    match_id = None
    if action in ("LIKE", "SUPERLIKE"):
        if check_reciprocal_swipe(swiper_id, request.swiped_id):
            is_match = True
            match_id = create_match(swiper_id, request.swiped_id)
            if match_id is not None:
                await _register_match_with_chat(match_id, swiper_id, request.swiped_id)

    return SwipeResponse(
        swiper_id=swiper_id,
        swiped_id=request.swiped_id,
        action=action,
        is_match=is_match,
        match_id=match_id,
    )


@app.delete("/api/v1/matcher/swipe/last", response_model=UndoSwipeResponse)
async def undo_last_swipe(swiper_id: int = Depends(require_internal_user)):
    last = get_last_swipe(swiper_id)
    if not last:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No swipe to undo.",
        )

    swiped_id = last["swiped_id"]
    action = last["action"]
    match_removed = False

    match = get_match_between(swiper_id, swiped_id)
    if match:
        has_activity = await _chat_has_activity(match["id"])
        if has_activity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Cannot undo: this swipe created a match that already has "
                    "messages or other interaction."
                ),
            )
        delete_match(match["id"])
        await _unregister_match_with_chat(match["id"])
        match_removed = True

    delete_swipe(last["id"], swiper_id)
    return UndoSwipeResponse(
        undone=True,
        swiped_id=swiped_id,
        action=action,
        match_removed=match_removed,
    )


@app.get("/api/v1/matcher/matches", response_model=List[MatchDetails])
async def get_user_matches(user_id: int = Depends(require_internal_user)):
    raw_matches = get_matches(user_id)
    match_details_list = []
    async with httpx.AsyncClient() as client:
        for match in raw_matches:
            matched_id = match["matched_user_id"]
            try:
                response = await client.get(
                    f"{PROFILE_SERVICE_URL}/api/v1/profiles/{matched_id}",
                    headers=internal_headers(user_id),
                    timeout=5.0,
                )
                if response.status_code == 200:
                    profile_data = response.json()
                    match_details_list.append(
                        MatchDetails(
                            match_id=match["match_id"],
                            matched_user_id=matched_id,
                            matched_user_name=profile_data["user"]["name"],
                            matched_user_email=profile_data["user"].get("email") or "",
                            bio=profile_data.get("bio"),
                            interests=profile_data.get("interests", []),
                            image=profile_data.get("image"),
                            timestamp=match["timestamp"],
                        )
                    )
            except Exception:
                pass
    return match_details_list


if __name__ == "__main__":
    uvicorn.run("matcher_service.main:app", host="0.0.0.0", port=8082, reload=True)
