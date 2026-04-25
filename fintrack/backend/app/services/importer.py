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
#   v1.2  2026-04-06  Dynamic header detection — scans all lines to find
#                     the actual CSV header, skipping any preamble rows
#                     (fixes Citi year-end summaries with 5-line headers).
#                     Added support for date format "Jul 04, 2023".
#                     Added comma-stripping for amounts like "1,151.62".
#                     Added CRLF (^M) handling for Windows-exported CSVs.
#                     Expanded date/amount/desc column aliases per provider.
#
# Supported providers: citi, amex, chase
# ============================================================

import io
import re
import hashlib
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional
import logging

from app.services.encryption import encrypt
from app.services.categorizer import infer_category, apply_large_expense_flag

logger = logging.getLogger("fintrack.importer")

# ── Per-provider column aliases ───────────────────────────────────────────────
# Ordered by preference — first match wins.
# Add new aliases here when a new format is encountered.
# ── CSV format configurations ────────────────────────────────────────────────
# Three generic formats cover virtually all US credit card and bank CSV exports.
# Users select format by pattern, not by provider name.
#
# Format A (debit_credit): Separate Debit and Credit columns, positive numbers.
#   Providers: Citi, AmEx, Discover, Capital One credit cards
#
# Format B (amount_negative): Single Amount column, purchases are negative.
#   Providers: Chase, Bank of America, Wells Fargo, most checking accounts
#
# Format C (amount_positive): Single Amount column, purchases are positive.
#   Providers: Some older bank exports, regional banks
#
# Legacy aliases: "citi" → debit_credit, "amex" → debit_credit, "chase" → amount_negative

CARD_CONFIGS = {
    # ── Format A: Separate Debit/Credit columns ──────────────────────────────
    "debit_credit": {
        "flip_sign":   False,
        "member_cols": ["Account Number", "Card Member", "Cardholder", "Name", "Account"],
        "date_cols":   ["Date", "Transaction Date", "Posted Date", "Trans Date",
                        "Post Date", "Activity Date", "Posting Date"],
        "desc_cols":   ["Description", "Merchant", "Payee", "Transaction Description",
                        "Memo", "Narrative"],
        "amount_cols": ["Debit", "Amount", "Charge Amount", "Debit Amount", "Withdrawals"],
        "credit_cols": ["Credit", "Credit Amount", "Payments", "Deposits"],
    },
    # ── Format B: Single Amount column, negative = purchase ──────────────────
    "amount_negative": {
        "flip_sign":   True,
        "member_cols": ["Account Number", "Card Member", "Cardholder", "Name"],
        "date_cols":   ["Transaction Date", "Date", "Post Date", "Trans Date",
                        "Posting Date", "Activity Date"],
        "desc_cols":   ["Description", "Merchant Name", "Payee", "Memo",
                        "Transaction Description", "Narrative"],
        "amount_cols": ["Amount", "Debit", "Charge Amount", "Transaction Amount"],
        "credit_cols": [],
    },
    # ── Format C: Single Amount column, positive = purchase ──────────────────
    "amount_positive": {
        "flip_sign":   False,
        "member_cols": ["Account Number", "Card Member", "Cardholder", "Name"],
        "date_cols":   ["Date", "Transaction Date", "Post Date", "Trans Date",
                        "Posting Date", "Activity Date"],
        "desc_cols":   ["Description", "Merchant", "Payee", "Memo",
                        "Transaction Description", "Narrative"],
        "amount_cols": ["Amount", "Debit", "Charge Amount", "Withdrawals",
                        "Transaction Amount"],
        "credit_cols": [],
    },
    # ── Legacy aliases (backward compatibility) ───────────────────────────────
    "citi":  None,   # resolved below
    "amex":  None,
    "chase": None,
}

