# ============================================================
# fintrack — Jupyter notebook shared configuration
# File: dev/notebooks/config.py
# Version: 1.0 — 2026-03-24
#
# Usage in any notebook:
#   import sys; sys.path.insert(0, '/home/fintrack/notebooks')
#   from config import API_BASE, EMAIL, PASSWORD, HEADERS, api_get
# ============================================================

import os
import httpx

API_BASE = f"http://{os.getenv('API_HOST', '192.168.1.170')}:{os.getenv('API_PORT', '8000')}"
EMAIL    = os.getenv('FINTRACK_EMAIL',    '')
PASSWORD = os.getenv('FINTRACK_PASSWORD', '')

if not EMAIL or not PASSWORD:
    raise EnvironmentError(
        "Set FINTRACK_EMAIL and FINTRACK_PASSWORD environment variables.\n"
        "In JupyterLab terminal: export FINTRACK_EMAIL=you@email.com\n"
        "Or add them to ~/fintrack/dev/.env and rebuild the container."
    )

# Authenticate and get token
_r = httpx.post(f'{API_BASE}/api/v1/auth/login',
                json={'email': EMAIL, 'password': PASSWORD}, timeout=10)
if _r.status_code != 200:
    raise RuntimeError(f'Login failed: {_r.text}')

TOKEN   = _r.json()['access_token']
USER_ID = _r.json()['user_id']
HEADERS = {'Authorization': f'Bearer {TOKEN}'}


def api_get(path: str, params: dict = None) -> dict:
    """GET request to fintrack API. Returns parsed JSON."""
    r = httpx.get(f'{API_BASE}{path}', headers=HEADERS,
                  params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def api_post(path: str, json: dict = None) -> dict:
    """POST request to fintrack API. Returns parsed JSON."""
    r = httpx.post(f'{API_BASE}{path}', headers=HEADERS,
                   json=json, timeout=15)
    r.raise_for_status()
    return r.json()


print(f'fintrack config loaded — API: {API_BASE}  User: {EMAIL}')
