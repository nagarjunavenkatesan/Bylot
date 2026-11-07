#!/usr/bin/env bash
# ==============================================================================
# BYLOT PRODUCTION DEPLOYMENT AUTOMATION SCRIPT
# Target: Ubuntu 24.04 LTS VPS with Docker Compose & Nginx
# ==============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bylot}"
BRANCH="${BRANCH:-main}"

echo "================================================================="
echo "🚀 INITIATING BYLOT PRODUCTION DEPLOYMENT ($(date))"
echo "================================================================="

cd "${APP_DIR}"

# 1. Ensure production environment file exists
if [ ! -f .env ]; then
  echo "FATAL: Production .env file missing in ${APP_DIR}!"
  echo "Please copy .env.example to .env and configure all required secrets."
  exit 1
fi

# 2. Pull latest code from main branch
echo "--> Fetching latest release from GitHub (branch: ${BRANCH})..."
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"

# 3. Build & start Docker services
echo "--> Building production containers..."
docker compose build --no-cache

echo "--> Launching services with Docker Compose..."
docker compose up -d

# 4. Wait for database healthcheck
echo "--> Waiting for MySQL database to become healthy..."
TIMEOUT=60
COUNTER=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' bylot-mysql 2>/dev/null || echo 'starting')" = "healthy" ]; do
  sleep 2
  COUNTER=$((COUNTER + 2))
  if [ "${COUNTER}" -ge "${TIMEOUT}" ]; then
    echo "ERROR: MySQL container failed to report healthy within ${TIMEOUT}s"
    docker compose logs mysql
    exit 1
  fi
done
echo "    MySQL is healthy!"

# 5. Run database schema migrations
echo "--> Executing pending database migrations..."
docker compose exec -T backend node scripts/migrate.js

# 6. Verify backend health
echo "--> Running backend API smoke test..."
docker compose exec -T backend wget --quiet --tries=3 --spider http://localhost:5000/health || {
  echo "ERROR: Backend health endpoint failed!"
  docker compose logs backend
  exit 1
}

# 7. Reload host Nginx configuration if present
if command -v nginx >/dev/null 2>&1; then
  echo "--> Testing host Nginx configuration..."
  sudo nginx -t
  echo "--> Reloading host Nginx..."
  sudo systemctl reload nginx
fi

echo "================================================================="
echo "✅ BYLOT PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "Live Domain: https://bylot.in"
echo "================================================================="
