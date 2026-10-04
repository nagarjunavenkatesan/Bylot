# Bylot Production Deployment Guide

> **Read this entire document before touching a live server.**

---

## 0. Security first — rotate everything before deploying

If any secret (database password, JWT secret, SMTP password, Google client secret, MCP key) has **ever appeared in logs, chat history, or version control**, treat it as **compromised** and rotate it before the first deploy.

Generate a new secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do this for every `_SECRET`, `_PASSWORD`, and `_KEY` variable.

---

## 1. Environment variables

Copy `backend/.env.example` → `backend/.env` and fill in every `REPLACE_ME_*` value.
Copy `.env.example` (project root) → `.env` for Docker Compose.
Copy `bylot/.env.example` → `bylot/.env` for the frontend.

**Never commit any `.env` file.**

| Variable | Purpose | Notes |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_NAME` | MySQL connection | DB must not be publicly accessible |
| `DB_PASSWORD` | Database password | Min 20 chars, rotate if ever exposed |
| `JWT_ACCESS_SECRET` | Signs 15-min access tokens | Min 32 chars, high entropy |
| `JWT_REFRESH_SECRET` | Signs 30-day refresh tokens | Must differ from access secret |
| `ALLOWED_ORIGINS` / `FRONTEND_URL` / `APP_URL` | CORS, links, CSRF Origin checks | Match your exact production domain |
| `COOKIE_SAMESITE` | Refresh-cookie `SameSite` attribute | `strict` (same domain) or `none` (cross-subdomain, requires HTTPS) |
| `COOKIE_DOMAIN` | Refresh-cookie `Domain` attribute | Set to `.your-domain.com` for cross-subdomain |
| `TRUST_PROXY_HOPS` | Number of reverse proxies in front of Node | See section below |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email (required in production) | App refuses to start without these |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | Optional; app degrades gracefully |
| `MCP_AUTH_KEY` | MCP admin endpoint auth | Treat like a secret token |

### TRUST_PROXY_HOPS

Count **every** layer that sets `X-Forwarded-For` between the internet and Node:

| Topology | Value |
|---|---|
| Node directly on internet | `0` |
| One nginx in front | `1` |
| Cloudflare + nginx | `2` |
| Cloudflare + load balancer + nginx | `3` |

Wrong value = rate limits and IP-based lockouts can be bypassed. A startup log line prints the configured hop count for confirmation.

### COOKIE_SAMESITE / COOKIE_DOMAIN cross-subdomain setup

When the API (`api.bylot.in`) and frontend (`www.bylot.in`) are on different subdomains:

```
COOKIE_SAMESITE=none
COOKIE_DOMAIN=.bylot.in
```

`SameSite=none` **requires HTTPS**. Always pair with `Secure` (the app sets this automatically in production). The CSRF check (`X-Requested-With: bylot` header + Origin validation) provides the CSRF protection that `SameSite=strict` would otherwise give.

---

## 2. nginx setup

Terminate TLS at nginx. Only ports **80** (redirect) and **443** should be open to the internet.

```nginx
server {
    listen 80;
    server_name bylot.in www.bylot.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bylot.in www.bylot.in;

    ssl_certificate     /etc/letsencrypt/live/bylot.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bylot.in/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Serve uploaded files directly (faster than proxying to Node)
    location /uploads/ {
        alias /var/lib/bylot/uploads/;
        add_header Cache-Control "public, max-age=604800, immutable";
        add_header X-Content-Type-Options nosniff;
        # Do NOT serve directory listings
        autoindex off;
    }

    # Proxy API to backend container
    location /api/ {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Proxy health check
    location /health {
        proxy_pass http://127.0.0.1:5000;
    }

    # Serve React SPA from frontend container
    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

---

## 3. Firewall

Allow inbound on **80** and **443** only. Block 3306 (MySQL), 5000 (Node), 8080 (frontend container) from the public internet. SSH (22) from admin IP only.

```bash
# ufw example
ufw default deny incoming
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from YOUR_ADMIN_IP to any port 22
ufw enable
```

---

## 4. Database backups

Daily `mysqldump` with 14-day retention:

```bash
#!/bin/bash
# /etc/cron.daily/bylot-backup
BACKUP_DIR=/var/backups/bylot
mkdir -p "$BACKUP_DIR"
mysqldump \
  -h 127.0.0.1 \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  bylot | gzip > "$BACKUP_DIR/bylot-$(date +%F).sql.gz"
# Delete backups older than 14 days
find "$BACKUP_DIR" -name "bylot-*.sql.gz" -mtime +14 -delete
```

Test restores monthly on a non-production server.

---

## 5. Migrations

See `docs/MIGRATIONS.md` for the full procedure. Summary:

```bash
# 1. Take a backup first (see above)
# 2. Dry-run to see what will execute
npm run migrate -- --dry-run

# 3. Apply on staging copy, verify the app works, then apply on production
npm run migrate
```

Never apply migrations directly to production without testing on a staging copy first.

---

## 6. Log rotation

Add `/etc/logrotate.d/bylot`:

```
/var/log/bylot/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        kill -USR1 $(cat /var/run/bylot/backend.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
```

---

## 7. Uptime monitoring

Point an external monitor (e.g. UptimeRobot, BetterStack) to `GET https://bylot.in/health`.

The endpoint returns:
- `200 { database: "connected" }` — healthy
- `503 { database: "disconnected" }` — DB is down, alert immediately

---

## 8. First-deploy checklist

- [ ] All `.env` files created with real secrets (no `REPLACE_ME_*` values remain)
- [ ] Old/compromised passwords rotated in MySQL and in `.env`
- [ ] SMTP tested: registration email arrives in inbox
- [ ] `TRUST_PROXY_HOPS` set to match actual proxy topology
- [ ] CSP and CORS `ALLOWED_ORIGINS` match production domains exactly
- [ ] TLS certificate installed and auto-renew configured (`certbot renew`)
- [ ] Firewall rules applied; MySQL not reachable on public interface
- [ ] `npm run migrate` run on a staging DB copy first, then on production
- [ ] `npm run create-admin` used to create the first admin account
- [ ] Docker Compose health check turns green: `docker compose ps`
- [ ] Playwright flows tested manually on a real phone (register → login → sell → order)
- [ ] Backup cron job verified (test restore from backup)

---

## 9. Docker Compose

```bash
# Start all services
docker compose --env-file .env up -d

# Check health
docker compose ps

# View backend logs
docker compose logs -f backend

# Run migrations inside the container
docker compose exec backend npm run migrate
```

The backend service has a healthcheck (`GET /health`) with a 15 s interval. The frontend depends on `backend: service_healthy` so it only starts after the API is ready.

---

## 10. Staging-first rule

**Never deploy directly to production.** The sequence is:

1. Deploy to staging with a copy of the production database
2. Run migrations on staging
3. Run Playwright test suite against staging
4. Click through key flows manually on a real phone
5. If everything passes, deploy to production using the same steps
