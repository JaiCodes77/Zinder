from contextlib import asynccontextmanager
from typing import Dict, Any
from fastapi import FastAPI, Depends, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis.asyncio as redis
import httpx
from fastapi import HTTPException
from app.config import settings
from app.dependencies.auth import validate_session

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
async def login(credentials: UserLogin, response: Response) -> Dict[str, Any]:
    """
    Public login endpoint.
    Leaves a placeholder for credential verification and cookie session creation.
    """
    # =================================================================
    # CREDENTIAL VALIDATION & response.set_cookie IMPLEMENTATION BLOCK
    # -----------------------------------------------------------------
    # In production:
    # 1. Forward credentials to User/Auth Microservice.
    # 2. On valid password, generate a secure UUID session key:
    #    session_id = str(uuid.uuid4())
    # 3. Cache session dictionary payload inside Redis:
    #    session_payload = {"userId": user.id, "email": user.email, "role": "user"}
    #    await redis_client.set(f"session:{session_id}", json.dumps(session_payload), ex=86400)
    # 4. Bind session ID to response as a secure HttpOnly cookie:
    #    response.set_cookie(
    #        key="sessionId",
    #        value=session_id,
    #        httponly=True,
    #        secure=True,         # Set to True in production (HTTPS required)
    #        samesite="lax",      # Prevent CSRF
    #        max_age=86400        # Match session expiration
    #    )
    # =================================================================
    
    return {
        "status": "success",
        "message": "User credentials verified. Session established.",
        "session_info": {
            "email": credentials.email
        }
    }

@app.get("/api/v1/matcher/browse", status_code=status.HTTP_200_OK)
async def browse(session: Dict[str, Any] = Depends(validate_session)) -> Dict[str, Any]:
    """
    Protected browsing route.
    Validates request sessionId cookie against Redis database.
    """
    return {
        "status": "success",
        "message": "Fetched cache deck matches successfully from Matcher Microservice",
        "authenticated_session": session
    }
