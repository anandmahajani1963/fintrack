# ============================================================
# fintrack — SQLAlchemy models: User, UserKey, Account
# File: backend/app/models/user.py
# Version: 1.1 — 2026-04-06
# Changes:
#   v1.0  2026-03-18  Initial implementation
#   v1.1  2026-04-06  Added MFA columns: mfa_type, mfa_enabled,
#                     mfa_verified, totp_secret
#                     Added EmailOTP model for email-based MFA
# ============================================================

from sqlalchemy import (
    Column, String, Boolean, DateTime, Text,
    ForeignKey, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email         = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    is_active     = Column(Boolean, nullable=False, default=True)

    # MFA fields
    mfa_type      = Column(String, nullable=False, default='none')
    mfa_enabled   = Column(Boolean, nullable=False, default=False)
    mfa_verified  = Column(Boolean, nullable=False, default=False)
    totp_secret   = Column(Text, nullable=True)

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    last_login    = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    keys         = relationship("UserKey",         back_populates="user",
                                cascade="all, delete-orphan")
    accounts     = relationship("Account",         back_populates="user",
                                cascade="all, delete-orphan")
    categories   = relationship("Category",        back_populates="user",
                                cascade="all, delete-orphan")
    transactions = relationship("Transaction",     back_populates="user",
                                cascade="all, delete-orphan",
                                foreign_keys="Transaction.user_id")

    def __repr__(self):
        return f"<User id={self.id} email={self.email} mfa={self.mfa_type}>"


class UserKey(Base):
    __tablename__ = "user_keys"

    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         primary_key=True, nullable=False)
    kdf_salt    = Column(Text, nullable=False)
    key_check   = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="keys")


class Account(Base):
    __tablename__ = "accounts"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    provider    = Column(String, nullable=False)
    label       = Column(String, nullable=True)
    member_name = Column(Text, nullable=True)
    source      = Column(String, nullable=False, default='csv_import')
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user         = relationship("User",        back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account",
                                cascade="all, delete-orphan")


class EmailOTP(Base):
    __tablename__ = "email_otp"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    code       = Column(Text, nullable=False)
    purpose    = Column(String, nullable=False, default='login')
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used       = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
