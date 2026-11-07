# BYLOT — PRODUCTION ENVIRONMENT VARIABLES CHECKLIST

**Application:** Bylot Backend & Frontend  
**Security Standard:** Strict Secret Separation & Zero Exposure  

---

## 1. BACKEND REQUIRED PRODUCTION SECRETS (`backend/.env` or root `.env`)

| Variable Name | Required | Minimum Length | Example Format / Type | Purpose |
|---|---|---|---|---|
| `NODE_ENV` | **YES** | - | `production` | Enables production security guards |
| `PORT` | **YES** | - | `5000` | Internal backend listening port |
| `DB_HOST` | **YES** | - | `mysql` (Docker) or `127.0.0.1` | MySQL server hostname |
| `DB_PORT` | **YES** | - | `3306` | MySQL server port |
| `DB_NAME` | **YES** | - | `bylot` | Target database name |
| `DB_USER` | **YES** | - | `bylot_user` | Restricted application DB user |
| `DB_PASSWORD` | **YES** | >= 16 chars | Alphanumeric + symbols | Database access password |
| `MYSQL_ROOT_PASSWORD` | **YES** | >= 24 chars | High-entropy string | MySQL root user password (container init) |
| `JWT_ACCESS_SECRET` | **YES** | >= 64 chars | 64-character hex or string | Signing JWT access tokens |
| `JWT_REFRESH_SECRET` | **YES** | >= 64 chars | 64-character hex (DISTINCT) | Signing JWT refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | NO | - | `15m` | Lifetime of access tokens |
| `JWT_REFRESH_EXPIRES_IN`| NO | - | `30d` | Lifetime of refresh tokens |
| `ADMIN_PASSWORD` | **YES** | >= 12 chars | Upper, lower, digit, symbol | Production admin password standard |
| `ENCRYPTION_KEY` | **YES** | 64 hex chars | 32-byte hexadecimal | AES-256-GCM encryption for archives/2FA |
| `FRONTEND_URL` | **YES** | - | `https://bylot.in` | Canonical client domain |
| `ALLOWED_ORIGINS` | **YES** | - | `https://bylot.in,https://www.bylot.in` | CORS whitelist |
| `TRUST_PROXY_HOPS` | **YES** | - | `2` | Nginx reverse proxy hop count |
| `GOOGLE_CLIENT_ID` | NO | - | `.apps.googleusercontent.com` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET`| NO | - | Secret string | Google OAuth Client Secret |
| `SMTP_HOST` | NO | - | `smtp.sendgrid.net` / `smtp.resend.com` | Production transactional email host |
| `SMTP_PORT` | NO | - | `587` | SMTP port |
| `SMTP_USER` | NO | - | API user | SMTP username |
| `SMTP_PASS` | NO | - | API key | SMTP password |
| `EMAIL_FROM` | NO | - | `Bylot <no-reply@bylot.in>` | Sender address |

---

## 2. FRONTEND PRODUCTION VARIABLES (`bylot/.env`)

| Variable Name | Required | Default / Format | Notes |
|---|---|---|---|
| `VITE_API_URL` | NO | Empty (uses `/api` proxy) | In production, Nginx proxies `/api` directly |
| `VITE_GOOGLE_CLIENT_ID` | NO | Production Client ID | Provided by owner if Google Sign-In is active |

*CRITICAL RULE:* Never prefix private server secrets or database passwords with `VITE_`. Any variable starting with `VITE_` is statically compiled into public JavaScript bundles.
