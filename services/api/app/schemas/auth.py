from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=255)


class UserLogin(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


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


class UserPreferenceRead(BaseModel):
    language: str
    timezone: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class AuthStatus(BaseModel):
    user: UserRead
    preference: UserPreferenceRead


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, pattern=r"^(user|admin)$")
    is_active: bool | None = None


class PreferenceUpdate(BaseModel):
    language: str | None = Field(default=None, pattern=r"^(en|vi)$")
    timezone: str | None = Field(default=None, max_length=50)


class GoogleAuthUrlResponse(BaseModel):
    authorization_url: str
