from typing import List, Optional
from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    id: int
    match_id: int
    sender_id: int
    text: str
    created_at: str
    read_at: Optional[str] = None


class MessagesPage(BaseModel):
    messages: List[MessageResponse]
    next_before: Optional[int] = None


class ReadUpdate(BaseModel):
    up_to_message_id: int


class MatchParticipants(BaseModel):
    """Used by matcher → chat for authorization registration / lookup."""
    match_id: int
    user1_id: int
    user2_id: int


class ActivityResponse(BaseModel):
    match_id: int
    has_messages: bool
    message_count: int
