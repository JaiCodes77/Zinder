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

    model_config = {
        "from_attributes": True
    }

class ProfileCreate(BaseModel):
    user_id: Optional[int] = None  # Resolved from header if not in body
    age: Optional[int] = Field(None, ge=18, le=120)
    distance: Optional[str] = None
    bio: Optional[str] = None
    image: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    looking_for: Optional[str] = None
    radius_limit: Optional[int] = Field(None, ge=0)

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

    model_config = {
        "from_attributes": True
    }

class ProjectCreate(BaseModel):
    user_id: Optional[int] = None  # Resolved from header if not in body
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10)
    tech_stack: List[str] = Field(default_factory=list)

class ProjectResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    title: str
    description: str
    tech_stack: List[str]
    timestamp: str

    model_config = {
        "from_attributes": True
    }
