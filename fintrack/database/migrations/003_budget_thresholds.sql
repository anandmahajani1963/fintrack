-- ============================================================
-- fintrack Migration 003 — Budget thresholds enhancement
-- File: database/migrations/003_budget_thresholds.sql
-- Version: 1.0 — 2026-04-05
-- ============================================================

BEGIN;

ALTER TABLE expense_thresholds
    ADD COLUMN IF NOT EXISTS period      TEXT    NOT NULL DEFAULT 'monthly'
                                         CHECK (period IN ('monthly', 'annual')),
    ADD COLUMN IF NOT EXISTS subcategory TEXT,
    ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE expense_thresholds
    DROP CONSTRAINT IF EXISTS expense_thresholds_user_id_category_name_key;

ALTER TABLE expense_thresholds
    ADD CONSTRAINT expense_thresholds_user_category_period_key
    UNIQUE (user_id, category_name, subcategory, period);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expense_thresholds_updated_at ON expense_thresholds;
CREATE TRIGGER expense_thresholds_updated_at
    BEFORE UPDATE ON expense_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
SELECT 'Migration 003 complete' AS status;
