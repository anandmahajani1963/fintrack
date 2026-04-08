# ============================================================
# fintrack — Pydantic schemas: Auth
# File: backend/app/schemas/auth.py
# ============================================================

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re


class RegisterRequest(BaseModel):
    email:    EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 10:
            raise ValueError("Password must be at least 10 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user_id:       str
    email:         str
    mfa_required:  bool = False
    mfa_type:      str  = "none"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id:         str
    email:      str
    is_active:  bool
    created_at: str

    class Config:
        from_attributes = True
