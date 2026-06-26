# ============================================================
# fintrack — JupyterLab Dev/Test VM Dockerfile
# File: /home/fintrack/fintrack/dev/Dockerfile
# ============================================================

FROM python:3.12-slim

LABEL maintainer="fintrack"
LABEL description="fintrack JupyterLab — dev, testing, and data exploration"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    JUPYTER_ENABLE_LAB=yes

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/fintrack

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy notebooks and shared code
COPY notebooks/ ./notebooks/
COPY shared/    ./shared/

# Jupyter config — disable token in dev (use password instead)
RUN jupyter lab --generate-config && \
    echo "c.ServerApp.ip = '0.0.0.0'" >> /root/.jupyter/jupyter_lab_config.py && \
    echo "c.ServerApp.port = 8888" >> /root/.jupyter/jupyter_lab_config.py && \
    echo "c.ServerApp.open_browser = False" >> /root/.jupyter/jupyter_lab_config.py && \
    echo "c.ServerApp.root_dir = '/home/fintrack/notebooks'" >> /root/.jupyter/jupyter_lab_config.py

EXPOSE 8888

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8888/api || exit 1

CMD ["jupyter", "lab", "--allow-root"]