# Resolve legacy aliases
CARD_CONFIGS["citi"]  = CARD_CONFIGS["debit_credit"]
CARD_CONFIGS["amex"]  = CARD_CONFIGS["debit_credit"]
CARD_CONFIGS["chase"] = CARD_CONFIGS["amount_negative"]

# Date formats to try — order matters (most specific first)
DATE_FORMATS = [
    "%m/%d/%Y",          # 07/04/2023
    "%Y-%m-%d",          # 2023-07-04
    "%m/%d/%y",          # 07/04/23
    "%b %d, %Y",         # Jul 04, 2023
    "%B %d, %Y",         # July 04, 2023
    "%d/%m/%Y",          # 04/07/2023 (international)
    "%m-%d-%Y",          # 07-04-2023
    "%Y/%m/%d",          # 2023/07/04
]


@dataclass
class ImportedRow:
    txn_date:        str
    amount:          float
    description_enc: str
    description_plain: str
    category_name:   str
    subcategory:     str
    is_essential:    bool
    is_large:        bool
    member_name:     str
    source_file:     str


@dataclass
class ImportResult:
    provider:       str
    source_file:    str
    raw_row_count:  int
    imported_count: int
    skipped_count:  int
    rows:           list[ImportedRow] = field(default_factory=list)
    errors:         list[str]         = field(default_factory=list)


