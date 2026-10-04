# BYLOT — Hyperlocal Smart Marketplace

> **Mission:** Reduce losses from expiring goods and connect local stores with nearby buyers for discounted, near-expiry, and surplus essentials.

---

## 1. System Architecture

BYLOT is built as an enterprise-grade full-stack web application designed for high security, fast local search, and seamless authentication:

```
[ INTERNET ]
     │ (HTTPS :443)
     ▼
[ NGINX Reverse Proxy ]
     ├── /               ──> [ React + Vite Static SPA (dist) ]
     ├── /uploads/*      ──> [ Persistent Uploads Storage ]
     └── /api/*          ──> [ Node.js / Express API :5000 ]
                                  │
                                  ├──> [ MySQL 8.0 Database :3306 ]
                                  └──> [ Google OAuth Token Verification ]
```

### Key Components:
- **Frontend (`bylot/`):** React 18, Vite, Framer Motion, React Router DOM, React Icons, Leaflet Maps.
- **Backend (`backend/`):** Node.js 22, Express, MySQL2 Connection Pool, Helmet, CORS, JWT Auth, Google Auth Library, Multer.
- **Mobile Integration (`android-retrofit-example/`):** Native Android client communicating with BYLOT REST endpoints.
- **Database:** MySQL 8.0 with InnoDB, foreign key constraints, indexes on categories, expiry dates, and locations.

---

## 2. Technology Stack & Security Features

### Authentication & Authorization
- **Multi-Modal Login:** Standard email + password (hashed with `bcrypt` salt rounds = 12) AND Google OAuth 2.0 One-Tap / Sign-In button.
- **Server-Side Google Verification:** Google ID tokens verified cryptographically via Google Auth Library on the backend. Client-provided user profiles are never trusted blindly.
- **Non-Blocking Architecture:** `GoogleOAuthProvider` boots instantly using environment config. The frontend application will never render a blank screen even if API discovery is delayed or fails.
- **Role-Based Access Control (RBAC):** Strict role separation (`admin`, `seller`, `buyer`) verified server-side on every protected endpoint.
- **IDOR Protection:** Users can only view and mutate their own profile and listings unless authorized as an administrator.

