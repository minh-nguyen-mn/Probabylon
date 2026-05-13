from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(default="", max_length=255)


class UserLogin(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    password: str


class GoogleAuth(BaseModel):
    id_token: str
    username: str | None = None
    password: str | None = None
    name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class UserRead(BaseModel):
    id: str
    email: str
    username: str | None = None
    name: str
    role: str
    avatar_url: str | None = None
    is_active: bool
    google_id: str | None = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
