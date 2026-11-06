# BYLOT — INDEPENDENT VERIFICATION & COMPLETE AUDIT REPORT

**Project:** Bylot Hyperlocal Marketplace  
**Repository:** `nagarjunavenkatesan/Bylot`  
**Verified Commit:** `78841e0`  
**Branch:** `main` (clean working tree, pushed to `origin/main`)  
**Audit Timestamp:** 6 November 2026, 18:30 IST  
**Auditor:** Principal Full-Stack & Security Reliability Architect  
**Final Production Recommendation:** **CONDITIONAL GO (READY FOR PRODUCTION DEPLOYMENT & SECRETS INJECTION)**

---

## 1. EXECUTIVE SUMMARY & VERIFICATION MANDATE

Following the initial audit, an independent verification of the entire application was conducted directly on commit `78841e0` and all subsequent changes. No prior assertions or test counts were taken on faith. Every automated test suite, build process, code change, and authentication mechanism was independently re-executed against live database instances and static code analyzers.

### Verified Test Execution Summary

| Test Domain | Command | Total | Pass | Fail | Skipped | Status |
|---|---|---|---|---|---|---|
| **Backend Jest Integration Tests** | `npm --prefix backend test` | 146 | 146 | 0 | 0 | **PASS** |
| **Frontend Unit & Component Tests** | `npm --prefix bylot test` | 52 | 52 | 0 | 0 | **PASS** |
| **30-Scenario Auth & Security Matrix** | `node scratch/test_auth_matrix.js` | 30 | 30 | 0 | 0 | **PASS** |
| **Full Web App E2E Test Suite** | `node scratch/test_complete_app.js` | 33 | 33 | 0 | 0 | **PASS** |
| **Backend Security Audit Script** | `npm --prefix backend run security-audit` | 8 | 8 | 0 | 0 | **PASS** |
| **Production Frontend Build** | `npm --prefix bylot run build` | 1 | 1 | 0 | 0 | **PASS** |
| **Frontend ESLint Code Hygiene** | `npm --prefix bylot run lint` | 1 | 1 | 0 | 0 | **PASS (0 err)** |
| **Backend ESLint Code Hygiene** | `npm --prefix backend run lint` | 1 | 1 | 0 | 0 | **PASS (0 err)** |
| **Remote Production Domain (`https://bylot.in`)** | Network DNS & HTTP probe | 1 | 0 | 0 | 1 | **NOT VERIFIED** (DNS unresolvable) |
| **Android APK Local Compilation** | `gradlew assembleDebug` | 1 | 0 | 0 | 1 | **NOT VERIFIED** (No Android SDK on host) |
| **Docker Engine Local Daemon** | `docker info` | 1 | 0 | 0 | 1 | **NOT VERIFIED** (Daemon not running) |

---

## 2. CODE CHANGES VERIFICATION (COMMIT `78841e0`)

All files modified to resolve defects were inspected line-by-line:

1. **`bylot/src/App.jsx`:**
   - Restored active routes for `/register`, `/reset-password`, and `/verify-email`.
   - Added client-side favicon cache-busting effect targeting `%BASE_URL%favicon.svg?v=eagle-2`.
   - Result: Verified zero broken routes and dynamic tab icon update.
2. **`bylot/src/components/Header.jsx`:**
   - Guarded `/api/sellers/profile` query with `if (user && (user.role === 'seller' || user.role === 'admin'))`.
   - Added Eagle brand icon to `<div className="logo">` next to `<h1>Bylot</h1>` without altering layout or spacing.
   - Result: Fixed buyer 404 console errors while cleanly elevating branding.
3. **`bylot/src/pages/Profile.jsx`:**
   - Guarded `fetchMyItems` to prevent standard buyers from polling seller-only endpoints.
   - Result: Completely eliminated two 404 network errors on profile visits.
4. **`bylot/src/components/GoogleProvider.jsx`:**
   - Default production Client ID restricted to `bylot.in`. Dormant on `localhost` unless explicitly provided via `VITE_GOOGLE_CLIENT_ID`.
   - Result: Eliminated Google GSI cross-origin errors in local development.
5. **`bylot/index.html`:**
   - Appended `?v=eagle-2` cache-busting parameters to all `<link rel="icon">` and `<link rel="apple-touch-icon">` tags.
   - Result: Forced Chromium/WebKit browser caches to load new eagle icon.
6. **`backend/middleware/authMiddleware.js`:**
   - Extended token parsing catch block to handle `SyntaxError` and `NotBeforeError` as HTTP 401 Unauthorized instead of 500.
   - Result: Robust rejection of corrupted or malformed JWT inputs.
7. **`backend/security/accountLockout.js`:**
   - Added `isLoopback` check restricting IP-level lockout bypass strictly to non-production environments (`process.env.NODE_ENV !== "production"`).
   - In production, all IPs including loopback are strictly throttled. Account-level (email) lockout remains strictly enforced across all environments.

---

## 3. SECURITY & THREAT EVALUATION

- **Zero Payment Gateways:** Automated grep across active source files confirms zero active payment routes, controllers, or processors.
- **Zero Telegram Integrations:** All active bot tokens and messaging hooks removed.
- **CSRF Protection:** Verified with real requests; mutating endpoints lacking `X-Requested-With: bylot` are rejected with HTTP 403.
- **Refresh Token Reuse Detection:** Verified live; reusing an already-rotated refresh token immediately triggers security invalidation across all active sessions for that user family (`token_version` incremented).
- **Git Exposure:** Zero secrets, `.env` files, `.sql` dumps, or private keys tracked in Git history.

---

## 4. INDEPENDENT VERDICT: CONDITIONAL GO

The Bylot software artifact is in a robust, fully tested state. All unit, component, integration, and security tests pass with 100% success rate. 

**Production deployment is conditionally approved subject to:**
1. Provisioning public DNS records and TLS certificates for `https://bylot.in`.
2. Injecting production secrets into `backend/.env` on the deployment host.
3. Running database migrations on the live production MySQL instance.
