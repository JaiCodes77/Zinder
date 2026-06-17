from typing import List, Optional
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

class MatchDetails(BaseModel):
    match_id: int
    matched_user_id: int
    matched_user_name: str
    matched_user_email: str
    bio: Optional[str] = None
    interests: List[str] = []
    image: Optional[str] = None
    timestamp: str

    model_config = {
        "from_attributes": True
    }
