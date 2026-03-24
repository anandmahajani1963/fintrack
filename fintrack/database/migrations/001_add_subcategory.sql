-- ============================================================
-- fintrack Migration 001 (v3) — Add subcategory support
-- Run on DB VM:
--   docker exec -i fintrack_db psql -U fintrack -d fintrack \
--     < ~/fintrack/database/migrations/001_add_subcategory.sql
-- ============================================================

BEGIN;

-- 1. Add subcategory to transactions and categories
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS subcategory TEXT;

ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS subcategory     TEXT,
    ADD COLUMN IF NOT EXISTS parent_category TEXT;

-- 2. Add columns to default_categories FIRST (before touching primary key)
ALTER TABLE default_categories
    ADD COLUMN IF NOT EXISTS subcategory     TEXT,
    ADD COLUMN IF NOT EXISTS parent_category TEXT;

-- 3. Populate nulls in existing rows before adding primary key
--    (existing rows from original schema have name only, set subcategory = name)
UPDATE default_categories
    SET subcategory = name
    WHERE subcategory IS NULL;

-- 4. NOW drop old primary key and add composite one
ALTER TABLE default_categories DROP CONSTRAINT IF EXISTS default_categories_pkey;
ALTER TABLE default_categories ADD PRIMARY KEY (name, subcategory);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_txn_subcategory ON transactions (user_id, subcategory);
CREATE INDEX IF NOT EXISTS idx_txn_cat_subcat  ON transactions (user_id, category_name, subcategory);

-- 6. Reseed default_categories with full expanded list
TRUNCATE default_categories;

