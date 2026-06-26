-- ============================================================
-- fintrack — PostgreSQL 17 initialisation script
-- Runs automatically on first container start
-- File: database/init/01_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Column-level encryption
CREATE EXTENSION IF NOT EXISTS "citext";       -- Case-insensitive text (for email)

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         CITEXT      UNIQUE NOT NULL,
    password_hash TEXT        NOT NULL,        -- Argon2id hash (never plaintext)
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login    TIMESTAMPTZ
);

-- ============================================================
-- ENCRYPTION KEY MATERIAL
-- One row per user — key itself never stored, only derivation params
-- ============================================================
CREATE TABLE user_keys (
    user_id       UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    kdf_salt      BYTEA       NOT NULL,   -- Salt for Argon2id key derivation
    key_check     BYTEA       NOT NULL,   -- Encrypted known value to verify correct key
    recovery_hash TEXT,                   -- Hashed recovery phrase (optional)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CARD ACCOUNTS
-- Sensitive fields encrypted at application layer before insert
-- ============================================================
CREATE TABLE accounts (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      TEXT        NOT NULL CHECK (provider IN ('citi','amex','chase','other')),
    account_label TEXT        NOT NULL,   -- encrypted: e.g. "Citi Costco - Jane"
    member_name   TEXT,                   -- encrypted: cardholder name
    last_four     TEXT,                   -- encrypted: last 4 digits
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    source_type   TEXT        NOT NULL DEFAULT 'csv_import'
                              CHECK (source_type IN ('csv_import','plaid_live')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- User-customizable, seeded with defaults on first login
-- ============================================================
CREATE TABLE categories (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    is_essential  BOOLEAN     NOT NULL DEFAULT false,
    color_code    TEXT        NOT NULL DEFAULT '#808080',  -- hex colour for UI
    keywords      TEXT[]      NOT NULL DEFAULT '{}',       -- keyword matching array
    sort_order    SMALLINT    NOT NULL DEFAULT 99,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

-- ============================================================
-- TRANSACTIONS
-- Core financial data. Sensitive: description encrypted.
-- amount, txn_date, category_id stored plaintext for SQL aggregations.
-- ============================================================
CREATE TABLE transactions (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id    UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    txn_date      DATE        NOT NULL,
    month_num     SMALLINT    NOT NULL GENERATED ALWAYS AS (EXTRACT(MONTH FROM txn_date)::SMALLINT) STORED,
    year_num      SMALLINT    NOT NULL GENERATED ALWAYS AS (EXTRACT(YEAR  FROM txn_date)::SMALLINT) STORED,
    amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description   TEXT        NOT NULL,   -- encrypted merchant name
    category_id   UUID        REFERENCES categories(id) ON DELETE SET NULL,
    category_name TEXT        NOT NULL DEFAULT 'Other',  -- denormalised for fast queries
    is_essential  BOOLEAN     NOT NULL DEFAULT false,
    is_large      BOOLEAN     NOT NULL DEFAULT false,    -- flagged by threshold rule
    source_file   TEXT,                                  -- original CSV filename
    source_type   TEXT        NOT NULL DEFAULT 'csv_import',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate imports of the same transaction
    UNIQUE (account_id, txn_date, amount, description)
);

-- ============================================================
-- LARGE EXPENSE THRESHOLDS
-- User-defined per-category thresholds that trigger is_large flag
-- ============================================================
CREATE TABLE expense_thresholds (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_name TEXT        NOT NULL DEFAULT 'ALL',  -- 'ALL' = applies to every category
    threshold     NUMERIC(12,2) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, category_name)
);

-- ============================================================
-- AUDIT LOG
-- Every significant action recorded — immutable append-only
-- ============================================================
CREATE TABLE audit_log (
    id            BIGSERIAL   PRIMARY KEY,
    user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
    action        TEXT        NOT NULL,  -- 'register','login','import','export','ai_query'
    ip_address    INET,
    metadata      JSONB       NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- Designed for the query patterns in analytics endpoints
-- ============================================================

-- Transaction lookups by user + date range (most common query)
CREATE INDEX idx_txn_user_date
    ON transactions (user_id, txn_date DESC);

-- Monthly pivot queries
CREATE INDEX idx_txn_user_year_month
    ON transactions (user_id, year_num, month_num);

-- Category filtering
CREATE INDEX idx_txn_user_category
    ON transactions (user_id, category_name);

-- Large expense queries
CREATE INDEX idx_txn_large
    ON transactions (user_id, is_large) WHERE is_large = true;

-- Account lookup
CREATE INDEX idx_txn_account
    ON transactions (account_id);

-- Audit log queries by user
CREATE INDEX idx_audit_user
    ON audit_log (user_id, created_at DESC);

-- ============================================================
-- DEFAULT CATEGORIES
-- Seeded once — each new user gets their own copy via the API
-- This table holds the master defaults only
-- ============================================================
CREATE TABLE default_categories (
    name         TEXT    PRIMARY KEY,
    is_essential BOOLEAN NOT NULL,
    color_code   TEXT    NOT NULL,
    keywords     TEXT[]  NOT NULL,
    sort_order   SMALLINT NOT NULL
);

INSERT INTO default_categories (name, is_essential, color_code, keywords, sort_order) VALUES
('Groceries',     true,  '#2E7D32', ARRAY['grocery','supermarket','whole foods','trader joe','safeway','kroger','publix','tom thumb','aldi','sprouts','heb','food lion','wegmans','winn-dixie','fresh market'], 1),
('Utilities',     true,  '#1565C0', ARRAY['electric','water','internet','cable','at&t','verizon','t-mobile','comcast','spectrum','duke energy','xfinity'], 2),
('Health',        true,  '#AD1457', ARRAY['pharmacy','cvs','walgreens','rite aid','doctor','dentist','hospital','medical','health','gym','fitness','urgent care'], 3),
('Insurance',     true,  '#4527A0', ARRAY['insurance','geico','allstate','progressive','state farm','farmers','liberty mutual','nationwide'], 4),
('Transport',     true,  '#00695C', ARRAY['uber','lyft','taxi','transit','metro','train','parking','toll','shell','exxon','chevron','sunoco','marathon','valero','airline','flight','amtrak'], 5),
('Education',     true,  '#E65100', ARRAY['tuition','university','college','coursera','udemy'], 6),
('Dining',        false, '#F57F17', ARRAY['restaurant','cafe','coffee','starbucks','mcdonald','subway','pizza','sushi','doordash','grubhub','dining','tavern','grill','bistro','diner','chick-fil','chipotle','panera'], 7),
('Shopping',      false, '#558B2F', ARRAY['amazon','walmart','target','ebay','etsy','best buy','apple store','nike','zara','gap','nordstrom','macy','tj maxx','marshalls'], 8),
('Entertainment', false, '#6A1B9A', ARRAY['netflix','spotify','hulu','disney','apple tv','cinema','movie','theater','concert','ticketmaster','steam','gaming','playstation','xbox'], 9),
('Travel',        false, '#0277BD', ARRAY['hotel','motel','resort','lodge','suites','airbnb','vrbo','marriott','hilton','hyatt','hampton inn','holiday inn','sheraton','expedia','hertz','enterprise'], 10),
('Personal Care', false, '#37474F', ARRAY['salon','spa','haircut','barber','beauty','nail'], 11),
('Other',         false, '#9E9E9E', ARRAY[]::TEXT[], 99);

-- ============================================================
-- VIEWS
-- Pre-built for common API queries
-- ============================================================

-- Monthly spend by category (used by Monthly Summary sheet equivalent)
CREATE VIEW v_monthly_category_spend AS
SELECT
    t.user_id,
    t.year_num,
    t.month_num,
    TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
    t.category_name,
    c.is_essential,
    c.color_code,
    SUM(t.amount)   AS total_amount,
    COUNT(*)        AS txn_count
FROM transactions t
LEFT JOIN categories c ON c.user_id = t.user_id AND c.name = t.category_name
GROUP BY t.user_id, t.year_num, t.month_num, t.txn_date, t.category_name, c.is_essential, c.color_code;

-- Annual category summary (used by Category Summary sheet equivalent)
CREATE VIEW v_annual_category_spend AS
SELECT
    t.user_id,
    t.year_num,
    t.category_name,
    c.is_essential,
    c.color_code,
    SUM(t.amount)                              AS total_amount,
    COUNT(*)                                   AS txn_count,
    SUM(t.amount) / SUM(SUM(t.amount)) OVER (PARTITION BY t.user_id, t.year_num) AS pct_of_total
FROM transactions t
LEFT JOIN categories c ON c.user_id = t.user_id AND c.name = t.category_name
GROUP BY t.user_id, t.year_num, t.category_name, c.is_essential, c.color_code;

-- Large expenses
CREATE VIEW v_large_expenses AS
SELECT
    t.user_id,
    t.txn_date,
    t.amount,
    t.description,   -- still encrypted — decrypted at API layer
    t.category_name,
    t.is_essential,
    a.provider,
    a.account_label  -- still encrypted
FROM transactions t
JOIN accounts a ON a.id = t.account_id
WHERE t.is_large = true
ORDER BY t.amount DESC;

-- ============================================================
-- PERMISSIONS
-- Restrict fintrack app user to minimum required privileges
-- ============================================================
-- (Run as superuser after schema creation)

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON users, user_keys, accounts, categories, transactions,
       expense_thresholds, audit_log
    TO fintrack;

GRANT SELECT ON default_categories TO fintrack;
GRANT SELECT ON v_monthly_category_spend, v_annual_category_spend, v_large_expenses TO fintrack;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO fintrack;
