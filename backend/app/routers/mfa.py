# ============================================================
# fintrack — MFA router: /api/v1/mfa
# File: backend/app/routers/mfa.py
# Version: 1.0 — 2026-04-06
#
# Endpoints:
#   POST /api/v1/mfa/setup/totp      generate TOTP secret + QR code
#   POST /api/v1/mfa/verify/totp     verify TOTP code and enable MFA
#   POST /api/v1/mfa/setup/email     send email OTP for setup
#   POST /api/v1/mfa/verify/email    verify email OTP and enable MFA
#   POST /api/v1/mfa/challenge       verify MFA code during login
#   GET  /api/v1/mfa/status          current MFA status for user
#   DELETE /api/v1/mfa               disable MFA (requires password)
# ============================================================

import io
import base64
import secrets
import smtplib
import logging
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.models.user import User, EmailOTP
from app.services.auth import CurrentUser
from app.config import settings

logger = logging.getLogger("fintrack.mfa")
router = APIRouter()

APP_NAME = "fintrack"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _send_email(to_email: str, subject: str, body: str):
    """Send email via SMTP. Configure SMTP settings in .env"""
    smtp_host = getattr(settings, 'SMTP_HOST', None)
    smtp_port = int(getattr(settings, 'SMTP_PORT', 587))
    smtp_user = getattr(settings, 'SMTP_USER', None)
    smtp_pass = getattr(settings, 'SMTP_PASS', None)
    smtp_from = getattr(settings, 'SMTP_FROM', smtp_user)

    if not smtp_host or not smtp_user:
        logger.warning("SMTP not configured — email OTP cannot be sent")
        raise HTTPException(
            status_code=503,
            detail="Email service not configured. Use TOTP instead."
        )

    msg = MIMEMultipart()
    msg['From']    = smtp_from
    msg['To']      = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)


def _totp_qr_base64(secret: str, email: str) -> str:
    """Generate QR code image as base64 PNG string."""
    uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=email, issuer_name=APP_NAME
    )
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def _create_email_otp(user_id, purpose: str, db: Session) -> str:
    """Generate a 6-digit OTP, store in DB, return the code."""
    # Invalidate previous unused codes for same user/purpose
    db.execute(text("""
        UPDATE email_otp SET used = true
        WHERE user_id = :uid AND purpose = :purpose AND used = false
    """), {"uid": str(user_id), "purpose": purpose})

    code = str(secrets.randbelow(900000) + 100000)  # 100000-999999
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    db.execute(text("""
        INSERT INTO email_otp (user_id, code, purpose, expires_at)
        VALUES (:uid, :code, :purpose, :expires)
    """), {
        "uid":     str(user_id),
        "code":    code,
        "purpose": purpose,
        "expires": expires,
    })
    db.commit()
    return code


def _verify_email_otp(user_id, code: str, purpose: str, db: Session) -> bool:
    """Verify OTP code. Returns True if valid, marks as used."""
    row = db.execute(text("""
        SELECT id, expires_at, used
        FROM email_otp
        WHERE user_id = :uid
          AND code    = :code
          AND purpose = :purpose
          AND used    = false
        ORDER BY created_at DESC
        LIMIT 1
    """), {
        "uid":     str(user_id),
        "code":    code,
        "purpose": purpose,
    }).fetchone()

    if not row:
        return False
    if row.used:
        return False
    if datetime.now(timezone.utc) > row.expires_at.replace(tzinfo=timezone.utc):
        return False

    db.execute(text("UPDATE email_otp SET used = true WHERE id = :id"),
               {"id": str(row.id)})
    db.commit()
    return True


# ── TOTP setup ────────────────────────────────────────────────────────────────

@router.post("/setup/totp")
def setup_totp(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Generate a new TOTP secret and return QR code image."""
    secret = pyotp.random_base32()

    # Store secret (not yet verified/enabled)
    db.query(User).filter(User.id == current_user.id).update({
        "totp_secret": secret,
        "mfa_type":    "totp",
    })
    db.commit()

    qr_base64 = _totp_qr_base64(secret, current_user.email)

    return {
        "secret":    secret,
        "qr_image":  f"data:image/png;base64,{qr_base64}",
        "message":   "Scan the QR code with Google Authenticator or Authy, then verify with a 6-digit code.",
    }


# ── TOTP verify ───────────────────────────────────────────────────────────────

class TOTPVerify(BaseModel):
    code: str

@router.post("/verify/totp")
def verify_totp(
    body: TOTPVerify,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Verify TOTP code and enable MFA."""
    user = db.query(User).filter(User.id == current_user.id).first()

    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="TOTP not set up. Call /setup/totp first.")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.code.strip(), valid_window=2):
        raise HTTPException(status_code=400, detail="Invalid code. Try again.")

    db.query(User).filter(User.id == current_user.id).update({
        "mfa_enabled":  True,
        "mfa_verified": True,
        "mfa_type":     "totp",
    })
    db.commit()

    return {"status": "enabled", "mfa_type": "totp",
            "message": "TOTP MFA enabled successfully."}


# ── Email OTP setup ───────────────────────────────────────────────────────────

