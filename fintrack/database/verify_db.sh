#!/usr/bin/env bash
# ============================================================
# fintrack — Database verification script
# Run on DB VM after: docker compose up -d
#
# Usage:
#   chmod +x verify_db.sh
#   ./verify_db.sh
# ============================================================

set -euo pipefail

# Load env vars
source .env

DB_HOST="192.168.1.169"
DB_PORT="5432"
DB_USER="${POSTGRES_USER}"
DB_NAME="${POSTGRES_DB}"
CONTAINER="fintrack_db"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}  PASS${NC}  $1"; }
fail() { echo -e "${RED}  FAIL${NC}  $1"; exit 1; }
info() { echo -e "${YELLOW}  INFO${NC}  $1"; }

echo ""
echo "=============================================="
echo "  fintrack Database Verification"
echo "=============================================="
echo ""

# 1. Container running?
info "Checking container status..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    pass "Container '${CONTAINER}' is running"
else
    fail "Container '${CONTAINER}' is NOT running. Run: docker compose up -d"
fi

# 2. Health check passing?
info "Checking container health..."
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' ${CONTAINER} 2>/dev/null || echo "unknown")
if [ "$HEALTH" = "healthy" ]; then
    pass "Container health: ${HEALTH}"
else
    fail "Container health: ${HEALTH} (expected: healthy)"
fi

# 3. Port listening?
info "Checking port 5432..."
if nc -z -w3 ${DB_HOST} ${DB_PORT} 2>/dev/null; then
    pass "Port ${DB_PORT} is reachable on ${DB_HOST}"
else
    fail "Port ${DB_PORT} not reachable on ${DB_HOST}"
fi

# 4. Can connect?
info "Testing database connection..."
if docker exec ${CONTAINER} pg_isready -U ${DB_USER} -d ${DB_NAME} -q; then
    pass "Database accepts connections"
else
    fail "Database not accepting connections"
fi

# 5. Extensions installed?
info "Checking extensions..."
EXTENSIONS=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c \
    "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp','pgcrypto','citext') ORDER BY extname;")

for ext in citext pgcrypto uuid-ossp; do
    if echo "$EXTENSIONS" | grep -q "$ext"; then
        pass "Extension: ${ext}"
    else
        fail "Extension NOT found: ${ext}"
    fi
done

# 6. Tables exist?
info "Checking tables..."
TABLES=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c \
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")

for table in accounts audit_log categories default_categories expense_thresholds transactions user_keys users; do
    if echo "$TABLES" | grep -q "$table"; then
        pass "Table: ${table}"
    else
        fail "Table NOT found: ${table}"
    fi
done

# 7. Views exist?
info "Checking views..."
VIEWS=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c \
    "SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY viewname;")

for view in v_annual_category_spend v_large_expenses v_monthly_category_spend; do
    if echo "$VIEWS" | grep -q "$view"; then
        pass "View: ${view}"
    else
        fail "View NOT found: ${view}"
    fi
done

# 8. Default categories seeded?
info "Checking default categories..."
CAT_COUNT=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c \
    "SELECT COUNT(*) FROM default_categories;" | tr -d ' ')

if [ "$CAT_COUNT" -ge "12" ]; then
    pass "Default categories: ${CAT_COUNT} rows"
else
    fail "Default categories: only ${CAT_COUNT} rows (expected >= 12)"
fi

# 9. Data directory on correct mount?
info "Checking data directory..."
PGDATA_MOUNT=$(docker inspect ${CONTAINER} --format='{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}')
if echo "$PGDATA_MOUNT" | grep -q "srv/postgres"; then
    pass "Data directory mounted at: ${PGDATA_MOUNT}"
else
    fail "Data directory mount unexpected: ${PGDATA_MOUNT}"
fi

# 10. Quick performance sanity check
info "Running quick query test..."
QUERY_TIME=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c \
    "\timing on
     SELECT COUNT(*) FROM default_categories;" 2>&1 | grep "Time:" | awk '{print $2}')
pass "Query response time: ${QUERY_TIME} ms"

echo ""
echo "=============================================="
echo -e "  ${GREEN}All checks passed. Database is ready.${NC}"
echo "=============================================="
echo ""
echo "  Connection string (from API VM):"
echo "  postgresql://${DB_USER}:<password>@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
