#!/usr/bin/env bash
# ============================================================
# fintrack — API verification script
# Run on API VM after: docker compose up -d
#
# Usage:
#   chmod +x verify_api.sh
#   ./verify_api.sh
# ============================================================

set -euo pipefail
source .env

API_HOST="192.168.1.170"
API_PORT="8000"
CONTAINER="fintrack_api"
DB_HOST="192.168.1.169"
DB_PORT="5432"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GREEN}  PASS${NC}  $1"; }
fail() { echo -e "${RED}  FAIL${NC}  $1"; exit 1; }
info() { echo -e "${YELLOW}  INFO${NC}  $1"; }

echo ""
echo "=============================================="
echo "  fintrack API Verification"
echo "=============================================="
echo ""

# 1. Image built?
info "Checking Docker image..."
if docker images --format '{{.Repository}}' | grep -q "fintrack"; then
    IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep fintrack | head -1)
    pass "Image found: ${IMAGE}"
else
    fail "No fintrack image found. Run: docker compose build"
fi

# 2. Container running?
info "Checking container status..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    pass "Container '${CONTAINER}' is running"
else
    fail "Container '${CONTAINER}' not running. Run: docker compose up -d"
fi

# 3. Container healthy?
info "Checking container health..."
sleep 5  # give health check time
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' ${CONTAINER} 2>/dev/null || echo "unknown")
if [ "$HEALTH" = "healthy" ]; then
    pass "Container health: ${HEALTH}"
else
    echo -e "${YELLOW}  WARN${NC}  Container health: ${HEALTH} (may still be starting)"
fi

# 4. Port reachable?
info "Checking port ${API_PORT}..."
if nc -z -w3 ${API_HOST} ${API_PORT} 2>/dev/null; then
    pass "Port ${API_PORT} reachable on ${API_HOST}"
else
    fail "Port ${API_PORT} not reachable — check firewall: firewall-cmd --list-all"
fi

# 5. Health endpoint responds?
info "Calling /health endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 \
    http://${API_HOST}:${API_PORT}/health)
if [ "$RESPONSE" = "200" ]; then
    pass "GET /health → HTTP ${RESPONSE}"
else
    fail "GET /health → HTTP ${RESPONSE} (expected 200)"
fi

# 6. Parse health response
info "Checking health response body..."
BODY=$(curl -s --max-time 10 http://${API_HOST}:${API_PORT}/health)
echo "       Response: ${BODY}"

DB_STATUS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('database','unknown'))" 2>/dev/null || echo "parse_error")
if [ "$DB_STATUS" = "connected" ]; then
    pass "Database status in health response: ${DB_STATUS}"
else
    fail "Database status: ${DB_STATUS} — API cannot reach DB VM at ${DB_HOST}:${DB_PORT}"
fi

# 7. Root endpoint
info "Calling / endpoint..."
ROOT=$(curl -s --max-time 10 http://${API_HOST}:${API_PORT}/ | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('app','?'))" 2>/dev/null)
if [ "$ROOT" = "fintrack" ]; then
    pass "GET / → app: fintrack"
else
    fail "GET / → unexpected response"
fi

# 8. Docs available (dev mode only)?
info "Checking API docs..."
DOCS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    http://${API_HOST}:${API_PORT}/docs)
if [ "$DOCS" = "200" ]; then
    pass "API docs available at http://${API_HOST}:${API_PORT}/docs"
else
    echo -e "${YELLOW}  WARN${NC}  Docs not available (expected in development mode)"
fi

# 9. Connectivity from API to DB VM
info "Checking API-to-DB connectivity..."
if docker exec ${CONTAINER} python3 -c \
    "import psycopg2; c=psycopg2.connect(host='${DB_HOST}',port=${DB_PORT},dbname='${DB_NAME}',user='${DB_USER}',password='${DB_PASSWORD}'); print('ok'); c.close()" \
    2>/dev/null | grep -q "ok"; then
    pass "API container can connect to PostgreSQL at ${DB_HOST}:${DB_PORT}"
else
    fail "API container cannot reach PostgreSQL — verify firewall on DB VM allows 192.168.1.170"
fi

# 10. Check Python packages installed
info "Checking key Python packages..."
for pkg in fastapi uvicorn sqlalchemy psycopg2 nacl passlib jose pandas; do
    if docker exec ${CONTAINER} python3 -c "import ${pkg}" 2>/dev/null; then
        pass "Package: ${pkg}"
    else
        fail "Package NOT found: ${pkg}"
    fi
done

echo ""
echo "=============================================="
echo -e "  ${GREEN}All checks passed. API is ready.${NC}"
echo "=============================================="
echo ""
echo "  Endpoints:"
echo "    Health : http://${API_HOST}:${API_PORT}/health"
echo "    Docs   : http://${API_HOST}:${API_PORT}/docs"
echo "    Root   : http://${API_HOST}:${API_PORT}/"
echo ""