@router.post("/setup/email")
def setup_email_otp(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Send a 6-digit OTP to the user's email for MFA setup."""
    code = _create_email_otp(current_user.id, 'mfa_setup', db)

    _send_email(
        to_email=current_user.email,
        subject="fintrack — MFA Setup Code",
        body=f"""Your fintrack MFA setup code is:

  {code}

This code expires in 10 minutes. Do not share it with anyone.

If you did not request this, please ignore this email.
"""
    )

    db.query(User).filter(User.id == current_user.id).update({"mfa_type": "email"})
    db.commit()

    return {"message": f"Verification code sent to {current_user.email}. Enter it to enable email MFA."}


# ── Email OTP verify ──────────────────────────────────────────────────────────

class EmailOTPVerify(BaseModel):
    code: str

@router.post("/verify/email")
def verify_email_otp(
    body: EmailOTPVerify,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Verify email OTP and enable email MFA."""
    if not _verify_email_otp(current_user.id, body.code.strip(), 'mfa_setup', db):
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    db.query(User).filter(User.id == current_user.id).update({
        "mfa_enabled":  True,
        "mfa_verified": True,
        "mfa_type":     "email",
    })
    db.commit()

    return {"status": "enabled", "mfa_type": "email",
            "message": "Email MFA enabled successfully."}


# ── Login challenge ───────────────────────────────────────────────────────────

class MFAChallenge(BaseModel):
    code: str

@router.post("/challenge")
def mfa_challenge(
    body: MFAChallenge,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """
    Verify MFA code during login flow.
    Called after password is verified, before issuing final JWT tokens.
    """
    user = db.query(User).filter(User.id == current_user.id).first()

    if not user.mfa_enabled:
        return {"status": "not_required"}

    if user.mfa_type == 'totp':
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(body.code.strip(), valid_window=2):
            raise HTTPException(status_code=400, detail="Invalid authenticator code.")

    elif user.mfa_type == 'email':
        if not _verify_email_otp(user.id, body.code.strip(), 'login', db):
            raise HTTPException(status_code=400, detail="Invalid or expired email code.")

    return {"status": "verified", "mfa_type": user.mfa_type}


# ── Send login OTP (email MFA only) ──────────────────────────────────────────

@router.post("/send-login-otp")
def send_login_otp(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Send a login OTP for email-based MFA users."""
    user = db.query(User).filter(User.id == current_user.id).first()

    if user.mfa_type != 'email':
        raise HTTPException(status_code=400, detail="User is not using email MFA.")

    code = _create_email_otp(user.id, 'login', db)

    _send_email(
        to_email=user.email,
        subject="fintrack — Login Code",
        body=f"""Your fintrack login code is:

  {code}

This code expires in 10 minutes. Do not share it with anyone.
"""
    )

    return {"message": f"Login code sent to {user.email}."}


# ── MFA status ────────────────────────────────────────────────────────────────

@router.get("/status")
def mfa_status(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    return {
        "mfa_enabled":  user.mfa_enabled,
        "mfa_verified": user.mfa_verified,
        "mfa_type":     user.mfa_type,
    }


# ── Disable MFA ───────────────────────────────────────────────────────────────

class DisableMFA(BaseModel):
    password: str

@router.delete("")
def disable_mfa(
    body: DisableMFA,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Disable MFA. Requires current password for confirmation."""
    from app.services.auth import verify_password
    user = db.query(User).filter(User.id == current_user.id).first()

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    db.query(User).filter(User.id == current_user.id).update({
        "mfa_enabled":  False,
        "mfa_verified": False,
        "mfa_type":     "none",
        "totp_secret":  None,
    })
    db.commit()

    return {"status": "disabled", "message": "MFA has been disabled."}


# ── MFA Recovery ──────────────────────────────────────────────────────────────

class RecoveryRequest(BaseModel):
    email: str

class RecoveryVerify(BaseModel):
    email: str
    code:  str

@router.post("/recover/send")
def send_recovery_code(
    body: RecoveryRequest,
    db: Session = Depends(get_db),
):
    """
    Send a recovery code to the user's email.
    Called WITHOUT authentication — user has lost their MFA device.
    Always returns 200 to prevent email enumeration.
    """
    from app.models.user import User
    user = db.query(User).filter(
        User.email     == body.email,
        User.is_active == True,
        User.mfa_enabled == True,
    ).first()

    if user:
        code = _create_email_otp(user.id, 'recovery', db)
        try:
            _send_email(
                to_email=user.email,
                subject="fintrack — MFA Recovery Code",
                body=f"""Your fintrack MFA recovery code is:

  {code}

This code expires in 10 minutes and can only be used once.

After entering this code you will be required to set up
MFA again before accessing your account.

If you did not request this, your account may be at risk.
Please contact support immediately.
"""
            )
        except Exception as e:
            logger.error(f"Recovery email failed: {e}")

    # Always return 200 — never reveal if email exists
    return {"message": "If that email has an account with MFA enabled, a recovery code has been sent."}


@router.post("/recover/verify")
def verify_recovery_code(
    body: RecoveryVerify,
    db: Session = Depends(get_db),
):
    """
    Verify recovery code and return a temporary token.
    MFA is disabled on the account — user must re-enroll immediately.
    """
    from app.models.user import User
    from app.services.token import create_access_token, create_refresh_token

    user = db.query(User).filter(
        User.email     == body.email,
        User.is_active == True,
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    if not _verify_email_otp(user.id, body.code.strip(), 'recovery', db):
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    # Disable MFA — user must re-enroll after login
    db.query(User).filter(User.id == user.id).update({
        "mfa_enabled":  False,
        "mfa_verified": False,
        "mfa_type":     "none",
        "totp_secret":  None,
    })
    db.commit()

    logger.info(f"MFA recovery used for {user.email} — MFA disabled, re-enrollment required")

    return {
        "access_token":  create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "email":         user.email,
        "user_id":       str(user.id),
        "mfa_required":  False,
        "mfa_type":      "none",
        "recovery":      True,   # signals frontend to force MFA re-enrollment
    }
