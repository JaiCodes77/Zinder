"""Password hashing with bcrypt and transparent SHA-256 → bcrypt migration."""

from __future__ import annotations

import hashlib
import re
from typing import Tuple

import bcrypt

_SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")


def hash_password(password: str) -> str:
    """Hash a password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def is_legacy_sha256(stored_hash: str) -> bool:
    return bool(stored_hash and _SHA256_HEX.match(stored_hash.strip().lower()))


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify password against bcrypt or legacy unsalted SHA-256.
    Returns True on match.
    """
    if not stored_hash:
        return False
    if is_legacy_sha256(stored_hash):
        candidate = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return candidate == stored_hash.lower()
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def verify_and_migrate(password: str, stored_hash: str) -> Tuple[bool, str | None]:
    """
    Verify password. If it matches a legacy SHA-256 hash, return a new bcrypt hash
    so the caller can persist the upgrade.

    Returns (ok, new_hash_or_None).
    """
    if not verify_password(password, stored_hash):
        return False, None
    if is_legacy_sha256(stored_hash):
        return True, hash_password(password)
    return True, None
