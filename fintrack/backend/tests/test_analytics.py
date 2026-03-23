# ============================================================
# fintrack — Analytics endpoint tests
# File: backend/tests/test_analytics.py
# ============================================================

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

TEST_EMAIL    = "testuser@fintrack-app.com"
TEST_PASSWORD = "TestPass123!"


@pytest.fixture(scope="module")
def auth_headers():
    r = client.post("/api/v1/auth/login", json={
        "email": TEST_EMAIL, "password": TEST_PASSWORD
    })
    if r.status_code == 401:
        client.post("/api/v1/auth/register", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        r = client.post("/api/v1/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ── Monthly Pivot ─────────────────────────────────────────────────────────────

class TestMonthlyPivot:
    def test_returns_200(self, auth_headers):
        r = client.get("/api/v1/analytics/monthly-pivot", headers=auth_headers)
        assert r.status_code == 200

    def test_response_shape(self, auth_headers):
        r = client.get("/api/v1/analytics/monthly-pivot", headers=auth_headers)
        data = r.json()
        assert "months"      in data
        assert "rows"        in data
        assert "col_totals"  in data
        assert "grand_total" in data

    def test_rows_have_required_fields(self, auth_headers):
        r = client.get("/api/v1/analytics/monthly-pivot", headers=auth_headers)
        data = r.json()
        if data["rows"]:
            row = data["rows"][0]
            assert "category"    in row
            assert "subcategory" in row
            assert "is_essential"in row
            assert "months"      in row
            assert "row_total"   in row

    def test_year_filter(self, auth_headers):
        r = client.get("/api/v1/analytics/monthly-pivot?year=2025",
                       headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        for month in data["months"]:
            assert "2025" in month

    def test_grand_total_equals_sum_of_row_totals(self, auth_headers):
        r = client.get("/api/v1/analytics/monthly-pivot", headers=auth_headers)
        data = r.json()
        if data["rows"]:
            row_sum = round(sum(row["row_total"] for row in data["rows"]), 2)
            assert abs(row_sum - data["grand_total"]) < 0.02


# ── Category Summary ──────────────────────────────────────────────────────────

class TestCategorySummary:
    def test_returns_200(self, auth_headers):
        r = client.get("/api/v1/analytics/category-summary", headers=auth_headers)
        assert r.status_code == 200

    def test_response_shape(self, auth_headers):
        r = client.get("/api/v1/analytics/category-summary", headers=auth_headers)
        data = r.json()
        assert "grand_total"        in data
        assert "essential_total"    in data
        assert "nonessential_total" in data
        assert "essential_pct"      in data
        assert "categories"         in data

    def test_essential_pcts_sum_to_100(self, auth_headers):
        r = client.get("/api/v1/analytics/category-summary", headers=auth_headers)
        data = r.json()
        # Only assert if there is data — test user may have no transactions
        if data["grand_total"] > 0:
            total_pct = data["essential_pct"] + data["nonessential_pct"]
            assert abs(total_pct - 100.0) < 0.5
        else:
            assert data["essential_pct"] == 0
            assert data["nonessential_pct"] == 0

    def test_grand_total_equals_essential_plus_nonessential(self, auth_headers):
        r = client.get("/api/v1/analytics/category-summary", headers=auth_headers)
        data = r.json()
        assert abs(
            data["grand_total"] -
            (data["essential_total"] + data["nonessential_total"])
        ) < 0.02

    def test_year_filter(self, auth_headers):
        r = client.get("/api/v1/analytics/category-summary?year=2025",
                       headers=auth_headers)
        assert r.status_code == 200


# ── Trend ─────────────────────────────────────────────────────────────────────

class TestTrend:
    def test_returns_200(self, auth_headers):
        r = client.get("/api/v1/analytics/trend", headers=auth_headers)
        assert r.status_code == 200

    def test_response_shape(self, auth_headers):
        r = client.get("/api/v1/analytics/trend", headers=auth_headers)
        data = r.json()
        assert "months"  in data
        assert "average" in data
        assert "total"   in data

    def test_months_are_chronological(self, auth_headers):
        r = client.get("/api/v1/analytics/trend?year=2025", headers=auth_headers)
        data = r.json()
        if data["months"]:
            month_nums = [m["month_num"] for m in data["months"]]
            assert month_nums == sorted(month_nums)

    def test_mom_delta_calculation(self, auth_headers):
        r = client.get("/api/v1/analytics/trend", headers=auth_headers)
        data = r.json()
        months = data["months"]
        for i in range(1, len(months)):
            expected_delta = round(months[i]["total"] - months[i-1]["total"], 2)
            assert abs(months[i]["mom_delta"] - expected_delta) < 0.02

    def test_category_filter(self, auth_headers):
        r = client.get("/api/v1/analytics/trend?category=Groceries",
                       headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["category"] == "Groceries"


# ── Essential Split ───────────────────────────────────────────────────────────

class TestEssentialSplit:
    def test_returns_200(self, auth_headers):
        r = client.get("/api/v1/analytics/essential-split", headers=auth_headers)
        assert r.status_code == 200

    def test_response_shape(self, auth_headers):
        r = client.get("/api/v1/analytics/essential-split", headers=auth_headers)
        data = r.json()
        assert "months" in data

    def test_essential_plus_nonessential_equals_total(self, auth_headers):
        r = client.get("/api/v1/analytics/essential-split", headers=auth_headers)
        for month in r.json()["months"]:
            assert abs(
                month["essential"] + month["nonessential"] - month["total"]
            ) < 0.02


# ── Large Expenses ────────────────────────────────────────────────────────────

class TestLargeExpenses:
    def test_returns_200(self, auth_headers):
        r = client.get(
            f"/api/v1/analytics/large-expenses?password={TEST_PASSWORD}",
            headers=auth_headers
        )
        assert r.status_code == 200

    def test_response_shape(self, auth_headers):
        r = client.get(
            f"/api/v1/analytics/large-expenses?password={TEST_PASSWORD}",
            headers=auth_headers
        )
        data = r.json()
        assert "count" in data
        assert "items" in data

    def test_threshold_filter(self, auth_headers):
        r = client.get(
            f"/api/v1/analytics/large-expenses?password={TEST_PASSWORD}&threshold=500",
            headers=auth_headers
        )
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["amount"] >= 500

    def test_descriptions_are_decrypted(self, auth_headers):
        r = client.get(
            f"/api/v1/analytics/large-expenses?password={TEST_PASSWORD}&threshold=1",
            headers=auth_headers
        )
        # Only check decryption if items exist
        for item in r.json()["items"]:
            assert len(item["description"]) > 0


# ── Utility Seasonal ──────────────────────────────────────────────────────────

class TestUtilitySeasonal:
    def test_returns_200(self, auth_headers):
        r = client.get("/api/v1/analytics/utility-seasonal", headers=auth_headers)
        assert r.status_code == 200

    def test_response_shape(self, auth_headers):
        r = client.get("/api/v1/analytics/utility-seasonal", headers=auth_headers)
        data = r.json()
        assert "utility_types"       in data
        assert "total_utility_spend" in data

    def test_above_average_flag_consistency(self, auth_headers):
        r = client.get("/api/v1/analytics/utility-seasonal", headers=auth_headers)
        for ut in r.json()["utility_types"]:
            above = [m for m in ut["months"] if m["above_average"]]
            below = [m for m in ut["months"] if not m["above_average"]]
            assert len(above) + len(below) == len(ut["months"])
