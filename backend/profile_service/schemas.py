from typing import List, Optional
from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")
    name: str = Field(..., min_length=2, description="User full name")


class UserLogin(BaseModel):
    email: str = Field(..., description="User email or username")
    password: str = Field(..., description="User password")


class UserResponse(BaseModel):
    id: int
    email: str
    name: str

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    """User identity without email — used in browse / public profile lists."""
    id: int
    name: str


class ProfileCreate(BaseModel):
    user_id: Optional[int] = None
    age: Optional[int] = Field(None, ge=18, le=120)
    distance: Optional[str] = None
    bio: Optional[str] = None
    image: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    looking_for: Optional[str] = None
    radius_limit: Optional[int] = Field(None, ge=0)
    lat: Optional[float] = None
    lng: Optional[float] = None


class ProfileResponse(BaseModel):
    user_id: int
    user: UserResponse
    age: Optional[int] = None
    distance: Optional[str] = None
    bio: Optional[str] = None
    image: Optional[str] = None
    interests: List[str] = []
    looking_for: Optional[str] = None
    radius_limit: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    last_active_at: Optional[str] = None

    model_config = {"from_attributes": True}


class PublicProfileResponse(BaseModel):
    """Scoped profile for discovery — no email."""
    user_id: int
    name: str
    age: Optional[int] = None
    distance: Optional[str] = None
    bio: Optional[str] = None
    image: Optional[str] = None
    interests: List[str] = []
    looking_for: Optional[str] = None
    radius_limit: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    last_active_at: Optional[str] = None


class ProjectCreate(BaseModel):
    user_id: Optional[int] = None
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10)
    tech_stack: List[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    """Owner edit — only while the request is still pending."""
    title: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, min_length=10)
    tech_stack: Optional[List[str]] = None


class ProjectResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    title: str
    description: str
    tech_stack: List[str]
    timestamp: str
    status: str = "pending"
    helper_user_id: Optional[int] = None

    model_config = {"from_attributes": True}


class InterestedCreate(BaseModel):
    note: Optional[str] = None


class InterestedResponse(BaseModel):
    project_id: int
    user_id: int
    user_name: Optional[str] = None
    note: Optional[str] = None
    created_at: str


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class CommentResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    user_name: str
    body: str
    created_at: str


class ProjectDetailResponse(ProjectResponse):
    interested: List[InterestedResponse] = []
    comments: List[CommentResponse] = []


class ProjectStatusUpdate(BaseModel):
    status: str = Field(..., description="pending|accepted|in_progress|completed|cancelled")
    helper_user_id: Optional[int] = Field(
        None,
        description="Required when transitioning to accepted — must be on interested list.",
    )
