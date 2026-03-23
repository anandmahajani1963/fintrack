# ============================================================
# fintrack — FastAPI Backend Dockerfile
# File: /home/fintrack/fintrack/backend/Dockerfile
# ============================================================

FROM python:3.12-slim

# Metadata
LABEL maintainer="fintrack"
LABEL description="fintrack FastAPI backend"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Install system dependencies
# libpq-dev: PostgreSQL client library for psycopg2
# gcc: needed to compile some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user to run the app
RUN groupadd -r fintrack && useradd -r -g fintrack fintrack

# Set working directory
WORKDIR /app

# Copy and install Python dependencies first (layer caching —
# only re-runs if requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create log directory
RUN mkdir -p /var/log/fintrack \
    && chown -R fintrack:fintrack /var/log/fintrack /app

# Switch to non-root user
USER fintrack

# Expose API port
EXPOSE 8000

# Health check — calls the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI with uvicorn
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--log-level", "info"]

# Copy test suite
COPY tests/ ./tests/
