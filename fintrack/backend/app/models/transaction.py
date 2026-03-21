# ============================================================
# fintrack — SQLAlchemy models: Transaction, Category, Threshold
# File: backend/app/models/transaction.py
# ============================================================

from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, Numeric,
    SmallInteger, Text, ForeignKey, ARRAY, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    name         = Column(String, nullable=False)
    is_essential = Column(Boolean, nullable=False, default=False)
    color_code   = Column(String, nullable=False, default="#808080")
    keywords     = Column(ARRAY(Text), nullable=False, default=list)
    sort_order   = Column(SmallInteger, nullable=False, default=99)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    user         = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category_rel",
                                foreign_keys="Transaction.category_id")

    def __repr__(self):
        return f"<Category name={self.name} essential={self.is_essential}>"


class Transaction(Base):
    __tablename__ = "transactions"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id    = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    txn_date      = Column(Date, nullable=False)
    # month_num and year_num are GENERATED columns in PostgreSQL —
    # do NOT insert them; they are populated automatically by the DB
    month_num     = Column(SmallInteger, nullable=False)
    year_num      = Column(SmallInteger, nullable=False)
    amount        = Column(Numeric(12, 2), nullable=False)
    description   = Column(Text, nullable=False)   # encrypted
    category_id   = Column(UUID(as_uuid=True), ForeignKey("categories.id",
                           ondelete="SET NULL"), nullable=True)
    category_name = Column(String, nullable=False, default="Other")
    is_essential  = Column(Boolean, nullable=False, default=False)
    is_large      = Column(Boolean, nullable=False, default=False)
    source_file   = Column(String, nullable=True)
    source_type   = Column(String, nullable=False, default="csv_import")
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    account      = relationship("Account",  back_populates="transactions")
    category_rel = relationship("Category", back_populates="transactions",
                                foreign_keys=[category_id])

    def __repr__(self):
        return f"<Transaction date={self.txn_date} amount={self.amount} cat={self.category_name}>"


class ExpenseThreshold(Base):
    __tablename__ = "expense_thresholds"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    category_name = Column(String, nullable=False, default="ALL")
    threshold     = Column(Numeric(12, 2), nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