INSERT INTO default_categories (name, subcategory, parent_category, is_essential, color_code, keywords, sort_order) VALUES
('Groceries','Grocery Store',NULL,true,'#2E7D32',ARRAY['grocery','supermarket','whole foods','trader joe','safeway','kroger','publix','tom thumb','aldi','sprouts','heb ','food lion','wegmans','winn-dixie','fresh market'],1),
('Groceries','Ethnic Grocery',NULL,true,'#388E3C',ARRAY['indian plaza','indifresh','patel brothers','sp soul foods','cherians','bombay bazaar'],2),
('Groceries','Warehouse Club - Food',NULL,true,'#43A047',ARRAY['costco whse','sams club','bjs wholesale'],3),
('Dining','Fast Food',NULL,false,'#F57F17',ARRAY['mcdonald','subway','chick-fil','chipotle','taco bell','wendy','burger king','panera','ihop','denny','papa johns','schlotzsky'],10),
('Dining','Restaurant',NULL,false,'#F9A825',ARRAY['restaurant','sushi','dining','tavern','grill','bistro','diner','pf changs','sri krishna vilas','tgi friday','thai basil','the curry kitchen','kakatiya indian kitch','eclipse di luna','tst* tasty delights','flames mediterranean','cinco mexican cantina','tst*indi fresh','ramirez mexican restauran','village italian','cantina','las palmas mexican','mh15','tst* indi fresh'],11),
('Dining','Coffee & Cafe',NULL,false,'#FFB300',ARRAY['starbucks','coffee','cafe','dunkin','dutch bros'],12),
('Dining','Food Delivery',NULL,false,'#FFCA28',ARRAY['doordash','grubhub','uber eats','instacart'],13),
('Transport','Fuel',NULL,true,'#00695C',ARRAY['qt ','gas station','shell','exxon','bp ','chevron','sunoco','marathon','valero','murphy','circle k','racetrac','raceway','costco gas'],20),
('Transport','Rideshare & Taxi',NULL,false,'#00796B',ARRAY['uber','lyft','taxi'],21),
('Transport','Parking & Toll',NULL,true,'#00897B',ARRAY['parking','toll','marta'],22),
('Transport','Public Transit',NULL,true,'#009688',ARRAY['transit','metro','train','bus ','amtrak'],23),
('Air Travel','Air Travel',NULL,false,'#1565C0',ARRAY['delta air lines','cl *chase travel','airline','flight','southwest','american airlines','united airlines','jetblue'],30),
('Hotel','Hotel',NULL,false,'#0277BD',ARRAY['hotel','motel','inn ','resort','lodge','suites','airbnb','vrbo','marriott','hilton','hyatt','hampton inn','holiday inn','best western','sheraton','westin','ritz','expedia','booking.com','laquinta'],31),
('Car Rental','Car Rental',NULL,false,'#0288D1',ARRAY['car rental','hertz','enterprise','avis ','budget rent','national car'],32),
('Shopping','General Retail',NULL,false,'#558B2F',ARRAY['amazon','target','ebay','etsy','best buy','apple store','nike','zara','h&m','gap','nordstrom','macy','tj maxx','marshalls','ross ','homegoods','bed bath'],40),
('Shopping','Warehouse Club - General',NULL,false,'#689F38',ARRAY['costco.com','wm supercenter','walmart'],41),
('Shopping','Pet Supplies',NULL,false,'#7CB342',ARRAY['chewy','petco','petsmart'],42),
('Home Improvement','Home Improvement',NULL,true,'#E65100',ARRAY['the home depot','home depot','floor and decor','lowe','builders surplus','legacy house of windows','ace hardware','menards'],50),
('Health','Pharmacy (Rx)',NULL,true,'#AD1457',ARRAY['pharmacy','cvs','walgreens','rite aid','publix pharmacy','kroger pharmacy','costco pharmacy'],60),
('Health','Medical & Dental',NULL,true,'#C2185B',ARRAY['doctor','dentist','hospital','medical','urgent care','optometrist','vision','questdiagno','thomas eye group','clinic'],61),
('Health','Fitness & Wellness',NULL,false,'#D81B60',ARRAY['gym','fitness','yoga','health club'],62),
('Utilities','Electric',NULL,true,'#1565C0',ARRAY['duke energy','georgia power','dominion energy','electric','power company'],70),
('Utilities','Water & Sewer',NULL,true,'#1976D2',ARRAY['water ','fc water','water&sewer','sewer','water bill'],71),
('Utilities','Gas & Heating',NULL,true,'#1E88E5',ARRAY['gas bill','natural gas','atmos energy','heating'],72),
('Utilities','Internet & Cable',NULL,true,'#2196F3',ARRAY['internet','cable','xfinity','comcast','spectrum','at&t','verizon','t-mobile','phone'],73),
('Utilities','Waste & Sanitation',NULL,true,'#42A5F5',ARRAY['legacy disposal','red oak sanitation','waste management','trash','sanitation','garbage'],74),
('Utilities','Home Security',NULL,true,'#64B5F6',ARRAY['ring standard plan','adt','simplisafe','alarm'],75),
('Utilities','Car Wash',NULL,false,'#90CAF9',ARRAY['car wash'],76),
('Utilities','Other Utility',NULL,true,'#BBDEFB',ARRAY['py *urbanex atlanta','utility'],77),
('Insurance','Insurance',NULL,true,'#4527A0',ARRAY['insurance','geico','allstate','progressive','state farm','farmers ','liberty mutual','nationwide'],80),
('Education','Education',NULL,true,'#6A1B9A',ARRAY['tuition','university','college','coursera','udemy','book','gsu newton','awl*pearson education','pluralsight'],90),
('Entertainment','Streaming',NULL,false,'#6A1B9A',ARRAY['netflix','spotify','hulu','disney','amazon prime','apple tv','sling.com','peacock','paramount'],100),
('Entertainment','Events & Activities',NULL,false,'#7B1FA2',ARRAY['cinema','movie','theater','concert','ticketmaster','world of coca cola'],101),
('Entertainment','Gaming',NULL,false,'#8E24AA',ARRAY['steam','gaming','playstation','xbox','nintendo'],102),
('Personal Care','Personal Care',NULL,false,'#37474F',ARRAY['salon','spa','great clips','haircut','barber','beauty','nail'],110),
('Pet Care','Veterinary',NULL,false,'#4E342E',ARRAY['urgent vet','big creek animal','vine animal hospital','animaldoctor','animal hospital','veterinary','vet '],120),
('Pet Care','Pet Services',NULL,false,'#5D4037',ARRAY['rover.com','camp bow wow','pethotel','dog boarding','dog grooming'],121),
('Membership','Membership',NULL,false,'#546E7A',ARRAY['costco *annual renewal','annual membership fee','renewal membership fee','membership'],130),
('Fees & Interest','Late Fee',NULL,false,'#B71C1C',ARRAY['late fee'],140),
('Fees & Interest','Interest',NULL,false,'#C62828',ARRAY['interest charge on purchases','interest charge'],141),
('Other','Other',NULL,false,'#9E9E9E',ARRAY[]::TEXT[],999);

