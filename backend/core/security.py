"""JWT authentication and bcrypt password hashing utilities."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt

from core.config import get_settings
from core.errors import ErrorCode, raise_error

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(plain: str) -> str:
    """Return bcrypt hash of *plain* text password."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify *plain* against *hashed*. Returns True on match."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT with *subject* as the ``sub`` claim."""
    settings = get_settings()
    delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + delta
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT. Raises 401 on failure."""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise_error(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.AUTH_INVALID_TOKEN,
            "Token is invalid or has expired.",
        )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """FastAPI dependency that returns the current user's ID (JWT ``sub``)."""
    payload = decode_access_token(token)
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise_error(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.AUTH_INVALID_TOKEN,
            "Token payload is missing subject.",
        )
    return user_id
