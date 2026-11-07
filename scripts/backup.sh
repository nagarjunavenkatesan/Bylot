#!/usr/bin/env bash
# ==============================================================================
# BYLOT PRODUCTION DATABASE BACKUP SCRIPT
# Performs automated, timestamped MySQL backup with compression & rotation
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/bylot/mysql}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Load environment configuration if available
if [ -f /var/www/bylot/.env ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' /var/www/bylot/.env | xargs)
fi

DB_CONTAINER="${DB_CONTAINER:-bylot-mysql}"
DB_NAME="${DB_NAME:-bylot}"
DB_USER="${DB_USER:-root}"
DB_PASS="${MYSQL_ROOT_PASSWORD:-}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting MySQL backup for '${DB_NAME}'..."

if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  # Execute mysqldump via Docker container
  docker exec "${DB_CONTAINER}" mysqldump \
    --user="${DB_USER}" \
    --password="${DB_PASS}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    "${DB_NAME}" | gzip -c > "${BACKUP_FILE}"
else
  # Native mysqldump fallback
  mysqldump \
    -h "${DB_HOST:-127.0.0.1}" \
    -P "${DB_PORT:-3306}" \
    -u "${DB_USER}" \
    -p"${DB_PASS}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    "${DB_NAME}" | gzip -c > "${BACKUP_FILE}"
fi

chmod 600 "${BACKUP_FILE}"
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Prune old backups older than RETENTION_DAYS
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup rotation finished."
