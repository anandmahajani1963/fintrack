-- ============================================================
-- fintrack Migration 004 — MFA support
-- File: database/migrations/004_mfa.sql
-- Version: 1.0 — 2026-04-06
--
-- Adds MFA columns to users table and creates email_otp table.
--
-- Run on DB VM:
--   docker exec -i fintrack_db psql -U fintrack -d fintrack \
--     < ~/fintrack/database/migrations/004_mfa.sql
-- ============================================================

BEGIN;

-- Add MFA columns to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS mfa_type     TEXT    DEFAULT 'none'
                                          CHECK (mfa_type IN ('none','totp','email')),
    ADD COLUMN IF NOT EXISTS mfa_enabled  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS mfa_verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS totp_secret  TEXT;

-- Email OTP table — stores temporary codes with expiry
CREATE TABLE IF NOT EXISTS email_otp (
    id          UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code        TEXT        NOT NULL,
    purpose     TEXT        NOT NULL DEFAULT 'login'
                            CHECK (purpose IN ('login','mfa_setup')),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
    used        BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_otp_user_id_idx ON email_otp(user_id);

COMMIT;

SELECT 'Migration 004 complete' AS status;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('mfa_type','mfa_enabled','mfa_verified','totp_secret')
ORDER BY column_name;
