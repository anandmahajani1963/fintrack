# ============================================================
# fintrack — Categorizer service (subcategory-aware) (v03)
# File: backend/app/services/categorizer.py
# ============================================================

from sqlalchemy.orm import Session
from app.models.transaction import Category
import logging

logger = logging.getLogger("fintrack.categorizer")

# Pharmacy overrides — checked before generic grocery/shopping rules
PHARMACY_RULES = {
    "publix pharmacy": ("Health", "Pharmacy (Rx)"),
    "kroger pharmacy": ("Health", "Pharmacy (Rx)"),
    "cvs pharmacy":    ("Health", "Pharmacy (Rx)"),
    "walgreens":       ("Health", "Pharmacy (Rx)"),
    "rite aid":        ("Health", "Pharmacy (Rx)"),
    "costco pharmacy": ("Health", "Pharmacy (Rx)"),
}

# Costco special-case rules
COSTCO_RULES = {
    "costco gas":  ("Transport", "Fuel"),
    "costco whse": ("Groceries", "Warehouse Club - Food"),
    "costco.com":  ("Shopping",  "Warehouse Club - General"),
}

# Merchant-level overrides — specific strings that keyword matching misses.
# Checked after pharmacy/costco, before general keyword table.
# Format: "substring_in_desc_lower": ("Category", "Subcategory", is_essential)
MERCHANT_OVERRIDES = {
    # Groceries
    "suvidha":           ("Groceries",     "Ethnic Grocery",            True),
    "central market":    ("Groceries",     "Grocery Store",             True),
    "wal-mart supercenter": ("Groceries",  "Grocery Store",             True),
    "wm supercenter":    ("Groceries",     "Grocery Store",             True),

    # Transport / Fuel
    "citgo":             ("Transport",     "Fuel",                      True),
    "get n geaux":       ("Transport",     "Fuel",                      True),

    # Transport / Registration & Fees
    "mvd kiosk":         ("Transport",     "Parking & Toll",            True),
    "ez emissions":      ("Transport",     "Parking & Toll",            True),
    "lpc 150":           ("Transport",     "Parking & Toll",            True),

    # Dining
    "flippin pizza":     ("Dining",        "Restaurant",                False),
    "ruby falls":        ("Entertainment", "Events & Activities",       False),
    "hot shots@ruby":    ("Entertainment", "Events & Activities",       False),
    "incline":           ("Entertainment", "Events & Activities",       False),
    "tugoz":             ("Entertainment", "Events & Activities",       False),

    # Pet Care
    "bernas canine":     ("Pet Care",      "Pet Services",              False),
    "livepawsiti":       ("Pet Care",      "Pet Services",              False),

    # Utilities
    "supershine":        ("Utilities",     "Car Wash",                  False),

    # Shopping
    "duty free":         ("Shopping",      "General Retail",            False),
    "heartsewn":         ("Shopping",      "General Retail",            False),
}


def get_user_categories(user_id, db: Session) -> list:
    return db.query(Category).filter(
        Category.user_id == user_id
    ).order_by(Category.sort_order).all()


def infer_category(description: str, user_categories: list) -> tuple:
    """
    Returns (category_name, subcategory, is_essential).

    Priority order:
      1. Pharmacy overrides
      2. Costco special cases
      3. Merchant-level overrides (specific known merchants)
      4. User keyword table (from DB), ordered by sort_order
      5. Falls back to ('Other', 'Other', False)
    """
    desc_lower = description.lower()

    # 1. Pharmacy overrides
    for substring, (cat, subcat) in PHARMACY_RULES.items():
        if substring in desc_lower:
            for uc in user_categories:
                if uc.name == cat:
                    return cat, subcat, uc.is_essential
            return cat, subcat, True

    # 2. Costco special cases
    for substring, (cat, subcat) in COSTCO_RULES.items():
        if substring in desc_lower:
            for uc in user_categories:
                if uc.name == cat:
                    return cat, subcat, uc.is_essential
            return cat, subcat, False

    # 3. Merchant-level overrides
    for substring, (cat, subcat, essential) in MERCHANT_OVERRIDES.items():
        if substring in desc_lower:
            return cat, subcat, essential

    # 4. User keyword table
    for cat in user_categories:
        if cat.name == "Other":
            continue
        for keyword in (cat.keywords or []):
            if keyword.lower() in desc_lower:
                return cat.name, (cat.subcategory or cat.name), cat.is_essential

    return "Other", "Other", False


def categorize_batch(descriptions: list, user_id, db: Session) -> list:
    user_categories = get_user_categories(user_id, db)
    return [infer_category(desc, user_categories) for desc in descriptions]


def apply_large_expense_flag(amount: float, category_name: str,
                              thresholds: dict) -> bool:
    specific = thresholds.get(category_name)
    if specific is not None:
        return float(amount) >= specific
    global_threshold = thresholds.get("ALL")
    if global_threshold is not None:
        return float(amount) >= global_threshold
    return False
