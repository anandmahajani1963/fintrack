# ============================================================
# fintrack — Analytics router: /api/v1/analytics
# File: backend/app/routers/analytics.py
#
# Endpoints:
#   GET /api/v1/analytics/monthly-pivot      monthly spend by category x month
#   GET /api/v1/analytics/category-summary   totals + % + essential split
#   GET /api/v1/analytics/trend              month-over-month totals
#   GET /api/v1/analytics/essential-split    essential vs non-essential
#   GET /api/v1/analytics/large-expenses     transactions above threshold
#   GET /api/v1/analytics/utility-seasonal   seasonal utility breakdown
# ============================================================

from fastapi import APIRouter, Depends, Query
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
        raise Exception("Key material not found")
    return derive_key(password, bytes(user_key.kdf_salt))


# ── 1. Monthly Pivot ──────────────────────────────────────────────────────────

@router.get("/monthly-pivot")
def monthly_pivot(
    current_user: CurrentUser,
    year:     Optional[int] = Query(None, description="Filter by year"),
    db: Session = Depends(get_db),
):
    """
    Monthly spend by category and subcategory.
    Returns data shaped for a pivot table: categories as rows, months as columns.
    """
    params = {"uid": str(current_user.id)}
    year_filter = "AND t.year_num = :year" if year else ""
    if year:
        params["year"] = year

    rows = db.execute(text(f"""
        SELECT
            t.year_num,
            t.month_num,
            TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
            t.category_name,
            COALESCE(t.subcategory, t.category_name)             AS subcategory,
            c.is_essential,
            c.color_code,
            SUM(t.amount)                                         AS total_amount,
            COUNT(*)                                              AS txn_count
        FROM transactions t
        LEFT JOIN categories c
            ON c.user_id = t.user_id AND c.name = t.category_name
        WHERE t.user_id = :uid
        {year_filter}
        GROUP BY t.year_num, t.month_num, t.txn_date,
                 t.category_name, t.subcategory,
                 c.is_essential, c.color_code
        ORDER BY t.year_num, t.month_num, t.category_name
    """), params).fetchall()

    # Build pivot structure: {category: {month: amount}}
    months_seen  = {}   # month_label -> (year_num, month_num) for ordering
    pivot        = {}   # (category, subcategory) -> {month_label: amount}
    cat_meta     = {}   # (category, subcategory) -> {is_essential, color_code}

    for row in rows:
        key   = (row.category_name, row.subcategory)
        month = row.month_label

        if month not in months_seen:
            months_seen[month] = (row.year_num, row.month_num)
        if key not in pivot:
            pivot[key]    = {}
            cat_meta[key] = {
                "is_essential": row.is_essential,
                "color_code":   row.color_code or "#9E9E9E",
            }
        pivot[key][month] = pivot[key].get(month, 0) + float(row.total_amount)

    # Sort months chronologically
    sorted_months = sorted(months_seen.keys(),
                           key=lambda m: months_seen[m])

    # Build response rows
    result_rows = []
    for (cat, subcat), month_data in sorted(pivot.items()):
        row_total = sum(month_data.values())
        result_rows.append({
            "category":    cat,
            "subcategory": subcat,
            "is_essential":cat_meta[(cat, subcat)]["is_essential"],
            "color_code":  cat_meta[(cat, subcat)]["color_code"],
            "months":      {m: round(month_data.get(m, 0), 2) for m in sorted_months},
            "row_total":   round(row_total, 2),
        })

    # Sort by row_total descending
    result_rows.sort(key=lambda r: r["row_total"], reverse=True)

    # Column totals
    col_totals = {m: round(sum(r["months"].get(m, 0) for r in result_rows), 2)
                  for m in sorted_months}
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
    year:     Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Total spend per category and subcategory with % of total.
    Includes essential vs non-essential split.
    """
    params = {"uid": str(current_user.id)}
    year_filter = "AND t.year_num = :year" if year else ""
    if year:
        params["year"] = year

    rows = db.execute(text(f"""
        SELECT
            t.category_name,
            COALESCE(t.subcategory, t.category_name) AS subcategory,
            COALESCE(c.is_essential, false)           AS is_essential,
            COALESCE(c.color_code, '#9E9E9E')         AS color_code,
            SUM(t.amount)                             AS total_amount,
            COUNT(*)                                  AS txn_count,
            ROUND(SUM(t.amount) * 100.0 /
                SUM(SUM(t.amount)) OVER (), 2)        AS pct_of_total
        FROM transactions t
        LEFT JOIN categories c
            ON c.user_id = t.user_id AND c.name = t.category_name
        WHERE t.user_id = :uid
        {year_filter}
        GROUP BY t.category_name, t.subcategory, c.is_essential, c.color_code
        ORDER BY total_amount DESC
    """), params).fetchall()

    grand_total    = sum(float(r.total_amount) for r in rows)
    essential_total    = sum(float(r.total_amount) for r in rows if r.is_essential)
    nonessential_total = grand_total - essential_total

    return {
        "grand_total":         round(grand_total, 2),
        "essential_total":     round(essential_total, 2),
        "nonessential_total":  round(nonessential_total, 2),
        "essential_pct":       round(essential_total * 100 / grand_total, 1) if grand_total else 0,
        "nonessential_pct":    round(nonessential_total * 100 / grand_total, 1) if grand_total else 0,
        "categories": [
            {
                "category":    r.category_name,
                "subcategory": r.subcategory,
                "is_essential":r.is_essential,
                "color_code":  r.color_code,
                "total":       round(float(r.total_amount), 2),
                "txn_count":   r.txn_count,
                "pct":         round(float(r.pct_of_total), 2),
            }
            for r in rows
        ],
    }


# ── 3. Trend ──────────────────────────────────────────────────────────────────

@router.get("/trend")
def trend(
    current_user: CurrentUser,
    year:     Optional[int] = Query(None),
    category: Optional[str] = Query(None, description="Filter to one category"),
    db: Session = Depends(get_db),
):
    """
    Month-over-month total spend. Optionally filtered to one category.
    Includes month-over-month delta and % change.
    """
    params = {"uid": str(current_user.id)}
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
            SUM(t.amount)  AS total_amount,
            COUNT(*)       AS txn_count
        FROM transactions t
        WHERE t.user_id = :uid
        {' '.join(filters)}
        GROUP BY t.year_num, t.month_num, t.txn_date
        ORDER BY t.year_num, t.month_num
    """), params).fetchall()

    result = []
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
            "month":       row.month_label,
            "year":        row.year_num,
            "month_num":   row.month_num,
            "total":       amount,
            "txn_count":   row.txn_count,
            "mom_delta":   delta,
            "mom_pct":     change,
        })
        prev_amount = amount

    avg = round(sum(r["total"] for r in result) / len(result), 2) if result else 0

    return {
        "category":    category or "All",
        "months":      result,
        "average":     avg,
        "total":       round(sum(r["total"] for r in result), 2),
    }


