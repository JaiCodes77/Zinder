import json
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Any
from fastapi import FastAPI, Depends, Response, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis.asyncio as redis
import httpx

from app.config import settings
from app.dependencies.auth import validate_session, get_redis

# ==========================================
# LIFESPAN MANAGER (REDIS CONNECTION POOL)
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the Redis connection pool
    app.state.redis_pool = redis.ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=50,  # Optimized pool size for microservices gateway
        decode_responses=False
    )
    yield
    # Shutdown: Gracefully close the Redis connection pool
    await app.state.redis_pool.disconnect()

# Initialize FastAPI App with Lifespan
app = FastAPI(
    title="Zinder API Gateway",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS Middleware
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

# ==========================================
# API ROUTE ENDPOINTS
# ==========================================

@app.post("/api/v1/auth/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister) -> Dict[str, Any]:
    """
    Asynchronous API Gateway endpoint that proxies the registration request
    downstream to the dedicated Authentication/Profile microservice.
    """
    async with httpx.AsyncClient() as client:
        try: 
            response = await client.post(
                "http://profile-service.zinder.internal/api/v1/users",
                json=user_data.model_dump(),  # Pydantic v2 method to serialize class to dict
                timeout=5.0
            ) 

            if response.status_code != status.HTTP_201_CREATED:
                raise HTTPException(
                    status_code = response.status_code, 
                    detail = response.json().get("detail", "Registration downstream error")
                ) 
    
            return response.json()  

        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Profile Service Unavailable: {exc}"
            )

@app.post("/api/v1/auth/login", status_code=status.HTTP_200_OK)
async def login(
    credentials: UserLogin, 
    response: Response, 
    redis_client: redis.Redis = Depends(get_redis)
) -> Dict[str, Any]:
    """
    Public login endpoint.
    1. Proxies credentials to the downstream Profile/Auth microservice for verification.
    2. Generates a secure session ID (UUID) if validation succeeds.
    3. Caches the user session payload inside Redis for 24 hours.
    4. Attaches the session ID via a secure, HTTP-only cookie.
    """
    # 1. Open an asynchronous network client to proxy credentials downstream
    async with httpx.AsyncClient() as client:
        try: 
            # Send verification POST request to the downstream User/Profile microservice
            auth_response = await client.post(
                "http://profile-service.zinder.internal/api/v1/users/verify",
                json=credentials.model_dump(),
                timeout=5.0
            ) 
            # If the downstream microservice reports verification failure, propagate the error response
            if auth_response.status_code != status.HTTP_200_OK:
                raise HTTPException(
                    status_code = auth_response.status_code,
                    detail = auth_response.json().get("detail", "Invalid user or password.")
                ) 
            # Parse verified user record returned from downstream service
            user_data = auth_response.json()
        except httpx.RequestError as exc:
            # Handle downstream microservice server down or connection timeout
            raise HTTPException(
                status_code = status.HTTP_503_SERVICE_UNAVAILABLE,
                detail = f"Profile Verification Service Unavailable: {exc}"
            ) 

    # 2. Generate a secure, unique user session ID
    session_id = str(uuid.uuid4())

    # 3. Create the session payload to cache in Redis
    session_payload = {
        "userId": user_data.get("id"),
        "email": user_data.get("email"),
        "role": user_data.get("role", "user")
    }

    # 4. Write session payload to Redis cache with 24 hours (86400 seconds) expiration
    try:
        await redis_client.set(
            name = f"session:{session_id}",
            value=json.dumps(session_payload),
            ex=86400
        ) 
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Session database write failed: {exc}"
        ) 
    
    # 5. Set HTTP-only Cookie containing the session ID in response headers
    response.set_cookie(
        key="sessionID",
        value=session_id,
        httponly=True,  # Blocks cross-site scripting (XSS) access to cookie
        secure=False,   # Set to True in HTTPS production environments
        samesite="lax", # Enforces lax cookie sharing rules (CSRF protection)
        max_age=86400   # 24 hour duration matching Redis cache expiration
    )

    return {
        "status": "success",
        "message": "User credentials verified. Session established.",
        "session_info": {
            "email": session_payload["email"]
        }
    }
    
# Downstream matcher service browse URL configuration placeholder
MATCHER_SERVICE_URL = "http://matcher-service.zinder.internal/api/v1/matcher/browse" 

@app.get("/api/v1/matcher/browse", status_code=status.HTTP_200_OK)
async def browse(session: Dict[str, Any] = Depends(validate_session)) -> Dict[str, Any]:
    """
    Protected browsing route.
    1. Validates the request sessionId cookie against Redis (via validate_session).
    2. Proxies the request to the Matcher Microservice, passing the authenticated userId.
    """
    # 1. Retrieve the userId from the validated session
    user_id = session.get("userId")
    if not user_id:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail="Session payload is missing user identification credentials"
        ) 
    
    # 2. Proxy request asynchronously to the Matcher Microservice
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "http://matcher-service.zinder.internal/api/v1/matcher/browse",
                params={"userId": user_id},  # Forward user identity for filtering swiped decks
                timeout=5.0
            ) 

            # 3. Handle downstream microservice failure states
            if response.status_code != status.HTTP_200_OK:
                raise HTTPException(
                    status_code = response.status_code,
                    detail = response.json().get("detail", "Matcher service error")
                )  

            # 4. Return matching cards payload
            return response.json()
        
        except httpx.RequestError as exc:
            # 5. Handle cases where the Matcher microservice node is offline
            raise HTTPException(
                status_code = status.HTTP_503_SERVICE_UNAVAILABLE,
                detail = f"Matcher Service Unavailable: {exc}"
            )   
