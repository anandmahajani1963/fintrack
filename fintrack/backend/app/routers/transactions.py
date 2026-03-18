# ============================================================
# fintrack — Transactions router: /api/v1/transactions
# File: backend/app/routers/transactions.py
#
# Endpoints:
#   POST /api/v1/transactions/import   — upload and import a CSV file
#   GET  /api/v1/transactions          — list transactions (paginated)
#   GET  /api/v1/transactions/{id}     — single transaction (decrypted)
#   GET  /api/v1/transactions/accounts — list user's card accounts
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import logging
import uuid

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
    """Derive the user's encryption key from their password."""
    user_key = db.query(UserKey).filter(UserKey.user_id == user_id).first()
    if not user_key:
        raise HTTPException(status_code=500, detail="Encryption key material not found")
    return derive_key(password, bytes(user_key.kdf_salt))


def _get_thresholds(user_id, db: Session) -> dict[str, float]:
    """Load large-expense thresholds for user."""
    rows = db.execute(
        text("SELECT category_name, threshold FROM expense_thresholds WHERE user_id = :uid"),
        {"uid": str(user_id)}
    ).fetchall()
    return {row.category_name: float(row.threshold) for row in rows}


def _get_or_create_account(
    user_id, provider: str, member_name: str,
    encryption_key: bytes, db: Session
) -> Account:
    """
    Find an existing account matching provider + member, or create one.
    account_label and member_name are stored encrypted.
    """
    # Load existing accounts and decrypt to find match
    accounts = db.query(Account).filter(
        Account.user_id  == user_id,
        Account.provider == provider,
        Account.is_active == True,
    ).all()

    for acc in accounts:
        try:
            dec_member = decrypt(acc.member_name or "", encryption_key)
            if dec_member == member_name:
                return acc
        except Exception:
            continue

    # Create new account
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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/import", status_code=status.HTTP_201_CREATED)
def import_csv(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    file:     UploadFile = File(..., description="Credit card CSV file"),
    provider: str        = Form(..., description="Card provider: citi, amex, or chase"),
    password: str        = Form(..., description="Your fintrack password (for key derivation)"),
):
    """
    Upload and import a credit card CSV file.

    The password is used to derive the encryption key on the fly —
    it is never stored. The key is used to encrypt merchant names
    before writing to the database.
    """
    provider = provider.lower().strip()
    if provider not in ("citi", "amex", "chase"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="provider must be one of: citi, amex, chase",
        )

    # Read file bytes
    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Derive encryption key from password
    try:
        enc_key = _get_user_key(current_user.id, password, db)
    except Exception:
        raise HTTPException(status_code=401, detail="Password incorrect")

    # Load user categories and thresholds
    user_categories = get_user_categories(current_user.id, db)
    thresholds      = _get_thresholds(current_user.id, db)

    # Parse CSV
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

    # Group rows by member and insert
    inserted = 0
    duplicates = 0
    accounts_created = []

    for row in result.rows:
        # Get or create account for this member
        account = _get_or_create_account(
            current_user.id, provider, row.member_name, enc_key, db
        )
        if str(account.id) not in accounts_created:
            accounts_created.append(str(account.id))

        # Find category_id
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
            is_essential  = row.is_essential,
            is_large      = row.is_large,
            source_file   = row.source_file,
            source_type   = "csv_import",
        )
        try:
            db.add(txn)
            db.flush()
            inserted += 1
        except Exception:
            db.rollback()
            duplicates += 1
            continue

    db.commit()

    logger.info(
        f"Import complete for user {current_user.email}: "
        f"{inserted} inserted, {duplicates} duplicates skipped"
    )

    return {
        "status":        "success",
        "file":          file.filename,
        "provider":      provider,
        "raw_rows":      result.raw_row_count,
        "imported":      inserted,
        "skipped":       result.skipped_count,
        "duplicates":    duplicates,
        "accounts":      len(accounts_created),
    }


@router.get("/accounts")
def list_accounts(
    current_user: CurrentUser,
    password: str = Query(..., description="Your fintrack password"),
    db: Session = Depends(get_db),
):
    """List all card accounts for the current user (decrypted)."""
    enc_key = _get_user_key(current_user.id, password, db)
    accounts = db.query(Account).filter(
        Account.user_id  == current_user.id,
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
    password:  str           = Query(...),
    year:      Optional[int] = Query(None, description="Filter by year"),
    month:     Optional[int] = Query(None, description="Filter by month 1-12"),
    category:  Optional[str] = Query(None),
    is_large:  Optional[bool]= Query(None),
    page:      int           = Query(1, ge=1),
    page_size: int           = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    List transactions for the current user, paginated.
    Merchant descriptions are decrypted in the response.
    """
    enc_key = _get_user_key(current_user.id, password, db)

    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if year:
        query = query.filter(Transaction.year_num == year)
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
                "id":          str(t.id),
                "date":        t.txn_date.isoformat(),
                "amount":      float(t.amount),
                "description": decrypt(t.description, enc_key),
                "category":    t.category_name,
                "is_essential":t.is_essential,
                "is_large":    t.is_large,
                "source_file": t.source_file,
            }
            for t in rows
        ],
    }
