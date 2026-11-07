# BYLOT — INITIAL PRODUCTION READINESS AUDIT

**Target:** Bylot Hyperlocal Marketplace  
**Repository:** `nagarjunavenkatesan/Bylot`  
**Domain:** `https://bylot.in`  
**Auditor:** Senior Production Engineering & Security Team  
**Phase:** Phase 1 — Comprehensive Baseline Inspection  

---

## 1. ARCHITECTURE OVERVIEW

Bylot is a full-stack hyperlocal marketplace web and mobile ecosystem connecting local consumers with neighborhood sellers offering near-expiry and discounted consumer goods.

```
[ Web Client: React 18 + Vite ] <==== HTTP / JSON ====> [ Express API (Node 20/24) ] <==== SQL ====> [ MySQL 8.0 ]
[ Mobile: Android Retrofit / Kotlin ] <===================| (Port 5000 / Nginx) |
```

### Core Architecture Components
- **Frontend (`bylot/`):** React 18 single-page application built with Vite, styled with responsive custom CSS design tokens, framed with Framer Motion transitions, and routed with React Router DOM v6.
- **Backend (`backend/`):** Node.js Express server providing RESTful JSON APIs, JWT dual-token authentication, TOTP two-step verification for administrators, AES-256 encrypted archival reporting, dynamic SEO rendering, and image upload pipelines.
- **Database (`migrations/`, `backend/config/schema.sql`):** MySQL 8 relational schema with connection pooling, transactional order placement, soft-delete audit records, and indexed query paths.
- **Reverse Proxy & Gateway (`deploy/nginx/`, `bylot/nginx.conf`):** Nginx with Let's Encrypt SSL termination, HSTS, gzip compression, and security headers.
- **Mobile Client (`android-retrofit-example/`):** Kotlin/Jetpack Compose Android app interacting with the backend via Retrofit 2.

---

## 2. EXISTING WORKING FEATURES

- **Catalog & Deal Discovery:** Hyperlocal deal browsing, category filtering, district filtering, search, and dynamic discount calculations.
- **Product Details & Expiry Tracking:** Expiry date countdowns, savings badges, MRP vs selling price calculations, and structured schema tags.
- **Seller Lifecycle:** Seller application submission, product creation, multi-image uploads, product updates, and soft deletions.
- **Order Management:** Buyer order placement, seller order status updates, and cancellation workflows.
- **Administrator Panel:** Admin authentication, mandatory 2FA enrollment/verification, seller approval, user account blocking, and bulk expired product cleanup.
- **SEO Architecture:** Dynamic server-rendered metadata, dynamic XML sitemaps (`sitemap-pages.xml`, `sitemap-products-1.xml`, etc.), OpenGraph, and `robots.txt`.

---

## 3. DEFECT REGISTER & SEVERITY CLASSIFICATION

### 3.1 Critical Issues (P0) — RESOLVED
- **DEF-01: Broken Frontend Auth Routes (`App.jsx`):** Routes `/register`, `/reset-password`, and `/verify-email` were redirected to `/login`, blocking account creation and self-service password recovery.  
  *Fix:* Restored active routes and added clear links on `Login.jsx`.
- **DEF-02: Malformed JWT Exception Escalation (`authMiddleware.js`):** A malformed base64 JWT payload caused `jsonwebtoken` to throw a `SyntaxError`, which bypassed the catch block and threw an HTTP 500 rather than an HTTP 401.  
  *Fix:* Caught `SyntaxError` and `NotBeforeError` in `authMiddleware.js` returning 401.

### 3.2 High-Priority Issues (P1) — RESOLVED
- **DEF-03: Header & Profile 404 Errors for Standard Customers:** Buyers visiting any page triggered an unauthorized `/api/sellers/profile` query that returned 404 in browser console.  
  *Fix:* Guarded queries so only accounts with `user.role === 'seller' || user.role === 'admin'` invoke seller endpoints.
- **DEF-04: Account Lockout Loopback Developer Lock:** Running brute-force automated tests on localhost locked `127.0.0.1`, halting subsequent tests.  
  *Fix:* Added non-production loopback exemption for IP throttling while keeping strict per-account lockout active.

### 3.3 Medium-Priority Issues (P2) — RESOLVED
- **DEF-05: Stale Browser Tab Favicon Cache:** Chromium aggressively cached the legacy blue "B" SVG icon.  
  *Fix:* Version query strings (`?v=eagle-2`) added to all icon links in `index.html` and dynamic refresh added to `App.jsx`.
- **DEF-06: Google OAuth Origin Console Error:** Default production Client ID triggered GSI origin rejection on localhost.  
  *Fix:* Scoped default Client ID strictly to `bylot.in` production domain.

---

## 4. MISSING PRODUCTION CONFIGURATIONS & BLOCKERS

1. **DNS Delegation (Owner Action):** `bylot.in` must point via A record to the target VPS IP. Currently returns `EAI_AGAIN` (unresolvable).
2. **Production Secrets Injection (Owner Action):** Strong cryptographic keys must be generated and populated into production `.env`.
3. **SSL Certificate Issuance (Server Action):** Certbot Let's Encrypt certificates must be requested once DNS propagates.
