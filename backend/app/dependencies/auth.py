from typing import AsyncGenerator, Dict, Any
import json
from fastapi import Request, Depends, Cookie, HTTPException, status
import redis.asyncio as redis

# A global dictionary fallback in case Redis connection is not established or fails
MEMORY_SESSIONS: Dict[str, str] = {}

async def get_redis(request: Request) -> AsyncGenerator[redis.Redis | None, None]:
    """
    Yields an active Redis client using the connection pool.
    If Redis connection fails or pool is not initialized, yields None to indicate fallback.
    """
    pool = getattr(request.app.state, "redis_pool", None)
    if pool is None:
        yield None
        return
        
    client = redis.Redis(connection_pool=pool)
    is_alive = False
    try:
        # Ping to verify active connection
        await client.ping()
        is_alive = True
    except Exception:
        pass

    if is_alive:
        try:
            yield client
        finally:
            try:
                await client.close()
            except Exception:
                pass
    else:
        try:
            await client.close()
        except Exception:
            pass
        yield None

async def validate_session(
    request: Request,
    sessionId: str | None = Cookie(default=None, alias="sessionId"),
    redis_client: redis.Redis | None = Depends(get_redis)
) -> Dict[str, Any]:
    """
    Extracts sessionId cookie, verifies session payload against Redis (or MEMORY_SESSIONS fallback),
    and returns the session payload.
    Raises 401 HTTPException if session is invalid, expired, or missing.
    """
    if not sessionId:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication session cookie missing"
        )

    session_data = None

    if redis_client is not None:
        try:
            session_bytes = await redis_client.get(f"session:{sessionId}")
            if session_bytes:
                session_data = json.loads(session_bytes.decode("utf-8"))
        except Exception:
            # Fallback to memory if Redis fetch fails midway
            pass

    if session_data is None:
        # Try finding it in memory sessions
        memory_sessions = getattr(request.app.state, "memory_sessions", MEMORY_SESSIONS)
        session_str = memory_sessions.get(f"session:{sessionId}")
        if session_str:
            try:
                session_data = json.loads(session_str)
            except Exception:
                pass

    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication session has expired or is invalid"
        )

    if not isinstance(session_data, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication session data"
        )

    return session_data
