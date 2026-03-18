# ============================================================
# fintrack — Auth endpoint tests
# File: backend/tests/test_auth.py
#
# Run: docker exec fintrack_api pytest tests/test_auth.py -v
# ============================================================

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# ── Fixtures ──────────────────────────────────────────────────────────────────

TEST_EMAIL    = "testuser@fintrack.test"
TEST_PASSWORD = "TestPass123!"


@pytest.fixture(scope="module")
def registered_user():
    """Register a test user and return the token response."""
    response = client.post("/api/v1/auth/register", json={
        "email":    TEST_EMAIL,
        "password": TEST_PASSWORD,
    })
    # Accept 201 (created) or 409 (already exists from prior run)
    assert response.status_code in (201, 409), response.text
    if response.status_code == 409:
        # Login instead
        resp = client.post("/api/v1/auth/login", json={
            "email":    TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert resp.status_code == 200
        return resp.json()
    return response.json()


@pytest.fixture
def access_token(registered_user):
    return registered_user["access_token"]


@pytest.fixture
def auth_headers(access_token):
    return {"Authorization": f"Bearer {access_token}"}


# ── Registration tests ────────────────────────────────────────────────────────

class TestRegister:
    def test_register_success(self):
        import uuid
        unique_email = f"new_{uuid.uuid4().hex[:8]}@test.com"
        r = client.post("/api/v1/auth/register", json={
            "email":    unique_email,
            "password": "NewPass456!",
        })
        assert r.status_code == 201
        data = r.json()
        assert "access_token"  in data
        assert "refresh_token" in data
        assert data["email"]   == unique_email

    def test_register_duplicate_email(self, registered_user):
        r = client.post("/api/v1/auth/register", json={
            "email":    TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert r.status_code == 409

    def test_register_weak_password_too_short(self):
        r = client.post("/api/v1/auth/register", json={
            "email":    "weak@test.com",
            "password": "abc",
        })
        assert r.status_code == 422

    def test_register_weak_password_no_uppercase(self):
        r = client.post("/api/v1/auth/register", json={
            "email":    "weak2@test.com",
            "password": "alllowercase1",
        })
        assert r.status_code == 422

    def test_register_invalid_email(self):
        r = client.post("/api/v1/auth/register", json={
            "email":    "not-an-email",
            "password": "ValidPass1!",
        })
        assert r.status_code == 422


# ── Login tests ───────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self):
        r = client.post("/api/v1/auth/login", json={
            "email":    TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token"  in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self):
        r = client.post("/api/v1/auth/login", json={
            "email":    TEST_EMAIL,
            "password": "WrongPassword1!",
        })
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = client.post("/api/v1/auth/login", json={
            "email":    "nobody@nowhere.com",
            "password": TEST_PASSWORD,
        })
        assert r.status_code == 401

    def test_login_returns_same_error_for_both_failures(self):
        """Security: wrong email and wrong password must return identical responses."""
        r1 = client.post("/api/v1/auth/login", json={
            "email": "nobody@nowhere.com", "password": "WrongPass1!"
        })
        r2 = client.post("/api/v1/auth/login", json={
            "email": TEST_EMAIL, "password": "WrongPass1!"
        })
        assert r1.status_code == r2.status_code == 401
        assert r1.json()["detail"] == r2.json()["detail"]


# ── Protected endpoint tests ──────────────────────────────────────────────────

class TestProtectedEndpoints:
    def test_get_me_authenticated(self, auth_headers):
        r = client.get("/api/v1/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == TEST_EMAIL
        assert "id" in data
        assert data["is_active"] is True

    def test_get_me_no_token(self):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 403

    def test_get_me_invalid_token(self):
        r = client.get("/api/v1/auth/me",
                       headers={"Authorization": "Bearer invalidtoken"})
        assert r.status_code == 401

    def test_refresh_token(self, registered_user):
        r = client.post("/api/v1/auth/refresh", json={
            "refresh_token": registered_user["refresh_token"]
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_refresh_with_access_token_fails(self, access_token):
        """Access tokens must not be accepted as refresh tokens."""
        r = client.post("/api/v1/auth/refresh", json={
            "refresh_token": access_token
        })
        assert r.status_code == 401


# ── Health check ──────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] in ("healthy", "degraded")
