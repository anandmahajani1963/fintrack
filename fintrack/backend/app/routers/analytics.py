# ============================================================
# fintrack — Analytics router: /api/v1/analytics
# File: backend/app/routers/analytics.py
#
# Version History:
#   v1.0  2026-03-18  Initial implementation — six analytics endpoints
#   v1.1  2026-03-23  Fixed JOIN multiplication bug causing inflated totals
#                     Root cause: LEFT JOIN on categories matched multiple rows
#                     per transaction (one per subcategory with same name).
#                     Fix: removed JOIN from all aggregate queries; category
#                     metadata (is_essential, color_code) now fetched separately
#                     via _get_cat_meta() and merged in Python.
#                     Result: grand total now correctly matches source data.
#   v1.2  2026-03-23  Added threshold default ($200) to large-expenses endpoint
#                     Added threshold value to large-expenses response
#                     Rounded all monetary amounts to 2 decimal places
#
# Endpoints:
#   GET /api/v1/analytics/monthly-pivot      monthly spend by category x month
#   GET /api/v1/analytics/category-summary   totals + % + essential split
#   GET /api/v1/analytics/trend              month-over-month totals + MoM delta
#   GET /api/v1/analytics/essential-split    essential vs non-essential by month
#   GET /api/v1/analytics/large-expenses     transactions above threshold
#   GET /api/v1/analytics/utility-seasonal   seasonal utility breakdown
# ============================================================

from fastapi import APIRouter, Depends, Query, Header, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import logging

from app.database import get_db
from app.models.user import UserKey
from app.services.auth import CurrentUser
from app.services.encryption import decrypt, derive_key

logger = logging.getLogger("fintrack.analytics")
router = APIRouter()


def _get_enc_key(user_id, password: str, db: Session) -> bytes:
    user_key = db.query(UserKey).filter(UserKey.user_id == user_id).first()
    if not user_key:
        raise HTTPException(status_code=500, detail="Key material not found")
    return derive_key(password, bytes(user_key.kdf_salt))


# ── Shared category metadata helper ──────────────────────────────────────────
# Fetches is_essential and color_code per (category, subcategory) in one query.
# Avoids the JOIN-multiplication bug where multiple category rows inflate totals.

def _get_cat_meta(user_id, db: Session) -> dict:
    """Returns {(category_name, subcategory): {is_essential, color_code}}"""
    rows = db.execute(text("""
        SELECT name, subcategory, is_essential, color_code
        FROM categories
        WHERE user_id = :uid
    """), {"uid": str(user_id)}).fetchall()
    meta = {}
    for r in rows:
        key = (r.name, r.subcategory or r.name)
        meta[key] = {"is_essential": r.is_essential, "color_code": r.color_code or "#9E9E9E"}
    return meta


# ── 1. Monthly Pivot ──────────────────────────────────────────────────────────