def _find_col(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    """Find first matching column name (case-insensitive)."""
    low = {c.lower().strip(): c for c in df.columns}
    for cand in candidates:
        if cand.lower().strip() in low:
            return low[cand.lower().strip()]
    return None


def _find_header_row(file_bytes: bytes, date_cols: list[str]) -> int:
    """
    Scan lines to find the row that contains the CSV header.
    Returns the 0-based line index of the header row.

    Strategy:
    1. Look for a line where a token exactly matches a known date column name
       (e.g. "Date", "Transaction Date") — case-insensitive.
    2. A data row like "Jul 04, 2023" will NOT match because "jul 04" is not
       a known column name.
    3. Guard: the matching token must look like a column label (no digits-only,
       no date patterns).
    """
    import re as _re

    text = file_bytes.decode("utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")

    date_col_lower = {d.lower().strip() for d in date_cols}

    # Regex to detect actual date values (not column names)
    date_value_re = _re.compile(
        r"\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}"   # 07/04/2023 or 07-04-23
        r"|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}"  # Jul 04, 2023
        r"|\d{4}[/\-]\d{2}[/\-]\d{2}"           # 2023-07-04
    )

    for i, line in enumerate(lines):
        clean = line.strip().lstrip("\ufeff")
        if not clean:
            continue
        tokens = [t.strip().strip('"').strip("'") for t in clean.split(",")]
        for token in tokens:
            token_low = token.lower().strip()
            # Must match a known date column name exactly
            if token_low in date_col_lower:
                # Guard: make sure this token doesn't look like a date value
                if not date_value_re.search(token):
                    logger.info(f"Header found at line {i}: {line[:80]}")
                    return i

    logger.warning("Header not found by column name — falling back to line 0")
    return 0


def _clean_amount(value) -> float:
    """
    Parse amount string handling:
    - Comma-formatted numbers: "1,151.62" → 1151.62
    - Quoted strings: '"355.8"' → 355.8
    - Empty strings → 0.0
    - Already numeric → pass through
    """
    if pd.isna(value):
        return 0.0
    s = str(value).strip().strip('"').replace(",", "").replace("$", "").strip()
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_date(value) -> Optional[pd.Timestamp]:
    """Try multiple date formats, return Timestamp or None."""
    if pd.isna(value):
        return None
    s = str(value).strip().strip('"')
    for fmt in DATE_FORMATS:
        try:
            return pd.Timestamp(pd.to_datetime(s, format=fmt))
        except (ValueError, TypeError):
            continue
    # Final fallback — let pandas guess
    try:
        return pd.Timestamp(pd.to_datetime(s, infer_datetime_format=True))
    except Exception:
        return None


def _extract_member(df: pd.DataFrame, member_col: Optional[str]) -> pd.Series:
    if not member_col:
        return pd.Series(["Shared"] * len(df), index=df.index)
    raw = df[member_col].astype(str).str.strip()
    if raw.str.match(r"^[\d\-\*X\t ]+$").all():
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
    Handles variable-length preamble, multiple date formats,
    comma-formatted amounts, and CRLF line endings.
    """
    result = ImportResult(
        provider=provider,
        source_file=filename,
        raw_row_count=0,
        imported_count=0,
        skipped_count=0,
    )

    # Resolve provider to config (supports both new format names and legacy aliases)
    if provider not in CARD_CONFIGS:
        result.errors.append(
            f"Unknown format '{provider}'. "
            f"Use: debit_credit, amount_negative, amount_positive "
            f"(or legacy: citi, amex, chase)"
        )
        return result

    cfg = CARD_CONFIGS[provider]

    # Normalise line endings
    clean_bytes = file_bytes.replace(b"\r\n", b"\n").replace(b"\r", b"\n")

    # Find where the actual header row is
    header_row = _find_header_row(clean_bytes, cfg["date_cols"])
    logger.info(f"{filename}: header detected at row {header_row}")

    # Parse CSV starting from header row
    raw_df = None
    try:
        raw_df = pd.read_csv(
            io.BytesIO(clean_bytes),
            header=header_row,
            encoding="utf-8",
            on_bad_lines="skip",
            skip_blank_lines=False,
        )
        raw_df.columns = raw_df.columns.str.strip().str.strip('"')
    except Exception as e:
        result.errors.append(f"CSV parse error: {e}")
        return result

    # Locate required columns
    date_col   = _find_col(raw_df, cfg["date_cols"])
    desc_col   = _find_col(raw_df, cfg["desc_cols"])
    amount_col = _find_col(raw_df, cfg["amount_cols"])
    credit_col = _find_col(raw_df, cfg.get("credit_cols", []))
    member_col = _find_col(raw_df, cfg["member_cols"]) if cfg["member_cols"] else None

    if not date_col:
        result.errors.append(
            f"No date column found. Columns in file: {list(raw_df.columns)[:10]}"
        )
        return result

    if not amount_col:
        result.errors.append(
            f"No amount column found. Columns in file: {list(raw_df.columns)[:10]}"
        )
        return result

    result.raw_row_count = len(raw_df)

    # Parse members
    members = _extract_member(raw_df, member_col)

    # Process each row
    for idx in range(len(raw_df)):
        raw_date   = raw_df[date_col].iloc[idx]
        raw_amount = raw_df[amount_col].iloc[idx]
        raw_desc   = raw_df[desc_col].iloc[idx] if desc_col else "Unknown"

        # Parse date
        date = _parse_date(raw_date)
        if date is None:
            result.skipped_count += 1
            continue

        # Parse amount
        amount = _clean_amount(raw_amount)

        # For providers with separate Debit/Credit columns:
        # Debit = expense (positive), Credit = payment (negative/zero)
        # If amount is 0 and there's a credit column, skip (it's a payment)
        if amount == 0 and credit_col:
            credit = _clean_amount(raw_df[credit_col].iloc[idx])
            if credit > 0:
                result.skipped_count += 1
                continue

        if cfg["flip_sign"]:
            amount = -amount

        # Skip payments and credits (negative or zero amounts)
        if amount <= 0:
            result.skipped_count += 1
            continue

        # Parse description
        desc = str(raw_desc).strip().strip('"') if pd.notna(raw_desc) else "Unknown"

        # Categorise
        cat_name, subcat, is_essential = infer_category(desc, user_categories)

        # Large expense flag
        is_large = apply_large_expense_flag(amount, cat_name, thresholds)

        # Encrypt description
        desc_enc = encrypt(desc, encryption_key)

        member = str(members.iloc[idx])

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
