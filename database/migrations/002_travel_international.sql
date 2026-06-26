-- ============================================================
-- fintrack Migration 002 — Add Travel/International subcategory
-- File: database/migrations/002_travel_international.sql
-- Version: 1.0 — 2026-03-31
--
-- Run on DB VM:
--   docker exec -i fintrack_db psql -U fintrack -d fintrack \
--     < ~/fintrack/database/migrations/002_travel_international.sql
-- ============================================================

BEGIN;

-- Add Travel/International to default_categories
INSERT INTO default_categories (name, subcategory, parent_category, is_essential, color_code, keywords, sort_order)
VALUES (
    'Travel', 'International', NULL, false, '#0277BD',
    ARRAY['duty free','currency exchange','forex','travel insurance',
          'international','foreign transaction','global entry','tsa precheck'],
    33
) ON CONFLICT (name, subcategory) DO UPDATE
    SET keywords = EXCLUDED.keywords;

-- Add to each user's categories table
INSERT INTO categories (user_id, name, subcategory, parent_category, is_essential, color_code, keywords, sort_order)
SELECT
    u.id,
    'Travel', 'International', NULL, false, '#0277BD',
    ARRAY['duty free','currency exchange','forex','travel insurance',
          'international','foreign transaction','global entry','tsa precheck'],
    33
FROM users u
ON CONFLICT (user_id, name, subcategory) DO UPDATE
    SET keywords = EXCLUDED.keywords;

COMMIT;

SELECT 'Migration 002 complete' AS status;
SELECT name, subcategory, sort_order
FROM default_categories
WHERE name = 'Travel'
ORDER BY sort_order;