# ── 4. Essential vs Non-Essential Split ───────────────────────────────────────

@router.get("/essential-split")
def essential_split(
    current_user: CurrentUser,
    year:  Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Essential vs non-essential breakdown by month.
    Returns monthly bars suitable for a stacked chart.
    """
    params = {"uid": str(current_user.id)}
    filters = []
    if year:
        filters.append("AND t.year_num = :year")
        params["year"] = year
    if month:
        filters.append("AND t.month_num = :month")
        params["month"] = month

    rows = db.execute(text(f"""
        SELECT
            t.year_num,
            t.month_num,
            TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
            COALESCE(c.is_essential, false)                       AS is_essential,
            SUM(t.amount)                                         AS total_amount,
            COUNT(*)                                              AS txn_count
        FROM transactions t
        LEFT JOIN categories c
            ON c.user_id = t.user_id AND c.name = t.category_name
        WHERE t.user_id = :uid
        {' '.join(filters)}
        GROUP BY t.year_num, t.month_num, t.txn_date, c.is_essential
        ORDER BY t.year_num, t.month_num, is_essential DESC
    """), params).fetchall()

    # Pivot into {month: {essential: x, nonessential: y}}
    months = {}
    for row in rows:
        m = row.month_label
        if m not in months:
            months[m] = {"month": m, "year": row.year_num,
                         "month_num": row.month_num,
                         "essential": 0, "nonessential": 0,
                         "essential_txns": 0, "nonessential_txns": 0}
        if row.is_essential:
            months[m]["essential"]      += round(float(row.total_amount), 2)
            months[m]["essential_txns"] += row.txn_count
        else:
            months[m]["nonessential"]      += round(float(row.total_amount), 2)
            months[m]["nonessential_txns"] += row.txn_count

    result = sorted(months.values(), key=lambda r: (r["year"], r["month_num"]))

    # Add totals and percentages
    for r in result:
        total = r["essential"] + r["nonessential"]
        r["total"]             = round(total, 2)
        r["essential_pct"]     = round(r["essential"] * 100 / total, 1) if total else 0
        r["nonessential_pct"]  = round(r["nonessential"] * 100 / total, 1) if total else 0

    return {"months": result}


# ── 5. Large Expenses ─────────────────────────────────────────────────────────

@router.get("/large-expenses")
def large_expenses(
    current_user: CurrentUser,
    password:  str           = Query(..., description="Your fintrack password"),
    year:      Optional[int] = Query(None),
    threshold: Optional[float] = Query(None,
        description="Override threshold — default uses stored thresholds"),
    db: Session = Depends(get_db),
):
    """
    List large expenses with decrypted descriptions.
    Sorted by amount descending.
    """
    enc_key = _get_enc_key(current_user.id, password, db)

    params  = {"uid": str(current_user.id)}
    filters = []
    if year:
        filters.append("AND t.year_num = :year")
        params["year"] = year
    if threshold:
        filters.append("AND t.amount >= :threshold")
        params["threshold"] = threshold
        amount_filter = ""
    else:
        amount_filter = "AND t.is_large = true"

    rows = db.execute(text(f"""
        SELECT
            t.id,
            t.txn_date,
            t.amount,
            t.description,
            t.category_name,
            COALESCE(t.subcategory, t.category_name) AS subcategory,
            t.is_essential,
            a.provider
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = :uid
        {amount_filter}
        {' '.join(filters)}
        ORDER BY t.amount DESC
        LIMIT 100
    """), params).fetchall()

    return {
        "count": len(rows),
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


# ── 6. Utility Seasonal Breakdown ─────────────────────────────────────────────

@router.get("/utility-seasonal")
def utility_seasonal(
    current_user: CurrentUser,
    year:     Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Seasonal utility spend breakdown by utility type and month.
    Flags months that are above the yearly average for that utility type.
    Used for identifying seasonal consumption patterns and optimization.
    """
    params = {"uid": str(current_user.id)}
    year_filter = "AND t.year_num = :year" if year else ""
    if year:
        params["year"] = year

    rows = db.execute(text(f"""
        WITH utility_monthly AS (
            SELECT
                t.year_num,
                t.month_num,
                TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
                COALESCE(t.subcategory, 'Other Utility')              AS utility_type,
                SUM(t.amount)                                         AS total_amount,
                COUNT(*)                                              AS txn_count
            FROM transactions t
            WHERE t.user_id = :uid
              AND t.category_name = 'Utilities'
              {year_filter}
            GROUP BY t.year_num, t.month_num, t.txn_date, t.subcategory
        ),
        utility_averages AS (
            SELECT
                year_num,
                utility_type,
                AVG(total_amount) AS yearly_avg
            FROM utility_monthly
            GROUP BY year_num, utility_type
        )
        SELECT
            um.year_num,
            um.month_num,
            um.month_label,
            um.utility_type,
            um.total_amount,
            um.txn_count,
            ua.yearly_avg,
            CASE WHEN um.total_amount > ua.yearly_avg
                 THEN true ELSE false END AS above_average,
            ROUND((um.total_amount - ua.yearly_avg) * 100.0
                  / NULLIF(ua.yearly_avg, 0), 1)  AS pct_vs_avg
        FROM utility_monthly um
        JOIN utility_averages ua
            ON ua.year_num = um.year_num
            AND ua.utility_type = um.utility_type
        ORDER BY um.utility_type, um.year_num, um.month_num
    """), params).fetchall()

    # Group by utility type
    by_type = {}
    for row in rows:
        ut = row.utility_type
        if ut not in by_type:
            by_type[ut] = {
                "utility_type":  ut,
                "yearly_avg":    round(float(row.yearly_avg), 2),
                "months":        [],
            }
        by_type[ut]["months"].append({
            "month":         row.month_label,
            "month_num":     row.month_num,
            "year":          row.year_num,
            "amount":        round(float(row.total_amount), 2),
            "above_average": row.above_average,
            "pct_vs_avg":    float(row.pct_vs_avg) if row.pct_vs_avg else 0,
        })

    # Add seasonal insight per utility type
    seasonal_notes = {
        "Electric":         "Typically peaks in summer (AC) and winter (heating)",
        "Water & Sewer":    "Typically peaks spring-summer (lawn/irrigation)",
        "Gas & Heating":    "Typically peaks winter (heating)",
        "Internet & Cable": "Fixed cost — minimal seasonal variation expected",
        "Waste & Sanitation":"Fixed cost — minimal seasonal variation expected",
        "Home Security":    "Fixed cost — minimal seasonal variation expected",
    }

    result = list(by_type.values())
    for item in result:
        item["seasonal_note"] = seasonal_notes.get(item["utility_type"], "")

    return {
        "utility_types": result,
        "total_utility_spend": round(
            sum(m["amount"] for ut in result for m in ut["months"]), 2
        ),
    }
