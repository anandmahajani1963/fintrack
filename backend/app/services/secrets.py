# ============================================================
# fintrack — AWS Secrets Manager helper
# File: backend/app/services/secrets.py
# Tries Secrets Manager first, falls back to environment variables.
# Works identically in local dev (no AWS) and production (with AWS).
# ============================================================

import os
import logging

logger = logging.getLogger(__name__)

_cache = {}

def get_secret(secret_name: str, env_var: str) -> str:
    """
    Fetch a secret value. Priority:
    1. In-memory cache (already fetched this run)
    2. AWS Secrets Manager (production)
    3. Environment variable (fallback / local dev)
    """
    if secret_name in _cache:
        return _cache[secret_name]

    # Try Secrets Manager
    try:
        import boto3
        client = boto3.client("secretsmanager", region_name="us-east-1")
        response = client.get_secret_value(SecretId=secret_name)
        value = response["SecretString"]
        _cache[secret_name] = value
        logger.info(f"Secret '{secret_name}' loaded from Secrets Manager")
        return value
    except Exception as e:
        logger.debug(f"Secrets Manager unavailable for '{secret_name}': {e}")

    # Fall back to environment variable
    value = os.environ.get(env_var, "")
    if value:
        logger.info(f"Secret '{secret_name}' loaded from env var {env_var}")
        _cache[secret_name] = value
    else:
        logger.warning(f"Secret '{secret_name}' not found in Secrets Manager or env var {env_var}")

    return value
