# ============================================================
# fintrack — SQLAlchemy models: User, UserKey, Account
# File: backend/app/models/user.py
# ============================================================

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey,
    LargeBinary, Text, func
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
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    last_login    = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    key       = relationship("UserKey",  back_populates="user", uselist=False,
                             cascade="all, delete-orphan")
    accounts  = relationship("Account",  back_populates="user",
                             cascade="all, delete-orphan")
    categories= relationship("Category", back_populates="user",
                             cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} email={self.email}>"


class UserKey(Base):
    __tablename__ = "user_keys"

    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                        primary_key=True)
    kdf_salt   = Column(LargeBinary, nullable=False)
    key_check  = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now())

    user = relationship("User", back_populates="key")


class Account(Base):
    __tablename__ = "accounts"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    provider      = Column(String, nullable=False)
    account_label = Column(Text, nullable=False)   # encrypted
    member_name   = Column(Text, nullable=True)    # encrypted
    last_four     = Column(Text, nullable=True)    # encrypted
    is_active     = Column(Boolean, nullable=False, default=True)
    source_type   = Column(String, nullable=False, default="csv_import")
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    user         = relationship("User",        back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account",
                                cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Account id={self.id} provider={self.provider}>"
