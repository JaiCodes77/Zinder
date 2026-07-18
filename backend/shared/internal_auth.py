"""Shared internal-service authentication (gateway ↔ microservices)."""

from __future__ import annotations

import os
from typing import Optional, Tuple

from fastapi import Header, HTTPException, status

_DEFAULT_SECRET = "zinder-dev-internal-secret-change-me"


def get_internal_secret() -> str:
    return os.getenv("INTERNAL_SERVICE_SECRET", _DEFAULT_SECRET)


# Back-compat alias (evaluated at import; prefer get_internal_secret())
INTERNAL_SERVICE_SECRET = get_internal_secret()


def require_internal_secret(
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
) -> None:
    """Reject requests that do not present the shared gateway↔service secret."""
    if not x_internal_secret or x_internal_secret != get_internal_secret():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid internal service credentials.",
        )


def require_internal_user(
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> int:
    """
    Validate the shared internal secret AND a numeric X-User-Id.
    Prevents direct spoofing of X-User-Id without the secret.
    """
    require_internal_secret(x_internal_secret)
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id header.",
        )
    try:
        return int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-User-Id header format.",
        )


def internal_headers(user_id: int | str | None = None) -> dict:
    """Build headers for gateway → service httpx calls."""
    headers = {"X-Internal-Secret": get_internal_secret()}
    if user_id is not None:
        headers["X-User-Id"] = str(user_id)
    return headers


def parse_user_id_header(x_user_id: Optional[str]) -> Tuple[Optional[int], Optional[str]]:
    """Legacy helper — prefer require_internal_user for new code."""
    if not x_user_id:
        return None, "Missing X-User-Id header."
    try:
        return int(x_user_id), None
    except ValueError:
        return None, "Invalid X-User-Id header format."