@router.get("/monthly-pivot")
def monthly_pivot(
    current_user: CurrentUser,
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Monthly spend by category/subcategory. Categories as rows, months as columns."""
    params = {"uid": str(current_user.id)}
    year_filter = "AND t.year_num = :year" if year else ""
    if year:
        params["year"] = year

    # Query transactions directly — no JOIN to avoid row multiplication
    rows = db.execute(text(f"""
        SELECT
            t.year_num,
            t.month_num,
            TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
            t.category_name,
            COALESCE(t.subcategory, t.category_name) AS subcategory,
            SUM(t.amount)  AS total_amount,
            COUNT(*)       AS txn_count
        FROM transactions t
        WHERE t.user_id = :uid
        {year_filter}
        GROUP BY t.year_num, t.month_num, t.txn_date,
                 t.category_name, t.subcategory
        ORDER BY t.year_num, t.month_num, t.category_name
    """), params).fetchall()

    cat_meta = _get_cat_meta(current_user.id, db)

    months_seen = {}
    pivot       = {}

    for row in rows:
        key   = (row.category_name, row.subcategory)
        month = row.month_label
        if month not in months_seen:
            months_seen[month] = (row.year_num, row.month_num)
        if key not in pivot:
            pivot[key] = {}
        pivot[key][month] = pivot[key].get(month, 0) + float(row.total_amount)

    sorted_months = sorted(months_seen.keys(), key=lambda m: months_seen[m])

    result_rows = []
    for (cat, subcat), month_data in sorted(pivot.items()):
        meta      = cat_meta.get((cat, subcat), {"is_essential": False, "color_code": "#9E9E9E"})
        row_total = sum(month_data.values())
        result_rows.append({
            "category":    cat,
            "subcategory": subcat,
            "is_essential":meta["is_essential"],
            "color_code":  meta["color_code"],
            "months":      {m: round(month_data.get(m, 0), 2) for m in sorted_months},
            "row_total":   round(row_total, 2),
        })

    result_rows.sort(key=lambda r: r["row_total"], reverse=True)
    col_totals  = {m: round(sum(r["months"].get(m, 0) for r in result_rows), 2) for m in sorted_months}
    grand_total = round(sum(col_totals.values()), 2)

    return {
        "months":      sorted_months,
        "rows":        result_rows,
        "col_totals":  col_totals,
        "grand_total": grand_total,
    }


# ── 2. Category Summary ───────────────────────────────────────────────────────

@router.get("/category-summary")
def category_summary(
    current_user: CurrentUser,
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Total spend per category/subcategory with % of total and essential split."""
    params = {"uid": str(current_user.id)}
    year_filter = "AND t.year_num = :year" if year else ""
    if year:
        params["year"] = year

    rows = db.execute(text(f"""
        SELECT
            t.category_name,
            COALESCE(t.subcategory, t.category_name) AS subcategory,
            SUM(t.amount)  AS total_amount,
            COUNT(*)       AS txn_count
        FROM transactions t
        WHERE t.user_id = :uid
        {year_filter}
        GROUP BY t.category_name, t.subcategory
        ORDER BY total_amount DESC
    """), params).fetchall()

    cat_meta    = _get_cat_meta(current_user.id, db)
    grand_total = sum(float(r.total_amount) for r in rows)

    categories = []
    for r in rows:
        meta = cat_meta.get((r.category_name, r.subcategory),
                            {"is_essential": False, "color_code": "#9E9E9E"})
        categories.append({
            "category":    r.category_name,
            "subcategory": r.subcategory,
            "is_essential":meta["is_essential"],
            "color_code":  meta["color_code"],
            "total":       round(float(r.total_amount), 2),
            "txn_count":   r.txn_count,
            "pct":         round(float(r.total_amount) * 100 / grand_total, 2) if grand_total else 0,
        })

    essential_total    = sum(c["total"] for c in categories if c["is_essential"])
    nonessential_total = grand_total - essential_total

    return {
        "grand_total":        round(grand_total, 2),
        "essential_total":    round(essential_total, 2),
        "nonessential_total": round(nonessential_total, 2),
        "essential_pct":      round(essential_total * 100 / grand_total, 1) if grand_total else 0,
        "nonessential_pct":   round(nonessential_total * 100 / grand_total, 1) if grand_total else 0,
        "categories":         categories,
    }


# ── 3. Trend ──────────────────────────────────────────────────────────────────

@router.get("/trend")
def trend(
    current_user: CurrentUser,
    year:     Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Month-over-month total spend with delta and % change."""
    params  = {"uid": str(current_user.id)}
    filters = []
    if year:
        filters.append("AND t.year_num = :year")
        params["year"] = year
    if category:
        filters.append("AND t.category_name = :category")
        params["category"] = category

    rows = db.execute(text(f"""
        SELECT
            t.year_num,
            t.month_num,
            TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
            SUM(t.amount) AS total_amount,
            COUNT(*)      AS txn_count
        FROM transactions t
        WHERE t.user_id = :uid
        {' '.join(filters)}
        GROUP BY t.year_num, t.month_num, DATE_TRUNC('month', t.txn_date)
        ORDER BY t.year_num, t.month_num
    """), params).fetchall()

    result      = []
    prev_amount = None
    for row in rows:
        amount = round(float(row.total_amount), 2)
        if prev_amount and prev_amount > 0:
            delta  = round(amount - prev_amount, 2)
            change = round((amount - prev_amount) * 100 / prev_amount, 1)
        else:
            delta  = 0
            change = 0
        result.append({
            "month":     row.month_label,
            "year":      row.year_num,
            "month_num": row.month_num,
            "total":     amount,
            "txn_count": row.txn_count,
            "mom_delta": delta,
            "mom_pct":   change,
        })
        prev_amount = amount

    avg = round(sum(r["total"] for r in result) / len(result), 2) if result else 0

    return {
        "category": category or "All",
        "months":   result,
        "average":  avg,
        "total":    round(sum(r["total"] for r in result), 2),
    }


# ── 4. Essential vs Non-Essential Split ───────────────────────────────────────

@router.get("/essential-split")
def essential_split(
    current_user: CurrentUser,
    year:  Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Essential vs non-essential monthly breakdown for stacked chart."""
    params  = {"uid": str(current_user.id)}
    filters = []
    if year:
        filters.append("AND t.year_num = :year")
        params["year"] = year
    if month:
        filters.append("AND t.month_num = :month")
        params["month"] = month

    cat_meta = _get_cat_meta(current_user.id, db)

    rows = db.execute(text(f"""
        SELECT
            t.year_num,
            t.month_num,
            TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
            t.category_name,
            COALESCE(t.subcategory, t.category_name) AS subcategory,
            SUM(t.amount) AS total_amount,
            COUNT(*)      AS txn_count
        FROM transactions t
        WHERE t.user_id = :uid
        {' '.join(filters)}
        GROUP BY t.year_num, t.month_num, DATE_TRUNC('month', t.txn_date), t.category_name, t.subcategory
        ORDER BY t.year_num, t.month_num
    """), params).fetchall()

    months = {}
    for row in rows:
        m    = row.month_label
        meta = cat_meta.get((row.category_name, row.subcategory), {"is_essential": False})
        if m not in months:
            months[m] = {"month": m, "year": row.year_num, "month_num": row.month_num,
                         "essential": 0, "nonessential": 0,
                         "essential_txns": 0, "nonessential_txns": 0}
        if meta["is_essential"]:
            months[m]["essential"]       += round(float(row.total_amount), 2)
            months[m]["essential_txns"]  += row.txn_count
        else:
            months[m]["nonessential"]      += round(float(row.total_amount), 2)
            months[m]["nonessential_txns"] += row.txn_count

    result = sorted(months.values(), key=lambda r: (r["year"], r["month_num"]))
    for r in result:
        total = r["essential"] + r["nonessential"]
        r["total"]            = round(total, 2)
        r["essential_pct"]    = round(r["essential"] * 100 / total, 1) if total else 0
        r["nonessential_pct"] = round(r["nonessential"] * 100 / total, 1) if total else 0

    return {"months": result}


# ── 5. Large Expenses ─────────────────────────────────────────────────────────

@router.get("/large-expenses")
def large_expenses(
    current_user: CurrentUser,
    year:      Optional[int]  = Query(None),
    threshold: Optional[float]= Query(None, description="Minimum amount — default $200"),
    password:  str            = Header(..., alias="x-fintrack-password",
                                       description="Your fintrack password for key derivation"),
    db: Session = Depends(get_db),
):
    """
    Large expenses with decrypted descriptions, sorted by amount descending.
    Password is required only to decrypt merchant names.
    Sent as X-Fintrack-Password header — never appears in URLs or logs.
    """
    enc_key   = _get_enc_key(current_user.id, password, db)
    min_amount = threshold if threshold is not None else 200.0

    params  = {"uid": str(current_user.id), "min_amount": min_amount}
    filters = ["AND t.amount >= :min_amount"]
    if year:
        filters.append("AND t.year_num = :year")
        params["year"] = year

    rows = db.execute(text(f"""
        SELECT
            t.id,
            t.txn_date,
            ROUND(t.amount, 2)                           AS amount,
            t.description,
            t.category_name,
            COALESCE(t.subcategory, t.category_name)     AS subcategory,
            t.is_essential,
            a.provider
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = :uid
        {' '.join(filters)}
        ORDER BY t.amount DESC
        LIMIT 100
    """), params).fetchall()

    return {
        "count":     len(rows),
        "threshold": min_amount,
        "items": [
            {
                "id":          str(r.id),
                "date":        r.txn_date.isoformat(),
                "amount":      float(r.amount),
                "description": decrypt(r.description, enc_key),
                "category":    r.category_name,
                "subcategory": r.subcategory,
                "is_essential":r.is_essential,
                "provider":    r.provider,
            }
            for r in rows
        ],
    }


# ── 6. Utility Seasonal ───────────────────────────────────────────────────────

@router.get("/utility-seasonal")
def utility_seasonal(
    current_user: CurrentUser,
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Seasonal utility spend by utility type. Flags above-average months."""
    params      = {"uid": str(current_user.id)}
    year_filter = "AND t.year_num = :year" if year else ""
    if year:
        params["year"] = year

    rows = db.execute(text(f"""
        WITH um AS (
            SELECT
                t.year_num,
                t.month_num,
                TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
                COALESCE(t.subcategory, 'Other Utility') AS utility_type,
                SUM(t.amount) AS total_amount,
                COUNT(*)      AS txn_count
            FROM transactions t
            WHERE t.user_id = :uid
              AND t.category_name = 'Utilities'
              {year_filter}
            GROUP BY t.year_num, t.month_num, t.txn_date, t.subcategory
        ),
        ua AS (
            SELECT year_num, utility_type, AVG(total_amount) AS yearly_avg
            FROM um GROUP BY year_num, utility_type
        )
        SELECT
            um.year_num, um.month_num, um.month_label,
            um.utility_type, um.total_amount, um.txn_count,
            ROUND(ua.yearly_avg::NUMERIC, 2) AS yearly_avg,
            CASE WHEN um.total_amount > ua.yearly_avg THEN true ELSE false END AS above_average,
            ROUND((um.total_amount - ua.yearly_avg) * 100.0
                  / NULLIF(ua.yearly_avg, 0), 1) AS pct_vs_avg
        FROM um
        JOIN ua ON ua.year_num = um.year_num AND ua.utility_type = um.utility_type
        ORDER BY um.utility_type, um.year_num, um.month_num
    """), params).fetchall()

    seasonal_notes = {
        "Electric":          "Typically peaks in summer (AC) and winter (heating)",
        "Water & Sewer":     "Typically peaks spring-summer (lawn/irrigation)",
        "Gas & Heating":     "Typically peaks winter (heating)",
        "Internet & Cable":  "Fixed cost — minimal seasonal variation expected",
        "Waste & Sanitation":"Fixed cost — minimal seasonal variation expected",
        "Home Security":     "Fixed cost — minimal seasonal variation expected",
    }

    by_type = {}
    for row in rows:
        ut = row.utility_type
        if ut not in by_type:
            by_type[ut] = {"utility_type": ut, "yearly_avg": float(row.yearly_avg), "months": []}
        by_type[ut]["months"].append({
            "month":         row.month_label,
            "month_num":     row.month_num,
            "year":          row.year_num,
            "amount":        round(float(row.total_amount), 2),
            "above_average": row.above_average,
            "pct_vs_avg":    float(row.pct_vs_avg) if row.pct_vs_avg else 0,
        })

    result = list(by_type.values())
    for item in result:
        item["seasonal_note"] = seasonal_notes.get(item["utility_type"], "")

    return {
        "utility_types":       result,
        "total_utility_spend": round(
            sum(m["amount"] for ut in result for m in ut["months"]), 2
        ),
    }


# ── 7. Member Summary ─────────────────────────────────────────────────────────

@router.get("/members")
def member_summary(
    current_user: CurrentUser,
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Spend by member (cardholder) and category.
    Member is derived from the account's member_name field.
    Descriptions are not decrypted — only aggregates returned.
    """
    params = {"uid": str(current_user.id)}
    year_filter = "AND t.year_num = :year" if year else ""
    if year:
        params["year"] = year

    rows = db.execute(text(f"""
        SELECT
            a.member_name                                    AS member_enc,
            a.provider,
            t.category_name,
            COALESCE(t.subcategory, t.category_name)        AS subcategory,
            SUM(t.amount)                                    AS total_amount,
            COUNT(*)                                         AS txn_count
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = :uid
        {year_filter}
        GROUP BY a.member_name, a.provider, t.category_name, t.subcategory
        ORDER BY a.member_name, total_amount DESC
    """), params).fetchall()

    cat_meta = _get_cat_meta(current_user.id, db)

    # Group by member (member_name is encrypted — use as opaque key)
    members = {}
    for row in rows:
        key = str(row.member_enc)   # encrypted blob as key — never decrypted here
        if key not in members:
            members[key] = {
                "provider":   row.provider,
                "categories": [],
                "total":      0,
            }
        meta = cat_meta.get((row.category_name, row.subcategory),
                            {"is_essential": False, "color_code": "#9E9E9E"})
        amount = round(float(row.total_amount), 2)
        members[key]["categories"].append({
            "category":    row.category_name,
            "subcategory": row.subcategory,
            "is_essential":meta["is_essential"],
            "color_code":  meta["color_code"],
            "total":       amount,
            "txn_count":   row.txn_count,
        })
        members[key]["total"] = round(members[key]["total"] + amount, 2)

    # Return as list — member key is index (no decryption needed)
    result = []
    for i, (key, data) in enumerate(members.items()):
        result.append({
            "member_index": i + 1,
            "provider":     data["provider"],
            "total":        data["total"],
            "categories":   data["categories"],
        })

    return {
        "year":    year,
        "members": result,
        "total":   round(sum(m["total"] for m in result), 2),
    }
