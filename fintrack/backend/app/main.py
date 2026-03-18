# ============================================================
# fintrack — FastAPI application entry point
# File: /home/fintrack/fintrack/backend/app/main.py
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import json

from app.config import settings
from app.database import engine, check_db_connection

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("fintrack")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("fintrack API starting up...")
    if check_db_connection():
        logger.info("Database connection: OK")
    else:
        logger.error("Database connection: FAILED — check DB_HOST and credentials")
    yield
    # Shutdown
    logger.info("fintrack API shutting down...")


app = FastAPI(
    title="fintrack API",
    description="Personal finance tracking — zero-knowledge architecture",
    version="0.1.0",
    lifespan=lifespan,
    # Disable docs in production
    docs_url="/docs" if settings.API_ENV == "development" else None,
    redoc_url="/redoc" if settings.API_ENV == "development" else None,
)

# CORS middleware — restrict to configured origins
cors_origins = json.loads(settings.CORS_ORIGINS) if isinstance(settings.CORS_ORIGINS, str) else settings.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Routers ───────────────────────────────────────────────────────────────────
from app.routers import auth, transactions
app.include_router(auth.router,         prefix="/api/v1/auth",         tags=["auth"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
# Coming next:
# from app.routers import accounts, analytics, insights
# app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])


# ── Core endpoints ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health_check():
    """
    Health check endpoint — used by Docker healthcheck and load balancers.
    Returns database connectivity status.
    """
    db_ok = check_db_connection()
    status = "healthy" if db_ok else "degraded"
    return {
        "status":   status,
        "version":  "0.1.0",
        "database": "connected" if db_ok else "unreachable",
        "env":      settings.API_ENV,
    }


@app.get("/", tags=["system"])
async def root():
    return {
        "app":     "fintrack",
        "version": "0.1.0",
        "docs":    "/docs" if settings.API_ENV == "development" else "disabled",
    }
