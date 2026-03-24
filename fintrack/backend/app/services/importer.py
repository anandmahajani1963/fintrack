# ============================================================
# fintrack — CSV Importer service
# File: backend/app/services/importer.py
#
# Version History:
#   v1.0  2026-03-18  Initial — Citi, AmEx, Chase CSV parsing
#                     Sign-flip logic for Chase (purchases negative)
#                     Member detection from account number column
#   v1.1  2026-03-23  Added subcategory field to ImportedRow dataclass
#                     Updated infer_category unpack from 2 to 3 values
#
# Supported providers: citi, amex, chase
# ============================================================

import io
import hashlib
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional
import logging

from app.services.encryption import encrypt
from app.services.categorizer import infer_category, apply_large_expense_flag

logger = logging.getLogger("fintrack.importer")

# ── Per-provider config (identical to standalone script) ──────────────────────
CARD_CONFIGS = {
    "citi": {
        "flip_sign":   False,
        "member_cols": ["Account Number", "Card Member", "Cardholder", "Name", "Account"],
        "date_cols":   ["Date", "Transaction Date", "Posted Date"],
        "desc_cols":   ["Description", "Merchant", "Payee"],
        "amount_cols": ["Amount", "Debit", "Credit"],
    },
    "amex": {
        "flip_sign":   False,
        "member_cols": ["Card Member", "Account Number", "Cardholder", "Name"],
        "date_cols":   ["Date", "Transaction Date", "Posted Date"],
        "desc_cols":   ["Description", "Merchant", "Payee"],
        "amount_cols": ["Amount", "Debit", "Credit"],
    },
    "chase": {
        "flip_sign":   True,
        "member_cols": [],
        "date_cols":   ["Transaction Date", "Date", "Post Date"],
        "desc_cols":   ["Description", "Merchant Name", "Payee"],
        "amount_cols": ["Amount", "Debit"],
    },
}

COSTCO_RULES = {
    "costco gas":  "Transport",
    "costco whse": "Groceries",
    "costco.com":  "Shopping",
}


@dataclass
class ImportedRow:
    txn_date:      str        # ISO format YYYY-MM-DD
    amount:        float
    description_enc: str      # encrypted merchant name
    description_plain: str    # plaintext — used for categorization, not stored
    category_name: str
    subcategory:   str
    is_essential:  bool
    is_large:      bool
    member_name:   str
    source_file:   str


@dataclass
class ImportResult:
    provider:       str
    source_file:    str
    raw_row_count:  int
    imported_count: int
    skipped_count:  int       # payments, credits, zero amounts
    rows:           list[ImportedRow] = field(default_factory=list)
    errors:         list[str]         = field(default_factory=list)


def _find_col(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    low = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in low:
            return low[cand.lower()]
    return None


def _extract_member(df: pd.DataFrame, member_col: Optional[str]) -> pd.Series:
    if not member_col:
        return pd.Series(["Shared"] * len(df), index=df.index)
    raw = df[member_col].astype(str).str.strip()
    if raw.str.match(r"^[\d\-\*X]+$").all():
        return raw.str[-4:]
    return raw


def parse_csv(
    file_bytes: bytes,
    filename: str,
    provider: str,
    encryption_key: bytes,
    user_categories: list,
    thresholds: dict[str, float],
) -> ImportResult:
    """
    Parse a credit card CSV file and return structured ImportResult.

    Args:
        file_bytes:      raw CSV bytes from upload
        filename:        original filename (used as source_file tag)
        provider:        'citi', 'amex', or 'chase'
        encryption_key:  user's derived encryption key
        user_categories: list of Category ORM objects for this user
        thresholds:      dict of category_name -> large expense threshold
    """
    result = ImportResult(
        provider=provider,
        source_file=filename,
        raw_row_count=0,
        imported_count=0,
        skipped_count=0,
    )

    if provider not in CARD_CONFIGS:
        result.errors.append(f"Unknown provider '{provider}'. Use: citi, amex, chase")
        return result

    cfg = CARD_CONFIGS[provider]

    # Try parsing with header row offsets
    raw_df = None
    for header_row in [0, 1, 2]:
        try:
            tmp = pd.read_csv(
                io.BytesIO(file_bytes),
                header=header_row,
                encoding="utf-8",
                on_bad_lines="skip",
            )
            tmp.columns = tmp.columns.str.strip()
            if _find_col(tmp, cfg["date_cols"]):
                raw_df = tmp
                break
        except Exception:
            continue

    if raw_df is None:
        result.errors.append("Could not parse CSV — no recognisable date column found")
        return result

    date_col   = _find_col(raw_df, cfg["date_cols"])
    desc_col   = _find_col(raw_df, cfg["desc_cols"])
    amount_col = _find_col(raw_df, cfg["amount_cols"])
    member_col = _find_col(raw_df, cfg["member_cols"]) if cfg["member_cols"] else None

    if not date_col or not amount_col:
        result.errors.append(f"Missing required columns. Found: {list(raw_df.columns)}")
        return result

    result.raw_row_count = len(raw_df)

    # Parse amounts
    amounts = pd.to_numeric(raw_df[amount_col], errors="coerce").fillna(0)
    if cfg["flip_sign"]:
        amounts = -amounts

    # Parse dates
    dates = pd.to_datetime(raw_df[date_col], errors="coerce")

    # Parse descriptions
    descriptions = raw_df[desc_col].astype(str).str.strip() if desc_col else pd.Series(["Unknown"] * len(raw_df))

    # Parse members
    members = _extract_member(raw_df, member_col)

    # Process each row
    for idx in range(len(raw_df)):
        amount = float(amounts.iloc[idx])
        date   = dates.iloc[idx]
        desc   = descriptions.iloc[idx]
        member = str(members.iloc[idx])

        # Skip payments, credits, zero amounts
        if pd.isna(date) or amount <= 0:
            result.skipped_count += 1
            continue

        # Categorize from plaintext description
        cat_name, subcat, is_essential = infer_category(desc, user_categories)

        # Large expense flag
        is_large = apply_large_expense_flag(amount, cat_name, thresholds)

        # Encrypt description before storing
        desc_enc = encrypt(desc, encryption_key)

        result.rows.append(ImportedRow(
            txn_date          = date.strftime("%Y-%m-%d"),
            amount            = round(amount, 2),
            description_enc   = desc_enc,
            description_plain = desc,
            category_name     = cat_name,
            subcategory       = subcat,
            is_essential      = is_essential,
            is_large          = is_large,
            member_name       = member,
            source_file       = filename,
        ))
        result.imported_count += 1

    logger.info(
        f"Parsed {filename}: {result.raw_row_count} raw rows, "
        f"{result.imported_count} imported, {result.skipped_count} skipped"
    )
    return result
