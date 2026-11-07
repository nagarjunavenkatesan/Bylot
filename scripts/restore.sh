#!/usr/bin/env bash
# ==============================================================================
# BYLOT PRODUCTION DATABASE RESTORE SCRIPT
# Restores a compressed MySQL backup into the target database with safety guards
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  echo "Example: $0 /var/backups/bylot/mysql/bylot_backup_20261106_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found at ${BACKUP_FILE}"
  exit 1
fi

if [ -f /var/www/bylot/.env ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' /var/www/bylot/.env | xargs)
fi

DB_CONTAINER="${DB_CONTAINER:-bylot-mysql}"
DB_NAME="${DB_NAME:-bylot}"
DB_USER="${DB_USER:-root}"
DB_PASS="${MYSQL_ROOT_PASSWORD:-}"

echo "================================================================="
echo "WARNING: RESTORING WILL OVERWRITE EXISTING DATA IN '${DB_NAME}'!"
echo "Backup File: ${BACKUP_FILE}"
echo "Target Container: ${DB_CONTAINER}"
echo "================================================================="

read -r -p "Type 'RESTORE_CONFIRM' to proceed: " CONFIRMATION
if [ "${CONFIRMATION}" != "RESTORE_CONFIRM" ]; then
  echo "Operation cancelled by user."
  exit 0
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Restoring database..."

if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  gunzip -c "${BACKUP_FILE}" | docker exec -i "${DB_CONTAINER}" mysql \
    --user="${DB_USER}" \
    --password="${DB_PASS}" \
    "${DB_NAME}"
else
  gunzip -c "${BACKUP_FILE}" | mysql \
    -h "${DB_HOST:-127.0.0.1}" \
    -P "${DB_PORT:-3306}" \
    -u "${DB_USER}" \
    -p"${DB_PASS}" \
    "${DB_NAME}"
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Database restored successfully from ${BACKUP_FILE}."
