import os
from contextlib import asynccontextmanager
from typing import List, Optional
import httpx
from fastapi import FastAPI, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from matcher_service.database import (
    init_db,
    record_swipe,
    get_swiped_user_ids,
    check_reciprocal_swipe,
    create_match,
    get_matches,
)
from matcher_service.schemas import SwipeRequest, SwipeResponse, MatchDetails

PROFILE_SERVICE_URL = os.getenv("PROFILE_SERVICE_URL", "http://localhost:8081")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema
    init_db()
    yield

app = FastAPI(
    title="Zinder Matcher Service",
    description="Microservice managing swiping actions and mutual matches.",
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

# ==========================================
# ENDPOINTS
# ==========================================

@app.get("/api/v1/matcher/browse", response_model=List[dict])
async def browse(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """
    Returns candidate profiles from the Profile Service that the user has not swiped on yet.
    """
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

    # 1. Fetch already swiped user IDs
    swiped_ids = get_swiped_user_ids(user_id)
    swiped_set = set(swiped_ids)

    # 2. Fetch all user profiles from Profile Service
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{PROFILE_SERVICE_URL}/api/v1/profiles", timeout=5.0)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to retrieve profiles from Profile Service."
                )
            all_profiles = response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Profile Service is offline: {exc}"
            )

    # 3. Filter out swiped profiles and the user themselves
    candidates = []
    for profile in all_profiles:
        profile_user_id = profile.get("user_id")
        if profile_user_id == user_id:
            continue
        if profile_user_id in swiped_set:
            continue
        candidates.append(profile)

    return candidates

@app.post("/api/v1/matcher/swipe", response_model=SwipeResponse)
async def swipe(request: SwipeRequest, x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """
    Logs a swipe action. Checks for a mutual match and returns match details if found.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-User-Id header."
        )
    try:
        swiper_id = int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-User-Id header format."
        )

    # 1. Log the swipe action
    record_swipe(swiper_id, request.swiped_id, request.action)

    # 2. Simulate reciprocal swipe if swiped user is a seeded/internal dev
    if request.action.upper() in ("LIKE", "SUPERLIKE"):
        async with httpx.AsyncClient() as client:
            try:
                profile_res = await client.get(f"{PROFILE_SERVICE_URL}/api/v1/profiles/{request.swiped_id}", timeout=2.0)
                if profile_res.status_code == 200:
                    profile_data = profile_res.json()
                    email = profile_data.get("user", {}).get("email", "")
                    if email.endswith("@zinder.internal"):
                        # Auto-swipe back to trigger match!
                        record_swipe(request.swiped_id, swiper_id, "LIKE")
            except Exception:
                pass

    # 3. Check for reciprocal like
    is_match = False
    match_id = None
    if request.action.upper() in ("LIKE", "SUPERLIKE"):
        reciprocal = check_reciprocal_swipe(swiper_id, request.swiped_id)
        if reciprocal:
            is_match = True
            # Create a match record
            match_id = create_match(swiper_id, request.swiped_id)

    return SwipeResponse(
        swiper_id=swiper_id,
        swiped_id=request.swiped_id,
        action=request.action,
        is_match=is_match,
        match_id=match_id
    )

@app.get("/api/v1/matcher/matches", response_model=List[MatchDetails])
async def get_user_matches(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """
    Retrieves all matches for the user, joined with profile metadata from the Profile Service.
    """
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

    # 1. Fetch matches from database
    raw_matches = get_matches(user_id)
    
    # 2. Fetch profile details downstream for each match
    match_details_list = []
    async with httpx.AsyncClient() as client:
        for match in raw_matches:
            matched_id = match["matched_user_id"]
            try:
                response = await client.get(f"{PROFILE_SERVICE_URL}/api/v1/profiles/{matched_id}", timeout=5.0)
                if response.status_code == 200:
                    profile_data = response.json()
                    match_details_list.append(
                        MatchDetails(
                            match_id=match["match_id"],
                            matched_user_id=matched_id,
                            matched_user_name=profile_data["user"]["name"],
                            matched_user_email=profile_data["user"]["email"],
                            bio=profile_data.get("bio"),
                            interests=profile_data.get("interests", []),
                            image=profile_data.get("image"),
                            timestamp=match["timestamp"]
                        )
                    )
            except Exception:
                # If Profile Service fails or is offline, skip or insert empty record
                pass

    return match_details_list

if __name__ == "__main__":
    uvicorn.run("matcher_service.main:app", host="0.0.0.0", port=8082, reload=True)
