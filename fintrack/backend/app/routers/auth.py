# ============================================================
# fintrack — Auth router: /api/v1/auth
# File: backend/app/routers/auth.py
#
# Version History:
#   v1.0  2026-03-18  Initial implementation
#                     register, login, refresh, /me endpoints
#                     Argon2id password hashing, JWT access + refresh tokens
#                     Zero-knowledge key derivation (kdf_salt + key_check)
#                     Default categories seeded on registration
#
# Endpoints:
#   POST /api/v1/auth/register   create account + seed categories
#   POST /api/v1/auth/login      authenticate, return tokens
#   POST /api/v1/auth/refresh    exchange refresh token for new access token
#   GET  /api/v1/auth/me         return current user profile
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging

from app.database import get_db
from app.models.user import User, UserKey
from app.models.transaction import Category
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, UserResponse
)
from app.services.encryption import (
    hash_password, verify_password,
    generate_kdf_salt, derive_key, make_key_check
)
from app.services.token import (
    create_access_token, create_refresh_token,
    get_user_id_from_token
)
from app.services.auth import CurrentUser
from sqlalchemy import text

logger = logging.getLogger("fintrack.auth")
router = APIRouter()


def _seed_categories_for_user(user_id, db: Session):
    """Copy default_categories into the user's categories table on first registration."""
    defaults = db.execute(
        text("SELECT name, is_essential, color_code, keywords, sort_order FROM default_categories")
    ).fetchall()

    for row in defaults:
        cat = Category(
            user_id      = user_id,
            name         = row.name,
            is_essential = row.is_essential,
            color_code   = row.color_code,
            keywords     = list(row.keywords),
            sort_order   = row.sort_order,
        )
        db.add(cat)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user.
    - Hashes password with Argon2id
    - Derives encryption key and stores key material (never the key itself)
    - Seeds default categories for the user
    - Returns access + refresh tokens
    """
    # Check email not already taken
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create user
    user = User(
        email         = req.email,
        password_hash = hash_password(req.password),
    )
    db.add(user)
    db.flush()  # get user.id without committing

    # Derive encryption key and store salt + key_check
    salt = generate_kdf_salt()
    key  = derive_key(req.password, salt)
    user_key = UserKey(
        user_id   = user.id,
        kdf_salt  = salt,
        key_check = make_key_check(key),
    )
    db.add(user_key)

    # Seed default categories
    _seed_categories_for_user(user.id, db)

    db.commit()
    db.refresh(user)

    logger.info(f"New user registered: {user.email} (id={user.id})")

    return TokenResponse(
        access_token  = create_access_token(str(user.id)),
        refresh_token = create_refresh_token(str(user.id)),
        user_id       = str(user.id),
        email         = user.email,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user.
    Returns access + refresh tokens on success.
    Always returns 401 for wrong email or wrong password
    (never reveal which one is wrong).
    """
    user = db.query(User).filter(
        User.email    == req.email,
        User.is_active == True,
    ).first()

    # Constant-time: always verify even if user not found
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    logger.info(f"User logged in: {user.email}")

    return TokenResponse(
        access_token  = create_access_token(str(user.id)),
        refresh_token = create_refresh_token(str(user.id)),
        user_id       = str(user.id),
        email         = user.email,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access token."""
    from app.services.token import decode_token
    payload = decode_token(req.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return TokenResponse(
        access_token  = create_access_token(str(user.id)),
        refresh_token = create_refresh_token(str(user.id)),
        user_id       = str(user.id),
        email         = user.email,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: CurrentUser):
    """Return the currently authenticated user's profile."""
    return UserResponse(
        id         = str(current_user.id),
        email      = current_user.email,
        is_active  = current_user.is_active,
        created_at = current_user.created_at.isoformat(),
    )
