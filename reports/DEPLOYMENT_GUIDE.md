# BYLOT — PRODUCTION DEPLOYMENT & HOSTING GUIDE

**Target System:** Ubuntu 24.04 LTS VPS (Hostinger, DigitalOcean, Hetzner, AWS, etc.)  
**Domain:** `https://bylot.in` (and `https://www.bylot.in`)  
**DNS Provider:** BigRock  

---

## 1. BIGROCK DNS CONFIGURATION

Log in to your BigRock Control Panel -> DNS Management:

| Type | Host Name | Value / Destination | TTL |
|---|---|---|---|
| **A** | `@` | `<YOUR_VPS_IPV4_ADDRESS>` | 300 |
| **A** | `www` | `<YOUR_VPS_IPV4_ADDRESS>` | 300 |

*Wait 5–15 minutes for DNS propagation.*  
Verify from terminal:
```bash
dig +short bylot.in
dig +short www.bylot.in
```

---

## 2. VPS SERVER INITIAL SETUP

SSH into your fresh Ubuntu 24.04 VPS as root or sudo user:
```bash
# Update base system
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install host Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 3. APPLICATION DEPLOYMENT

```bash
# Clone the repository
sudo mkdir -p /var/www/bylot
sudo chown -R $USER:$USER /var/www/bylot
git clone https://github.com/nagarjunavenkatesan/Bylot.git /var/www/bylot
cd /var/www/bylot

# Configure production environment variables
cp .env.example .env
nano .env
# Fill in strong random secrets for DB_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, and ADMIN_PASSWORD

# Set secure permissions on environment file
chmod 600 .env
```

---

## 4. SSL CERTIFICATE ISSUANCE (LET'S ENCRYPT)

```bash
# Obtain SSL certificates for bylot.in and www.bylot.in
sudo certbot certonly --nginx -d bylot.in -d www.bylot.in --email nagarjunavenkatesan@gmail.com --agree-tos --no-eff-email

# Deploy host Nginx configuration
sudo cp /var/www/bylot/deploy/nginx/bylot.in.conf /etc/nginx/sites-available/bylot.in.conf
sudo ln -sf /etc/nginx/sites-available/bylot.in.conf /etc/nginx/sites-enabled/bylot.in.conf
sudo rm -f /etc/nginx/sites-enabled/default

# Test & reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. LAUNCH DOCKER CONTAINERS & MIGRATE DATABASE

```bash
cd /var/www/bylot

# Launch services with Docker Compose
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Execute database migrations
docker compose exec -T backend node scripts/migrate.js

# Ensure production admin account exists
docker compose exec -T backend node scripts/createAdmin.js

# Verify deployment health
./scripts/healthcheck.sh https://bylot.in 5000
```

---

## 6. AUTOMATED BACKUPS & SYSTEM MAINTENANCE

Add automated database backups to crontab:
```bash
sudo crontab -e
```
Add the following line to run daily backups at 2:00 AM UTC:
```cron
0 2 * * * /var/www/bylot/scripts/backup.sh >> /var/log/bylot_backup.log 2>&1
```
