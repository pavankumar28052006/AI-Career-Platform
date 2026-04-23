"""Authentication router — register and login endpoints."""

import uuid

from fastapi import APIRouter, status

from core.errors import ErrorCode, raise_error
from core.logging import get_logger
from core.security import create_access_token, hash_password, verify_password
from db.neo4j_client import run_query
from models.user import UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger(__name__)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate) -> UserOut:
    """Register a new user. Returns the created user (no password)."""
    # Check for existing email
    existing = await run_query(
        "MATCH (u:User {email: $email}) RETURN u.id AS id LIMIT 1",
        {"email": body.email},
    )
    if existing:
        raise_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.AUTH_USER_ALREADY_EXISTS,
            f"An account with email '{body.email}' already exists.",
        )

    user_id = str(uuid.uuid4())
    hashed = hash_password(body.password)

    await run_query(
        """
        CREATE (u:User {
            id: $id,
            email: $email,
            full_name: $full_name,
            hashed_password: $hashed_password
        })
        """,
        {
            "id": user_id,
            "email": body.email,
            "full_name": body.full_name,
            "hashed_password": hashed,
        },
    )
    logger.info("User registered", extra={"user_id": user_id})
    return UserOut(id=user_id, email=body.email, full_name=body.full_name)


@router.post("/login")
async def login(body: UserLogin) -> dict:
    """Authenticate a user and return a JWT access token."""
    records = await run_query(
        """
        MATCH (u:User {email: $email})
        RETURN u.id AS id, u.email AS email,
               u.full_name AS full_name,
               u.hashed_password AS hashed_password
        LIMIT 1
        """,
        {"email": body.email},
    )
    if not records:
        raise_error(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.AUTH_INVALID_CREDENTIALS,
            "Email or password is incorrect.",
        )

    user = records[0]
    if not verify_password(body.password, user["hashed_password"]):
        raise_error(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.AUTH_INVALID_CREDENTIALS,
            "Email or password is incorrect.",
        )

    token = create_access_token(subject=user["id"])
    logger.info("User logged in", extra={"user_id": user["id"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
        },
    }
