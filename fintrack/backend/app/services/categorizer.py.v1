# ============================================================
# fintrack — Categorizer service
# File: backend/app/services/categorizer.py
#
# Ported from the standalone analyze_credit_cards.py script.
# Now DB-aware: loads user's custom categories from PostgreSQL
# and falls back to built-in rules for Costco special cases.
# ============================================================

from sqlalchemy.orm import Session
from app.models.transaction import Category
from typing import Optional
import logging

logger = logging.getLogger("fintrack.categorizer")

# Costco special cases — checked before any keyword table
COSTCO_RULES = {
    "costco gas":  "Transport",
    "costco whse": "Groceries",
    "costco.com":  "Shopping",
}


def get_user_categories(user_id, db: Session) -> list[Category]:
    """Load all categories for a user, ordered by sort_order."""
    return db.query(Category).filter(
        Category.user_id == user_id
    ).order_by(Category.sort_order).all()


def infer_category(
    description: str,
    user_categories: list[Category],
) -> tuple[str, bool]:
    """
    Infer category name and is_essential flag from a merchant description.

    Priority order:
      1. Costco special-case rules (hardcoded)
      2. User's custom keyword table (from DB)
      3. Falls back to 'Other' (not essential)

    Returns: (category_name, is_essential)
    """
    desc_lower = description.lower()

    # 1. Costco rules
    for substring, category_name in COSTCO_RULES.items():
        if substring in desc_lower:
            # Find is_essential from user's categories
            for cat in user_categories:
                if cat.name == category_name:
                    return category_name, cat.is_essential
            return category_name, False

    # 2. User's keyword table
    for cat in user_categories:
        if cat.name == "Other":
            continue
        for keyword in (cat.keywords or []):
            if keyword.lower() in desc_lower:
                return cat.name, cat.is_essential

    return "Other", False


def categorize_batch(
    descriptions: list[str],
    user_id,
    db: Session,
) -> list[tuple[str, bool]]:
    """
    Categorize a list of descriptions in one DB round-trip.
    Returns list of (category_name, is_essential) tuples in same order.
    """
    user_categories = get_user_categories(user_id, db)
    return [infer_category(desc, user_categories) for desc in descriptions]


def apply_large_expense_flag(
    amount: float,
    category_name: str,
    thresholds: dict[str, float],
) -> bool:
    """
    Return True if the amount exceeds the configured threshold.
    thresholds: dict mapping category_name -> threshold amount.
                'ALL' key applies as a global fallback.
    """
    specific = thresholds.get(category_name)
    if specific is not None:
        return float(amount) >= specific

    global_threshold = thresholds.get("ALL")
    if global_threshold is not None:
        return float(amount) >= global_threshold

    return False
