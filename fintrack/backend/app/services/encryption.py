# ============================================================
# fintrack — Encryption service (zero-knowledge model)
# File: backend/app/services/encryption.py
#
# Architecture:
#   - User's encryption key is derived from their password using Argon2id
#   - Key never leaves the device in a real client app; here the API
#     derives it server-side only during the session (Phase 1 simplification)
#   - All sensitive fields (description, account_label, etc.) are encrypted
#     with this key using NaCl SecretBox (XSalsa20-Poly1305)
#   - The DB stores only ciphertext — even a DB breach exposes nothing readable
# ============================================================

import os
import base64
import hashlib
from nacl.secret import SecretBox
from nacl.utils import random as nacl_random
from nacl.exceptions import CryptoError
from passlib.hash import argon2
from app.config import settings
import logging

logger = logging.getLogger("fintrack.encryption")

# Fixed known plaintext used to verify a key is correct
# without storing the key itself
_KEY_CHECK_PLAINTEXT = b"fintrack-key-check-v1"


def generate_kdf_salt() -> bytes:
    """Generate a fresh random salt for key derivation."""
    return nacl_random(32)


def derive_key(password: str, salt: bytes) -> bytes:
    """
    Derive a 32-byte encryption key from a password using Argon2id.
    The same password + salt always produces the same key.
    """
    # Use hashlib's scrypt as a PBKDF while argon2-cffi doesn't expose
    # raw key derivation easily — swap to argon2-low-level if needed
    key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2 ** settings.KDF_TIME_COST,   # CPU cost
        r=8,
        p=settings.KDF_PARALLELISM,
        dklen=settings.KDF_HASH_LENGTH,
    )
    return key


def make_key_check(key: bytes) -> bytes:
    """
    Encrypt a known plaintext with the derived key.
    Store this in user_keys.key_check to verify correct password later.
    """
    box = SecretBox(key)
    return box.encrypt(_KEY_CHECK_PLAINTEXT)


def verify_key(key: bytes, key_check: bytes) -> bool:
    """Return True if the key successfully decrypts the key_check blob."""
    try:
        box = SecretBox(key)
        plaintext = box.decrypt(key_check)
        return plaintext == _KEY_CHECK_PLAINTEXT
    except CryptoError:
        return False


def encrypt(plaintext: str, key: bytes) -> str:
    """
    Encrypt a string field. Returns base64-encoded ciphertext
    suitable for storing in a TEXT column.
    """
    if not plaintext:
        return ""
    box = SecretBox(key)
    ciphertext = box.encrypt(plaintext.encode("utf-8"))
    return base64.b64encode(ciphertext).decode("ascii")


def decrypt(ciphertext: str, key: bytes) -> str:
    """
    Decrypt a base64-encoded ciphertext field.
    Returns empty string if ciphertext is empty.
    Raises ValueError if decryption fails (wrong key or corrupted data).
    """
    if not ciphertext:
        return ""
    try:
        box = SecretBox(key)
        raw = base64.b64decode(ciphertext.encode("ascii"))
        return box.decrypt(raw).decode("utf-8")
    except (CryptoError, Exception) as e:
        logger.error(f"Decryption failed: {e}")
        raise ValueError("Decryption failed — wrong key or corrupted data")


def hash_password(password: str) -> str:
    """Hash a password with Argon2id for storage in users.password_hash."""
    return argon2.using(
        time_cost=settings.KDF_TIME_COST,
        memory_cost=settings.KDF_MEMORY_COST,
        parallelism=settings.KDF_PARALLELISM,
    ).hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored Argon2id hash."""
    return argon2.verify(password, password_hash)