-- 7. Recreate views
DROP VIEW IF EXISTS v_monthly_category_spend;
DROP VIEW IF EXISTS v_annual_category_spend;
DROP VIEW IF EXISTS v_large_expenses;
DROP VIEW IF EXISTS v_utility_seasonal;

CREATE VIEW v_monthly_category_spend AS
SELECT t.user_id, t.year_num, t.month_num,
    TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
    t.category_name,
    COALESCE(t.subcategory, t.category_name) AS subcategory,
    COALESCE(c.is_essential, false)          AS is_essential,
    COALESCE(c.color_code, '#9E9E9E')        AS color_code,
    SUM(t.amount) AS total_amount, COUNT(*) AS txn_count
FROM transactions t
LEFT JOIN categories c ON c.user_id = t.user_id AND c.name = t.category_name
GROUP BY t.user_id, t.year_num, t.month_num, t.txn_date,
         t.category_name, t.subcategory, c.is_essential, c.color_code;

CREATE VIEW v_annual_category_spend AS
SELECT t.user_id, t.year_num, t.category_name,
    COALESCE(t.subcategory, t.category_name) AS subcategory,
    COALESCE(c.is_essential, false)          AS is_essential,
    COALESCE(c.color_code, '#9E9E9E')        AS color_code,
    SUM(t.amount) AS total_amount, COUNT(*) AS txn_count,
    SUM(t.amount) / SUM(SUM(t.amount)) OVER (PARTITION BY t.user_id, t.year_num) AS pct_of_total
FROM transactions t
LEFT JOIN categories c ON c.user_id = t.user_id AND c.name = t.category_name
GROUP BY t.user_id, t.year_num, t.category_name, t.subcategory, c.is_essential, c.color_code;

CREATE VIEW v_large_expenses AS
SELECT t.user_id, t.txn_date, t.amount, t.description,
    t.category_name, COALESCE(t.subcategory, t.category_name) AS subcategory,
    t.is_essential, a.provider, a.account_label
FROM transactions t
JOIN accounts a ON a.id = t.account_id
WHERE t.is_large = true ORDER BY t.amount DESC;

CREATE VIEW v_utility_seasonal AS
WITH um AS (
    SELECT t.user_id, t.year_num, t.month_num,
        TO_CHAR(DATE_TRUNC('month', t.txn_date), 'Mon YYYY') AS month_label,
        COALESCE(t.subcategory, 'Other Utility') AS utility_type,
        SUM(t.amount) AS total_amount, COUNT(*) AS txn_count
    FROM transactions t WHERE t.category_name = 'Utilities'
    GROUP BY t.user_id, t.year_num, t.month_num, t.txn_date, t.subcategory
),
ua AS (
    SELECT year_num, user_id, utility_type, AVG(total_amount) AS yearly_avg
    FROM um GROUP BY year_num, user_id, utility_type
)
SELECT um.user_id, um.year_num, um.month_num, um.month_label,
    um.utility_type, um.total_amount, um.txn_count, ua.yearly_avg,
    CASE WHEN um.total_amount > ua.yearly_avg THEN true ELSE false END AS above_average,
    ROUND((um.total_amount - ua.yearly_avg) * 100.0 / NULLIF(ua.yearly_avg, 0), 1) AS pct_vs_avg
FROM um JOIN ua ON ua.year_num = um.year_num AND ua.user_id = um.user_id
    AND ua.utility_type = um.utility_type
ORDER BY um.utility_type, um.year_num, um.month_num;

COMMIT;

SELECT 'Migration 001 complete' AS status;
SELECT name, subcategory, is_essential, sort_order
FROM default_categories ORDER BY sort_order;
