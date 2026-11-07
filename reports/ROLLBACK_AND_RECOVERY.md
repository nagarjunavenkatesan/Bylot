# BYLOT — ROLLBACK & DISASTER RECOVERY RUNBOOK

**Target Application:** Bylot Hyperlocal Marketplace  
**Domain:** `https://bylot.in`  
**Architecture:** Docker Compose (Nginx + Node.js API + MySQL 8.0)  
**Document Status:** Complete & Verified  

---

## 1. RECOVERY OBJECTIVES (RPO & RTO)

| Metric | Target | Description |
|---|---|---|
| **RPO (Recovery Point Objective)** | < 1 Hour | Maximum acceptable data loss duration. Backups taken hourly via automated cron. |
| **RTO (Recovery Time Objective)** | < 15 Minutes | Target duration to restore full service availability following critical outage. |
| **MTTR (Mean Time To Recovery)** | < 10 Minutes | Rollback time using pre-built container tags or previous Git commit. |

---

## 2. EMERGENCY MAINTENANCE MODE

When performing major schema migrations, recovering from critical data corruption, or investigating security incidents, switch Bylot to maintenance mode:

### 2.1 Enable Maintenance Mode
Nginx serves an instant `503 Service Temporarily Unavailable` page with retry headers:

```bash
# Touch maintenance flag file on VPS
touch /var/www/bylot/maintenance.enable

# Reload Nginx
sudo nginx -s reload
```

### 2.2 Verify Maintenance Mode
```bash
curl -I https://bylot.in/
# HTTP/2 503
# Retry-After: 300
```

### 2.3 Disable Maintenance Mode
```bash
rm -f /var/www/bylot/maintenance.enable
sudo nginx -s reload
```

---

## 3. APPLICATION DEPLOYMENT ROLLBACK

### Scenario A: New Release Fails Healthcheck or Produces 5xx Errors

If `scripts/deploy.sh` or post-deployment monitoring detects abnormal error spikes:

```bash
cd /opt/bylot

# 1. Inspect previous commit
git log -n 5 --oneline

# 2. Revert working tree to previous known good commit (e.g., HEAD~1)
git checkout HEAD~1

# 3. Rebuild and restart containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Execute healthcheck verification
./scripts/healthcheck.sh
```

### Scenario B: Fast Rollback via Tagged Docker Images
If using pre-tagged container images in a registry:
```bash
export BYLOT_IMAGE_TAG="v1.0.4-previous"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 4. DATABASE RESTORATION & ROLLBACK

All automated backups are encrypted or compressed in `/var/backups/bylot/` with SHA-256 checksums.

### 4.1 Locating Valid Backups
```bash
ls -lh /var/backups/bylot/
# Example output:
# bylot_db_20261107_060000.sql.gz
# bylot_db_20261107_060000.sql.gz.sha256
```

### 4.2 Verify Backup Integrity
```bash
cd /var/backups/bylot
sha256sum -c bylot_db_20261107_060000.sql.gz.sha256
# Output: bylot_db_20261107_060000.sql.gz: OK
```

### 4.3 Execute Database Restoration
Use the automated restore utility:
```bash
cd /opt/bylot
./scripts/restore.sh /var/backups/bylot/bylot_db_20261107_060000.sql.gz
```

*The restoration script automatically:*
1. Prompts for explicit operator confirmation.
2. Creates an emergency pre-restore safety dump of current state (`pre_restore_safety_dump.sql.gz`).
3. Streams the decompressed SQL dump directly into MySQL container `bylot-db`.
4. Executes table integrity checks across users, products, orders, and audits.
5. Verifies backend API connectivity post-restore.

---

## 5. SERVICE FAILURE & CONTAINER CRASH MITIGATION

### 5.1 Container Restart Loop (CrashLoop)
If `docker ps` indicates `bylot-backend` or `bylot-frontend` restarting continuously:

```bash
# Check crash stack trace
docker logs --tail 100 -f bylot-backend

# Check container exit code
docker inspect bylot-backend --format='{{.State.ExitCode}} {{.State.Error}}'

# Typical causes & solutions:
# - DB not ready: backend retries up to 10 times with exponential backoff.
# - Out of Memory (OOM): Check host RAM via `free -m`. Ensure swap is enabled.
# - Port conflict: Ensure host Nginx is bound to 80/443 and internal containers use internal network.
```

### 5.2 Out-of-Memory (OOM) Protection
Ensure Ubuntu VPS has at least 2GB swap configured:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 6. CREDENTIAL COMPROMISE RUNBOOK

If secrets, API tokens, or server keys are suspected of being leaked:

1. **Rotate Application Secrets in `.env.production`:**
   ```bash
   # Generate fresh secure tokens
   NEW_JWT_SECRET=$(openssl rand -hex 64)
   NEW_REFRESH_SECRET=$(openssl rand -hex 64)
   NEW_SESSION_SECRET=$(openssl rand -hex 64)
   
   # Update .env.production with new secrets
   ```
2. **Invalidate Active Sessions:**
   Restarting the backend immediately invalidates all in-flight JWT tokens signed with previous secret.
3. **Rotate MySQL Credentials:**
   Update `MYSQL_PASSWORD` in `.env.production` and execute `ALTER USER 'bylot_user'@'%' IDENTIFIED BY 'new_pass';` inside MySQL.
4. **Rotate Google OAuth Client Secret:**
   Visit Google Cloud Console -> APIs & Services -> Credentials -> Create new secret -> Update `.env.production`.
5. **Restart Application:**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

---

## 7. DISASTER RECOVERY DRILL SCHEDULE

| Cadence | Procedure | Responsibility |
|---|---|---|
| **Weekly** | Automated backup generation and SHA-256 checksum verification | Cron / DevOps |
| **Monthly** | Test restore of latest backup into a separate staging database | Lead Engineer |
| **Quarterly** | Full simulated container failure and rollback drill | DevOps & QA |
| **Semi-Annual**| Credential rotation exercise and security perimeter review | Security Officer |
