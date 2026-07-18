from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class SwipeRequest(BaseModel):
    swiped_id: int = Field(..., description="The ID of the user being swiped on")
    action: str = Field(..., description="Swipe action: 'LIKE', 'PASS', 'SUPERLIKE'")


class SwipeResponse(BaseModel):
    swiper_id: int
    swiped_id: int
    action: str
    is_match: bool
    match_id: Optional[int] = None


class UndoSwipeResponse(BaseModel):
    undone: bool
    swiped_id: int
    action: Optional[str] = None
    match_removed: bool = False


class MatchDetails(BaseModel):
    match_id: int
    matched_user_id: int
    matched_user_name: str
    matched_user_email: str = ""
    bio: Optional[str] = None
    interests: List[str] = []
    image: Optional[str] = None
    timestamp: str

    model_config = {"from_attributes": True}


class BrowseItem(BaseModel):
    user_id: int
    name: str
    age: Optional[int] = None
    bio: Optional[str] = None
    image: Optional[str] = None
    interests: List[str] = []
    looking_for: Optional[str] = None
    score: int
    distance_km: Optional[float] = None
    last_active_at: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class BrowseResponse(BaseModel):
    items: List[BrowseItem]
    next_cursor: Optional[str] = None
