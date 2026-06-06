from typing import AsyncGenerator, Dict, Any
import json
from fastapi import Request, Depends, Cookie, HTTPException, status
import redis.asyncio as redis

async def get_redis(request: Request) -> AsyncGenerator[redis.Redis, None]:
    """
    Yields an active Redis client using the connection pool initialized in app state.
    """
    pool = getattr(request.app.state, "redis_pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Redis connection pool not initialized"
        )
    client = redis.Redis(connection_pool=pool)
    try:
        yield client
    finally:
        await client.close()

async def validate_session(
    sessionId: str | None = Cookie(default=None),
    redis_client: redis.Redis = Depends(get_redis)
) -> Dict[str, Any]:
    """
    Extracts sessionId cookie, verifies session payload against Redis, and returns the session payload.
    Raises 401 HTTPException if session is invalid, expired, or missing.
    """
    if not sessionId:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication session cookie missing"
        )

    session_bytes = await redis_client.get(f"session:{sessionId}")
    if not session_bytes:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication session has expired or is invalid"
        )

    try:
        session_data = json.loads(session_bytes.decode("utf-8"))
        if not isinstance(session_data, dict):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed authentication session data"
            )
        return session_data
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication session data"
        )
