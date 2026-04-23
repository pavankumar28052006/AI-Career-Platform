"""User Pydantic models."""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Request body for POST /api/auth/register."""

    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=128)


class UserLogin(BaseModel):
    """Request body for POST /api/auth/login."""

    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Public user representation (no password)."""

    id: str
    email: EmailStr
    full_name: str


class UserInDB(UserOut):
    """Internal representation that includes the hashed password."""

    hashed_password: str
