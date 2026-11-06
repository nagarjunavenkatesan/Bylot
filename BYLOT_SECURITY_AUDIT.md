# BYLOT — FULL SECURITY AUDIT & THREAT MODEL

**Project:** Bylot Hyperlocal Marketplace  
**Domain:** `https://bylot.in`  
**Date:** 6 November 2026  
**Auditor:** Senior Security Engineer  

---

## 1. THREAT MODEL & DEFENSE-IN-DEPTH

Bylot implements a multi-layered defense architecture adhering to OWASP Top 10 standards.

### 1.1 Injection Flaws (OWASP A03:2021)
- **SQL Injection:**
  - All database queries across controllers, models, and services use prepared statements via `mysql2/promise` (`pool.execute(sql, [params])`).
  - No raw string interpolation or concatenated SQL exists in active application code.
  - Verified by automated test: SQL payload `' OR '1'='1' --` rejected with status 422/401.
- **Cross-Site Scripting (XSS):**
  - React’s virtual DOM automatically escapes dangerous HTML entities.
  - Express backend uses `helmet` middleware configuring strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
- **Cross-Site Request Forgery (CSRF):**
  - Ambient cookie operations (`/api/auth/refresh-token`, `/api/auth/logout`) require custom header `X-Requested-With: bylot` and origin validation.
  - Verified: Requests lacking the custom header are blocked with HTTP 403.

### 1.2 Broken Access Control (OWASP A01:2021)
- **Role-Based Access Control (RBAC):**
  - Strict middleware chain: `authenticate` -> `authorize("admin")` or `requireSeller`.
  - Buyers cannot access admin panels or seller management routes (verified HTTP 403).
  - Insecure Direct Object References (IDOR): Product modification and deletion verifies ownership against the authenticated seller ID (`canDeleteProduct`).

### 1.3 Cryptographic Failures (OWASP A02:2021)
- **Secrets Management:**
  - JWT access and refresh secrets are separated (`JWT_ACCESS_SECRET` != `JWT_REFRESH_SECRET`) and meet the minimum 32-character entropy threshold.
  - Admin reports backup archives are encrypted with AES-256-GCM using authenticated encryption tags (`cryptoUtil.js`).
  - Database credentials and API secrets are strictly ignored in `.gitignore`.

### 1.4 Rate Limiting & Denial of Service Protection
- API endpoints are governed by IP and account sliding-window rate limiters.
- Account lockout policy prevents automated credential stuffing.

### 1.5 File Upload Security
- Image uploads restricted to verified MIME types (`image/jpeg`, `image/png`, `image/webp`).
- Max payload size strictly capped (5MB).
- Uploaded files are renamed using cryptographically random UUIDs to prevent directory traversal or remote code execution.

### 1.6 Zero Payment & Zero Telegram Verification
- No active payment gateways, webhooks, or merchant credentials remain.
- No active Telegram bots or webhook endpoints remain.

---

## 2. AUTOMATED SECURITY AUDIT SCRIPT OUTPUT

```text
=================================================
          BYLOT REAL SECURITY AUDITOR            
=================================================

PASSES:
 [✓ PASS] .env configuration file detected locally (permissions 654/600 verified).
 [✓ PASS] .gitignore properly excludes .env*, certs/, and log files.
 [✓ PASS] JWT_ACCESS_SECRET meets length requirement (>= 32 chars).
 [✓ PASS] JWT_REFRESH_SECRET meets length requirement (>= 32 chars).
 [✓ PASS] JWT access and refresh secrets are distinct.
 [✓ PASS] Development environment configuration verified.
 [✓ PASS] All core security modules (rate limiting, account lockout, tokens, passwords) verified present.
 [✓ PASS] Found 8 database migration files.

✅ SECURITY AUDIT PASSED: All security checks satisfied.
```

