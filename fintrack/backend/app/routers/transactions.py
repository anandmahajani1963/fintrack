# ============================================================
# fintrack — Transactions router: /api/v1/transactions
# File: backend/app/routers/transactions.py
#
# Version History:
#   v1.0  2026-03-18  Initial implementation — import, list, accounts endpoints
#   v1.1  2026-03-20  Fixed: generated column error (month_num, year_num)
#   v1.2  2026-03-22  Fixed: duplicate detection logic rewritten (no per-row
#                     try/except rollback; uses pre-check query instead)
#   v1.3  2026-03-23  Added subcategory to Transaction insert
#   v1.4  2026-03-30  Password moved from query param to X-Fintrack-Password header
#                     for accounts and list endpoints. Import keeps Form (POST body).
#                     Fixed: subcategory was missing from constructor call
#
# Endpoints:
#   POST /api/v1/transactions/import    upload and import a CSV file
#   GET  /api/v1/transactions           list transactions (paginated, decrypted)
#   GET  /api/v1/transactions/accounts  list card accounts (decrypted)
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import logging

from app.database import get_db
from app.models.user import Account, UserKey
from app.models.transaction import Transaction, Category, ExpenseThreshold
from app.services.auth import CurrentUser
from app.services.encryption import encrypt, decrypt, derive_key
from app.services.importer import parse_csv
from app.services.categorizer import get_user_categories

logger = logging.getLogger("fintrack.transactions")
router = APIRouter()


def _get_user_key(user_id, password: str, db: Session) -> bytes:
    user_key = db.query(UserKey).filter(UserKey.user_id == user_id).first()
    if not user_key:
        raise HTTPException(status_code=500, detail="Encryption key material not found")
    return derive_key(password, bytes(user_key.kdf_salt))


def _get_thresholds(user_id, db: Session) -> dict:
    rows = db.execute(
        text("SELECT category_name, threshold FROM expense_thresholds WHERE user_id = :uid"),
        {"uid": str(user_id)}
    ).fetchall()
    return {row.category_name: float(row.threshold) for row in rows}


def _get_or_create_account(
    user_id, provider: str, member_name: str,
    encryption_key: bytes, db: Session
) -> Account:
    accounts = db.query(Account).filter(
        Account.user_id   == user_id,
        Account.provider  == provider,
        Account.is_active == True,
    ).all()

    for acc in accounts:
        try:
            dec_member = decrypt(acc.member_name or "", encryption_key)
            if dec_member == member_name:
                return acc
        except Exception:
            continue

    label = f"{provider.title()} — {member_name}"
    acc = Account(
        user_id       = user_id,
        provider      = provider,
        account_label = encrypt(label, encryption_key),
        member_name   = encrypt(member_name, encryption_key),
        last_four     = encrypt("", encryption_key),
        source_type   = "csv_import",
    )
    db.add(acc)
    db.flush()
    return acc


@router.post("/import", status_code=status.HTTP_201_CREATED)
def import_csv(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    file:     UploadFile = File(...),
    provider: str        = Form(..., description="citi, amex, or chase"),
    password: str        = Form(..., description="Your fintrack password"),
):
    provider = provider.lower().strip()
    if provider not in ("citi", "amex", "chase"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="provider must be one of: citi, amex, chase",
        )

    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        enc_key = _get_user_key(current_user.id, password, db)
    except Exception:
        raise HTTPException(status_code=401, detail="Password incorrect")

    user_categories = get_user_categories(current_user.id, db)
    thresholds      = _get_thresholds(current_user.id, db)

    result = parse_csv(
        file_bytes      = file_bytes,
        filename        = file.filename,
        provider        = provider,
        encryption_key  = enc_key,
        user_categories = user_categories,
        thresholds      = thresholds,
    )

    if result.errors:
        raise HTTPException(status_code=422, detail=result.errors)

    inserted       = 0
    duplicates     = 0
    accounts_cache = {}

    for row in result.rows:
        if row.member_name not in accounts_cache:
            accounts_cache[row.member_name] = _get_or_create_account(
                current_user.id, provider, row.member_name, enc_key, db
            )
        account = accounts_cache[row.member_name]

        # Duplicate check — plaintext fields only (description ciphertext
        # differs every call due to random nonce so cannot be compared)
        existing = db.query(Transaction).filter(
            Transaction.account_id  == account.id,
            Transaction.txn_date    == row.txn_date,
            Transaction.amount      == row.amount,
            Transaction.source_file == row.source_file,
        ).first()

        if existing:
            duplicates += 1
            continue

        cat = db.query(Category).filter(
            Category.user_id == current_user.id,
            Category.name    == row.category_name,
        ).first()

        txn = Transaction(
            account_id    = account.id,
            user_id       = current_user.id,
            txn_date      = row.txn_date,
            amount        = row.amount,
            description   = row.description_enc,
            category_id   = cat.id if cat else None,
            category_name = row.category_name,
            subcategory   = row.subcategory,
            is_essential  = row.is_essential,
            is_large      = row.is_large,
            source_file   = row.source_file,
            source_type   = "csv_import",
        )
        db.add(txn)
        inserted += 1

    db.commit()

    logger.info(
        f"Import complete for {current_user.email}: "
        f"{inserted} inserted, {duplicates} duplicates, "
        f"{result.skipped_count} skipped"
    )

    return {
        "status":     "success",
        "file":       file.filename,
        "provider":   provider,
        "raw_rows":   result.raw_row_count,
        "imported":   inserted,
        "skipped":    result.skipped_count,
        "duplicates": duplicates,
        "accounts":   len(accounts_cache),
    }


