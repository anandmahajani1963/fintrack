# ============================================================
# fintrack — FastAPI application entry point
# File: backend/app/main.py
# Version: 1.2 — 2026-03-30
# Changes:
#   v1.0  2026-03-17  Initial implementation
#   v1.1  2026-03-22  Added analytics and transactions routers
#   v1.2  2026-03-30  Added X-Fintrack-Password to CORS allowed headers
#   v1.3  2026-04-05  Added budget router
#   v1.4  2026-04-06  Added MFA router
#                     so browser can send password as header not query param
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import json

from app.config import settings
from app.database import engine, check_db_connection

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("fintrack")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("fintrack API starting up...")
    if check_db_connection():
        logger.info("Database connection: OK")
    else:
        logger.error("Database connection: FAILED")
    yield
    logger.info("fintrack API shutting down...")


app = FastAPI(
    title="fintrack API",
    description="Personal finance tracking — zero-knowledge architecture",
    version="0.2.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.API_ENV == "development" else None,
    redoc_url="/redoc" if settings.API_ENV == "development" else None,
)

cors_origins = json.loads(settings.CORS_ORIGINS) if isinstance(settings.CORS_ORIGINS, str) \
               else settings.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Fintrack-Password",   # custom header for key derivation password
    ],
    expose_headers=["X-Fintrack-Password"],
)

from app.routers import auth, transactions, analytics, budget, mfa
app.include_router(auth.router,         prefix="/api/v1/auth",         tags=["auth"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(analytics.router,    prefix="/api/v1/analytics",    tags=["analytics"])
app.include_router(budget.router,       prefix="/api/v1/budget",       tags=["budget"])
app.include_router(mfa.router,         prefix="/api/v1/mfa",         tags=["mfa"])


@app.get("/health", tags=["system"])
async def health_check():
    db_ok  = check_db_connection()
    status = "healthy" if db_ok else "degraded"
    return {
        "status":   status,
        "version":  "0.2.0",
        "database": "connected" if db_ok else "unreachable",
        "env":      settings.API_ENV,
    }


@app.get("/", tags=["system"])
async def root():
    return {
        "app":     "fintrack",
        "version": "0.2.0",
        "docs":    "/docs" if settings.API_ENV == "development" else "disabled",
    }
