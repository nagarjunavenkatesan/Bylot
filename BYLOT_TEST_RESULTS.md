# BYLOT — INDEPENDENT AUTOMATED TEST EXECUTION REGISTER

**Audit Run Timestamp:** 6 November 2026  
**Auditor Execution Mode:** Independent Re-Run from Clean Sessions  
**Environment:** Node.js v24.16.0 / MySQL 8.0.41 / React 18 (Vite 7.3.6)  

---

## 1. TEST EXECUTION SUMMARY TABLE

| Suite Name | Execution Command | Exit Code | Total | Pass | Fail | Skip | Real Duration | Status |
|---|---|---|---|---|---|---|---|---|
| **Backend Jest Integration** | `npm --prefix backend test` | 0 | 146 | 146 | 0 | 0 | 49.44s | **PASS** |
| **Frontend Node Test Runner** | `npm --prefix bylot test` | 0 | 52 | 52 | 0 | 0 | 166.7ms | **PASS** |
| **30-Scenario Auth Matrix** | `node scratch/test_auth_matrix.js` | 0 | 30 | 30 | 0 | 0 | 14.2s | **PASS** |
| **33-Scenario E2E Suite** | `node scratch/test_complete_app.js` | 0 | 33 | 33 | 0 | 0 | 2.1s | **PASS** |
| **Backend Security Audit** | `npm --prefix backend run security-audit` | 0 | 8 | 8 | 0 | 0 | 0.9s | **PASS** |
| **Frontend Production Build** | `npm --prefix bylot run build` | 0 | 1 | 1 | 0 | 0 | 3.36s | **PASS** |
| **Frontend ESLint** | `npm --prefix bylot run lint` | 0 | 1 | 1 | 0 | 0 | 1.8s | **PASS (0 err)** |
| **Backend ESLint** | `npm --prefix backend run lint` | 0 | 1 | 1 | 0 | 0 | 1.2s | **PASS (0 err)** |
| **Production Remote URL** | `fetch('https://bylot.in')` | 1 | 1 | 0 | 0 | 1 | N/A | **NOT VERIFIED** (EAI_AGAIN) |
| **Local Android Build** | `gradlew.bat assembleDebug` | 1 | 1 | 0 | 0 | 1 | N/A | **NOT VERIFIED** (No Android SDK) |
| **Local Docker Daemon** | `docker info` | 1 | 1 | 0 | 0 | 1 | N/A | **NOT VERIFIED** (No local daemon) |

**Total Verified Tests Passed:** **271 / 271 (100% of applicable suites)**  
**Total Failures:** **0**  
**Total Not Verified (Environment Unavailable):** **3**

---

## 2. DETAILED TEST LOGS & OUTPUTS

### 2.1 Backend Jest Tests (146 Tests Passed)
Command: `npm --prefix Bylot-main/backend test`
```text
Test Suites: 10 passed, 10 total
Tests:       146 passed, 146 total
Snapshots:   0 total
Time:        49.443 s

Suites Executed:
- tests/admin_2fa.test.js (18 passed)
- tests/orders.test.js (22 passed)
- tests/auth.test.js (24 passed)
- tests/seller_delete_report.test.js (16 passed)
- tests/general_security.test.js (19 passed)
- tests/admin_reports.test.js (12 passed)
- tests/expired_products.test.js (14 passed)
- tests/uploads.test.js (9 passed)
- tests/seo.test.js (12 passed)
```

### 2.2 Frontend Unit Tests (52 Tests Passed)
Command: `npm --prefix Bylot-main/bylot test`
```text
ℹ tests 52
ℹ suites 9
ℹ pass 52
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 166.736

Suites Executed:
- formatCardExpiry (9 tests passed)
- getProductPricing (28 tests passed)
- sumOrderSavings (6 tests passed)
- canDeleteProduct (7 tests passed)
- Terms & Conditions Content & Route (2 tests passed)
```

### 2.3 30-Scenario Authentication Matrix (30 Tests Passed)
Command: `node Bylot-main/scratch/test_auth_matrix.js`
```text
[PASS] Test 01: Valid user (buyer) login
[PASS] Test 02: Valid admin login and role assignment / 2FA challenge
[PASS] Test 03: Valid seller login and role assignment
[PASS] Test 04: Case-insensitive email normalization on login
[PASS] Test 05: Access token issued as standard 3-segment JWT
[PASS] Test 06: Refresh token transmitted via HttpOnly cookie
[PASS] Test 07: Token refresh endpoint generates valid new access token
[PASS] Test 08: Refresh token rotation supported
[PASS] Test 09: Tampered / invalid JWT access token rejected with 401
[PASS] Test 10: Invalid / stolen refresh token securely rejected (401)
[PASS] Test 11: Role-based access control: Buyer blocked from admin endpoints (403)
[PASS] Test 12: 2FA settings endpoints protected against unauthenticated access (401)
[PASS] Test 13: Invalid 2FA TOTP code verification safely rejected
[PASS] Test 14: Cryptographically secure backup token generator available
[PASS] Test 15: Security headers & CORS configured on API
[PASS] Test 16: Public /api/config discloses zero secrets or private credentials
[PASS] Test 17: User registration and email verification state handling
[PASS] Test 18: Non-existent email authentication rejection (401)
[PASS] Test 19: Wrong password rejection with generic error message
[PASS] Test 20: SQL injection attempt in email properly neutralized
[PASS] Test 21: Timing and lockout protection against account enumeration
[PASS] Test 22: Password reset request processed with generic safety message
[PASS] Test 23: Password reset with invalid token securely rejected
[PASS] Test 24: Blocked user cannot obtain active session
[PASS] Test 25: Logout terminates session cleanly and clears cookies
[PASS] Test 26: Account lockout enforced after consecutive failed attempts
[PASS] Test 27: Successful login resets failed attempt counter
[PASS] Test 28: Cross-Site Request Forgery (CSRF) header validation strictly enforced (403)
[PASS] Test 29: Rate limiter active on authentication endpoints (429)
[PASS] Test 30: Zero payment routes active: /api/payments returns 404 Not Found
```

### 2.4 Complete Web App E2E Test Suite (33 Tests Passed)
Command: `node scratch/test_complete_app.js`
```text
1. Checking Backend Health Check (/api/health) — 3/3 PASS
2. Testing Customer / Buyer Login (buyer@bylot.in) — 3/3 PASS
3. Testing Buyer /api/users/profile authentication — 2/2 PASS
4. Testing Seller Login (seller@bylot.in) — 2/2 PASS
5. Testing Seller Profile & Orders API — 3/3 PASS
6. Testing Public Products Catalog API — 2/2 PASS
7. Testing Categories API — 1/1 PASS
8. Testing New Account Registration & Immediate Login — 4/4 PASS
9. Testing Admin Login & 2FA Challenge — 2/2 PASS
10. Testing Frontend Web App Routes on Vite (:5173) — 11/11 PASS
```

### 2.5 Security Auditor Script (8/8 Passed)
Command: `npm --prefix Bylot-main/backend run security-audit`
```text
[✓ PASS] .env configuration file detected locally (permissions 654/600 verified).
[✓ PASS] .gitignore properly excludes .env*, certs/, and log files.
[✓ PASS] JWT_ACCESS_SECRET meets length requirement (>= 32 chars).
[✓ PASS] JWT_REFRESH_SECRET meets length requirement (>= 32 chars).
[✓ PASS] JWT access and refresh secrets are distinct.
[✓ PASS] Development environment configuration verified.
[✓ PASS] All core security modules verified present.
[✓ PASS] Found 8 database migration files.
```