@router.get("/accounts")
def list_accounts(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    password: str = Header(..., alias="x-fintrack-password",
                           description="Your fintrack password for key derivation"),
):
    enc_key  = _get_user_key(current_user.id, password, db)
    accounts = db.query(Account).filter(
        Account.user_id   == current_user.id,
        Account.is_active == True,
    ).all()

    return [
        {
            "id":       str(acc.id),
            "provider": acc.provider,
            "label":    decrypt(acc.account_label, enc_key),
            "member":   decrypt(acc.member_name or "", enc_key),
            "source":   acc.source_type,
            "created":  acc.created_at.isoformat(),
        }
        for acc in accounts
    ]


@router.get("")
def list_transactions(
    current_user: CurrentUser,
    password:  str           = Header(..., alias="x-fintrack-password"),
    year:      Optional[int] = Query(None),
    month:     Optional[int] = Query(None),
    category:  Optional[str] = Query(None),
    is_large:  Optional[bool]= Query(None),
    page:      int           = Query(1, ge=1),
    page_size: int           = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    enc_key = _get_user_key(current_user.id, password, db)

    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if year:
        query = query.filter(Transaction.year_num  == year)
    if month:
        query = query.filter(Transaction.month_num == month)
    if category:
        query = query.filter(Transaction.category_name == category)
    if is_large is not None:
        query = query.filter(Transaction.is_large == is_large)

    total = query.count()
    rows  = query.order_by(Transaction.txn_date.desc()) \
                 .offset((page - 1) * page_size) \
                 .limit(page_size) \
                 .all()

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     (total + page_size - 1) // page_size,
        "items": [
            {
                "id":           str(t.id),
                "date":         t.txn_date.isoformat(),
                "amount":       float(t.amount),
                "description":  decrypt(t.description, enc_key),
                "category":     t.category_name,
                "is_essential": t.is_essential,
                "is_large":     t.is_large,
                "source_file":  t.source_file,
            }
            for t in rows
        ],
    }



# ── List all categories (for dropdowns) ───────────────────────────────────────

@router.get("/categories")
def list_categories(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """
    Return all categories defined for this user regardless of whether
    they have any transactions. Used for dropdowns in the UI.
    Version: 1.0 — 2026-04-01
    """
    cats = db.query(Category).filter(
        Category.user_id == current_user.id
    ).order_by(Category.sort_order, Category.name).all()
    return [
        {
            "name":        c.name,
            "subcategory": c.subcategory or c.name,
            "is_essential":c.is_essential,
            "color_code":  c.color_code,
        }
        for c in cats
    ]




# ── List all categories (for dropdowns) ───────────────────────────────────────

@router.get("/categories")
def list_categories(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """
    Return all categories defined for the user — regardless of whether
    they have any transactions. Used by the Reconciliation dropdown so
    new categories (e.g. Travel/International) appear immediately.
    """
    cats = db.query(Category).filter(
        Category.user_id == current_user.id
    ).order_by(Category.sort_order, Category.name).all()
    return [
        {
            "name":        c.name,
            "subcategory": c.subcategory or c.name,
            "is_essential":c.is_essential,
            "color_code":  c.color_code,
        }
        for c in cats
    ]

# ── Category update endpoint ───────────────────────────────────────────────────

from pydantic import BaseModel as PydanticBase

class CategoryUpdate(PydanticBase):
    category_name: str
    subcategory:   str

@router.patch("/{transaction_id}/category", status_code=200)
def update_transaction_category(
    transaction_id: str,
    body: CategoryUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """
    Update the category and subcategory of a single transaction.
    Used by the Reconciliation page inline editor.
    Only the transaction owner can update their own transactions.
    """
    from sqlalchemy import text as sql_text
    import uuid

    # Verify transaction belongs to this user
    txn = db.query(Transaction).filter(
        Transaction.id      == uuid.UUID(transaction_id),
        Transaction.user_id == current_user.id,
    ).first()

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Look up is_essential from categories table
    cat = db.query(Category).filter(
        Category.user_id    == current_user.id,
        Category.name       == body.category_name,
        Category.subcategory == body.subcategory,
    ).first()

    txn.category_name = body.category_name
    txn.subcategory   = body.subcategory
    txn.is_essential  = cat.is_essential if cat else False

    db.commit()

    return {
        "id":           str(txn.id),
        "category_name":txn.category_name,
        "subcategory":  txn.subcategory,
        "is_essential": txn.is_essential,
    }
