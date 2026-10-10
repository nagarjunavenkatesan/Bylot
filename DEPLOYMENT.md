# Bylot Production Deployment Guide

Production Domain: `https://bylot.in`  
Architecture: Host Nginx (SSL / Certbot termination) → Docker Compose (`frontend` on `127.0.0.1:8080`, `backend` on `127.0.0.1:5000`, private MySQL on internal bridge network).

---

## 1. Prerequisites

- Ubuntu 22.04 LTS / Debian 12 / Rocky Linux 9 server
- Root or `sudo` access
- Public IP pointed to by DNS records:
  - `A bylot.in -> <SERVER_IP>`
  - `A www.bylot.in -> <SERVER_IP>`
- Docker Engine & Docker Compose V2 installed (`docker compose version`)
- Host Nginx installed (`nginx -v`)
- Certbot installed (`certbot --version`)

---

## 2. Server Setup & Cloning

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker, Nginx, Certbot
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git curl

# Enable Docker service
sudo systemctl enable --now docker

# Create deploy directory and clone repository
sudo mkdir -p /var/www/bylot
sudo chown -R $USER:$USER /var/www/bylot
git clone https://github.com/nagarjunavenkatesan/Bylot.git /var/www/bylot
cd /var/www/bylot
```

---

## 3. Production Environment Configuration

Copy the template and set production secrets:

```bash
cp .env.example .env
chmod 600 .env
```

Generate high-entropy secrets for JWT and encryption:

```bash
# 32-byte encryption key for AES-256-GCM
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# High-entropy JWT secrets (must be at least 32 characters, and different from each other)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure `.env` with actual production values:

```ini
NODE_ENV=production
DB_NAME=bylot
DB_USER=bylot_prod_user
DB_PASSWORD=<STRONG_RANDOM_PASSWORD>
MYSQL_ROOT_PASSWORD=<STRONG_ROOT_PASSWORD>

ENCRYPTION_KEY=<32_BYTE_HEX_STRING>
JWT_ACCESS_SECRET=<64_CHAR_HEX_STRING>
JWT_REFRESH_SECRET=<64_CHAR_HEX_STRING>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

FRONTEND_URL=https://bylot.in
APP_URL=https://bylot.in
ALLOWED_ORIGINS=https://bylot.in,https://www.bylot.in

GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=<YOUR_SMTP_API_KEY>
EMAIL_FROM=Bylot <no-reply@bylot.in>
SKIP_SMTP_CHECK=false

# Trust Proxy Hops:
# 1 = Single reverse proxy (host Nginx terminating TLS)
# 2 = Cloudflare + host reverse proxy
TRUST_PROXY_HOPS=1
```

---

## 4. Host Nginx & SSL Certificate Setup

1. Copy host Nginx configuration:
```bash
sudo cp deploy/nginx/bylot.in.conf /etc/nginx/sites-available/bylot.in.conf
sudo ln -sf /etc/nginx/sites-available/bylot.in.conf /etc/nginx/sites-enabled/bylot.in.conf
sudo rm -f /etc/nginx/sites-enabled/default
```

2. Temporarily comment out SSL directives or obtain Let's Encrypt certificates first:
```bash
# Obtain Let's Encrypt certificate for bylot.in and www.bylot.in
sudo certbot certonly --webroot -w /var/www/certbot -d bylot.in -d www.bylot.in
```

3. Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Build and Launch Containers

```bash
# Pull base images and build containers
docker compose build --no-cache

# Start all services (MySQL, backend, frontend) in background
docker compose up -d

# Verify all containers are running and healthy
docker compose ps
```

Expected output:
- `bylot-mysql` (healthy)
- `bylot-backend` (healthy)
- `bylot-frontend` (healthy)

---

## 6. Safe Database Initialization & Migrations

MySQL automatically runs `backend/config/schema.sql` on first container volume initialization.  
To verify database tables or run migrations explicitly:

```bash
# Check MySQL tables inside container
docker compose exec mysql mysql -u bylot_prod_user -p bylot -e "SHOW TABLES;"

# Run migrations safely
docker compose exec backend npm run migrate
```

---

## 7. Production Verification & Smoke Test Checklist

Test each endpoint from outside the server:

```bash
# 1. Health Checks
curl -I https://bylot.in/health
curl -I https://bylot.in/api/health
curl -s https://bylot.in/api/health | jq .

# 2. Robots & Sitemaps
curl -I https://bylot.in/robots.txt
curl -I https://bylot.in/sitemap.xml
curl -I https://bylot.in/sitemap-pages.xml
curl -I https://bylot.in/sitemap-categories.xml

# 3. Web & SSR Meta
curl -s https://bylot.in/ | grep -i "<title>"
curl -s https://bylot.in/category/groceries | grep -i "og:title"

# 4. Soft-404 Validation (Must return HTTP 404, NOT 200)
curl -I https://bylot.in/product/99999999
curl -I https://bylot.in/category/nonexistent-xyz

# 5. Security Headers
curl -I https://bylot.in/ | grep -Ei "(strict-transport|x-content-type|x-frame|content-security)"
```
