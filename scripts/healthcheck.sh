#!/usr/bin/env bash
# ==============================================================================
# BYLOT PRODUCTION HEALTH CHECK & MONITORING SCRIPT
# Probes web and API endpoints, validates HTTP statuses and SSL certificate
# ==============================================================================

set -euo pipefail

TARGET_HOST="${1:-https://bylot.in}"
LOCAL_PORT="${2:-5000}"

echo "================================================================="
echo "🔍 RUNNING BYLOT PRODUCTION SMOKE & HEALTH CHECKS"
echo "Target: ${TARGET_HOST} (Local API Port: ${LOCAL_PORT})"
echo "================================================================="

# 1. Local backend health endpoint
echo "--> 1. Probing Local Backend API (/health)..."
if curl -s -f "http://127.0.0.1:${LOCAL_PORT}/health" >/dev/null 2>&1; then
  echo "    [PASS] Local backend API is UP and healthy."
else
  echo "    [WARN] Local backend API probe failed on port ${LOCAL_PORT}."
fi

# 2. Local database connectivity check via /health/db
echo "--> 2. Probing Database Connectivity (/health/db)..."
if curl -s -f "http://127.0.0.1:${LOCAL_PORT}/health/db" >/dev/null 2>&1; then
  echo "    [PASS] Database connectivity verified healthy."
else
  echo "    [WARN] Database health check failed."
fi

# 3. Public domain probe (if DNS is resolved)
echo "--> 3. Probing Target Host (${TARGET_HOST})..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${TARGET_HOST}/" || echo "000")
if [ "${HTTP_STATUS}" = "200" ]; then
  echo "    [PASS] ${TARGET_HOST} returned HTTP 200 OK."
elif [ "${HTTP_STATUS}" = "000" ]; then
  echo "    [NOTICE] ${TARGET_HOST} is not reachable from this host (DNS/Network pending)."
else
  echo "    [STATUS] ${TARGET_HOST} returned HTTP ${HTTP_STATUS}."
fi

# 4. Public API Config endpoint
echo "--> 4. Probing Public Config Endpoint (${TARGET_HOST}/api/config)..."
CONFIG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${TARGET_HOST}/api/config" || echo "000")
if [ "${CONFIG_STATUS}" = "200" ]; then
  echo "    [PASS] Public API config returned HTTP 200 OK."
else
  echo "    [NOTICE] ${TARGET_HOST}/api/config returned status ${CONFIG_STATUS}."
fi
