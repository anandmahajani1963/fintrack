# ============================================================
# fintrack — Budget router: /api/v1/budget
# File: backend/app/routers/budget.py
# Version: 1.0 — 2026-04-05
#
# Endpoints:
#   GET  /api/v1/budget/thresholds        list all thresholds
#   PUT  /api/v1/budget/thresholds        upsert a threshold
#   DELETE /api/v1/budget/thresholds/{id} delete a threshold
#   GET  /api/v1/budget/status            actuals vs thresholds
# ============================================================

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import UserKey
from app.models.transaction import ExpenseThreshold
from app.services.auth import CurrentUser

router = APIRouter()


class ThresholdUpsert(BaseModel):
    category_name: str
    subcategory:   Optional[str] = None
    period:        str = 'monthly'   # 'monthly' or 'annual'
    threshold:     float


# ── GET all thresholds ────────────────────────────────────────────────────────

@router.get("/thresholds")
def get_thresholds(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT id, category_name, subcategory, period,
               threshold, updated_at
        FROM expense_thresholds
        WHERE user_id = :uid
        ORDER BY category_name, subcategory, period
    """), {"uid": str(current_user.id)}).fetchall()

    return [
        {
            "id":            str(r.id),
            "category_name": r.category_name,
            "subcategory":   r.subcategory,
            "period":        r.period,
            "threshold":     float(r.threshold),
            "updated_at":    r.updated_at.isoformat(),
        }
        for r in rows
    ]


# ── PUT (upsert) threshold ────────────────────────────────────────────────────

@router.put("/thresholds", status_code=200)
def upsert_threshold(
    body: ThresholdUpsert,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    if body.period not in ('monthly', 'annual'):
        raise HTTPException(status_code=422, detail="period must be 'monthly' or 'annual'")
    if body.threshold < 0:
        raise HTTPException(status_code=422, detail="threshold must be >= 0")

    subcat = body.subcategory or body.category_name

    result = db.execute(text("""
        INSERT INTO expense_thresholds
            (id, user_id, category_name, subcategory, period, threshold)
        VALUES
            (:id, :uid, :cat, :sub, :period, :threshold)
        ON CONFLICT (user_id, category_name, subcategory, period)
        DO UPDATE SET
            threshold  = EXCLUDED.threshold,
            updated_at = now()
        RETURNING id, category_name, subcategory, period, threshold
    """), {
        "id":        str(uuid.uuid4()),
        "uid":       str(current_user.id),
        "cat":       body.category_name,
        "sub":       subcat,
        "period":    body.period,
        "threshold": body.threshold,
    }).fetchone()

    db.commit()
    return {
        "id":            str(result.id),
        "category_name": result.category_name,
        "subcategory":   result.subcategory,
        "period":        result.period,
        "threshold":     float(result.threshold),
    }


# ── DELETE threshold ──────────────────────────────────────────────────────────

@router.delete("/thresholds/{threshold_id}", status_code=200)
def delete_threshold(
    threshold_id: str,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    result = db.execute(text("""
        DELETE FROM expense_thresholds
        WHERE id = :id AND user_id = :uid
        RETURNING id
    """), {"id": threshold_id, "uid": str(current_user.id)}).fetchone()

    db.commit()

    if not result:
        raise HTTPException(status_code=404, detail="Threshold not found")
    return {"deleted": threshold_id}


# ── GET budget status (actuals vs thresholds) ─────────────────────────────────

@router.get("/status")
def budget_status(
    current_user: CurrentUser,
    year:  Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Compare actual spend vs budget thresholds.
    Returns traffic-light status: green / amber / red per category.

    Green:  spent < 80% of budget
    Amber:  spent >= 80% and < 100%
    Red:    spent >= 100% (over budget)
    """
    params = {"uid": str(current_user.id)}

    # Build year/month filters
    filters = []
    if year:
        filters.append("AND t.year_num = :year")
        params["year"] = year
    if month:
        filters.append("AND t.month_num = :month")
        params["month"] = month

    # Get all thresholds for this user
    thresholds = db.execute(text("""
        SELECT category_name, subcategory, period, threshold
        FROM expense_thresholds
        WHERE user_id = :uid
        ORDER BY category_name, subcategory, period
    """), {"uid": str(current_user.id)}).fetchall()

    if not thresholds:
        return {"year": year, "month": month, "budgets": [], "alerts": []}

    # Get actuals — monthly totals per category
    actuals_monthly = db.execute(text(f"""
        SELECT
            t.category_name,
            COALESCE(t.subcategory, t.category_name) AS subcategory,
            t.year_num,
            t.month_num,
            SUM(t.amount) AS total
        FROM transactions t
        WHERE t.user_id = :uid
        {' '.join(filters)}
        GROUP BY t.category_name, t.subcategory, t.year_num, t.month_num
    """), params).fetchall()

    # Build actuals lookup: {(cat, sub): {monthly: x, annual: y}}
    actuals = {}
    for row in actuals_monthly:
        key = (row.category_name, row.subcategory)
        if key not in actuals:
            actuals[key] = {"monthly_avg": 0, "annual": 0, "monthly_totals": []}
        actuals[key]["annual"] += float(row.total)
        actuals[key]["monthly_totals"].append(float(row.total))

    # Calculate monthly average
    for key in actuals:
        tots = actuals[key]["monthly_totals"]
        actuals[key]["monthly_avg"] = round(
            actuals[key]["annual"] / len(tots), 2) if tots else 0

    # Build budget status per threshold
    budgets = []
    alerts  = []

    for t in thresholds:
        key       = (t.category_name, t.subcategory or t.category_name)
        actual    = actuals.get(key, {})
        threshold = float(t.threshold)

        if t.period == 'monthly':
            spent = actual.get("monthly_avg", 0)
            label = f"{t.category_name} (monthly avg)"
        else:
            spent = actual.get("annual", 0)
            label = f"{t.category_name} (annual)"

        pct    = round(spent * 100 / threshold, 1) if threshold > 0 else 0
        status = 'green' if pct < 80 else ('amber' if pct < 100 else 'red')

        entry = {
            "category_name": t.category_name,
            "subcategory":   t.subcategory,
            "period":        t.period,
            "threshold":     threshold,
            "spent":         round(spent, 2),
            "pct":           pct,
            "remaining":     round(max(threshold - spent, 0), 2),
            "overage":       round(max(spent - threshold, 0), 2),
            "status":        status,
        }
        budgets.append(entry)

        if status in ('amber', 'red'):
            alerts.append({
                "category": t.category_name,
                "status":   status,
                "message":  f"{label}: {pct}% of budget used"
                            + (f" — over by ${entry['overage']:,.0f}" if status == 'red' else ""),
            })

    # Sort: red first, then amber, then green
    order = {'red': 0, 'amber': 1, 'green': 2}
    budgets.sort(key=lambda x: (order[x['status']], x['category_name']))
    alerts.sort(key=lambda x: order[x['status']])

    return {
        "year":    year,
        "month":   month,
        "budgets": budgets,
        "alerts":  alerts,
        "summary": {
            "total_budgets": len(budgets),
            "red":   sum(1 for b in budgets if b['status'] == 'red'),
            "amber": sum(1 for b in budgets if b['status'] == 'amber'),
            "green": sum(1 for b in budgets if b['status'] == 'green'),
        }
    }
