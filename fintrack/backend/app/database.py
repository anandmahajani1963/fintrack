# ============================================================
# fintrack — Database connection and session management
# File: /home/fintrack/fintrack/backend/app/database.py
# ============================================================

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.exc import OperationalError
import logging

from app.config import settings

logger = logging.getLogger("fintrack.database")

# Create engine — pool_pre_ping checks connection health before use
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    echo=(settings.API_ENV == "development"),  # log SQL in dev only
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


def get_db():
    """
    FastAPI dependency — yields a database session per request,
    always closes it on completion.

    Usage in a router:
        from app.database import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """
    Verify database is reachable — used by health check endpoint
    and startup logging.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except OperationalError as e:
        logger.error(f"Database connection failed: {e}")
        return False