### Security Hardening
- **HTTP Headers:** Helmet integration enforcing strict CSP, XSS filtering, frame protection, nosniff, and HSTS.
- **Secure File Uploads:** Multer with strict MIME and extension validation (`.jpg`, `.jpeg`, `.png`, `.webp`), randomized safe UUID filenames, and size limits (5MB default).
- **Persistent Storage:** Docker persistent volumes for database (`mysql_data`) and product uploads (`uploads_data`).
- **Network Isolation:** In production Docker Compose, MySQL port 3306 is not bound to public interfaces; only internal backend service access is permitted.
- **Production TLS Termination:** TLS/HTTPS managed cleanly by Nginx (Let's Encrypt / Certbot); Node.js runs as an internal HTTP upstream.

---

## 3. Directory Structure

```
Bylot/
├── backend/
│   ├── config/              # Environment, DB pool, and constants
│   ├── controllers/         # Business logic (auth, products, sellers, admin)
│   ├── database/            # schema.sql and migration definitions
│   ├── middleware/          # JWT auth, RBAC, error handler, file upload
│   ├── routes/              # Modular Express routers
│   ├── scripts/             # DB schema runner, admin generator, audit
│   ├── Dockerfile           # Hardened production Node container with healthcheck
│   ├── package.json
│   └── server.js            # Express app entrypoint
├── bylot/
│   ├── src/                 # React components, pages, contexts, and API client
│   ├── public/              # Static assets, robots.txt, sitemap.xml
│   ├── Dockerfile           # Multi-stage Vite build -> Nginx Alpine
│   ├── nginx.conf           # SPA fallback routing & reverse proxy
│   ├── package.json
│   └── vite.config.js       # Chunk splitting and dev proxy
├── deploy/
│   └── nginx/bylot.in.conf  # Production SSL host reverse proxy configuration
├── docker-compose.yml       # Production-ready stack: MySQL + Backend + Frontend
└── README.md
```

---

## 4. Local Development Setup

### Prerequisites
- Node.js >= 18.x (v20+ recommended)
- MySQL Server 8.0+ running locally
- Git

### 1. Database Setup & Migrations
Ensure MySQL is running, then create the database and initialize the schema:
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bylot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cd backend
npm install
npm run schema
```

Apply all database migrations in order:
```bash
for migration in ../migrations/*.sql; do
  mysql -u root -p bylot < "$migration"
done
```

Create an admin user securely (takes credentials from prompt/environment, never hardcoded):
```bash
npm run create-admin
```

Run test suite and security audit:
```bash
npm test
npm run security-audit
```

### 2. Backend Setup
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Adjust credentials in `backend/.env` (DB credentials, JWT secrets, etc.).
3. Start the development server:
   ```bash
   npm run dev
   # Backend will start on http://localhost:5000
   ```

### 3. Frontend Setup
1. Open a new terminal in `bylot/`:
   ```bash
   cd bylot
   cp .env.example .env
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   # Frontend runs at http://localhost:5173 with proxy to http://localhost:5000
   ```

---

## 5. Google OAuth 2.0 Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add the following **Authorized JavaScript origins**:
   - `http://localhost:5173` (for local frontend dev)
   - `https://bylot.in` (for production domain)
   - `https://www.bylot.in` (if using www subdomain)
4. Add **Authorized redirect URIs**:
   - `http://localhost:5173/login`
   - `https://bylot.in/login`
5. Place the Client ID in:
   - Frontend: `bylot/.env` as `VITE_GOOGLE_CLIENT_ID`
   - Backend: `backend/.env` as `GOOGLE_CLIENT_ID`

---

## 6. Docker Deployment

Deploy the entire full-stack application with a single command:

```bash
# 1. Review root environment variables
docker compose build --no-cache

# 2. Start services in background
docker compose up -d

# 3. Check status & logs
docker compose ps
docker compose logs -f backend
```

Services:
- **`bylot-frontend`**: Serves React static build and reverse proxies `/api/` & `/uploads/` on port 80.
- **`bylot-backend`**: Node.js API with automated healthcheck on `http://localhost:5000/health`.
- **`bylot-mysql`**: Persistent database container initialized with `schema.sql`.

---

## 7. Production Domain & SSL (https://bylot.in)

1. Point DNS A-records for `bylot.in` and `www.bylot.in` to your server's public IP address.
2. Obtain a free TLS/SSL certificate using Let's Encrypt Certbot:
   ```bash
   sudo certbot certonly --standalone -d bylot.in -d www.bylot.in
   ```
3. Copy the production Nginx configuration:
   ```bash
   sudo cp deploy/nginx/bylot.in.conf /etc/nginx/sites-available/bylot.in
   sudo ln -s /etc/nginx/sites-available/bylot.in /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Start Docker Compose:
   ```bash
   docker compose up -d
   ```
   The site is now live at **https://bylot.in** with automated HTTPS redirection, HSTS, and secure reverse proxying.

---

## 8. Backup & Maintenance

### Database Backup
```bash
docker exec bylot-mysql mysqldump -u bylot_user -p bylot > backup_$(date +%F).sql
```

### Database Restore
```bash
cat backup_YYYY-MM-DD.sql | docker exec -i bylot-mysql mysql -u bylot_user -p bylot
```

### Uploads Backup
```bash
docker run --rm -v bylot_uploads_data:/volume -v $(pwd):/backup alpine tar czf /backup/uploads_$(date +%F).tar.gz -C /volume .
```

---

## 9. Verification & Testing

- **Backend Lint & Syntax:** `cd backend && npm run lint`
- **Frontend Lint:** `cd bylot && npm run lint`
- **Frontend Production Build:** `cd bylot && npm run build`
- **Health Checks:**
  - Base Process: `curl http://localhost:5000/health`
  - Database Connectivity: `curl http://localhost:5000/health/db`
  - Public Config: `curl http://localhost:5000/api/config`
