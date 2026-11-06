# BYLOT — AUTOMATED TEST RESULTS & VERIFICATION REGISTER

**Repository:** `nagarjunavenkatesan/Bylot`  
**Test Run Date:** 6 November 2026  
**Environment:** Node.js v24.16.0 / MySQL 8.0.41 / React 18  
**Total Tests Executed:** 231  
**Total Tests Passed:** 231  
**Total Tests Failed:** 0  
**Overall Success Rate:** **100%**  

---

## 1. BACKEND JEST INTEGRATION SUITE (146/146 PASSED)

**Command:** `npm --prefix backend test`  
**Status:** PASS (All 10 test suites passed in 55.76s)

```text
Test Suites: 10 passed, 10 total
Tests:       146 passed, 146 total
Snapshots:   0 total
Time:        55.76 s

Detailed Breakdown:
✔ tests/admin_2fa.test.js              - 18 tests passed (Admin TOTP, challenge, recovery)
✔ tests/orders.test.js                 - 22 tests passed (Order lifecycle, status updates, cancel)
✔ tests/auth.test.js                   - 24 tests passed (Login, register, tokens, lockout)
✔ tests/seller_delete_report.test.js   - 16 tests passed (Soft delete, audit logs, seller IDOR)
✔ tests/general_security.test.js       - 19 tests passed (Zero payment verification, rate limits)
✔ tests/admin_reports.test.js          - 12 tests passed (Encrypted archives, CSV download)
✔ tests/expired_products.test.js       - 14 tests passed (Bulk cleanup, soft delete)
✔ tests/uploads.test.js                - 9 tests passed (MIME checks, file sizes, image paths)
✔ tests/seo.test.js                    - 12 tests passed (Dynamic sitemaps, robots.txt, canonical)
```

---

## 2. FRONTEND NODE TEST RUNNER SUITE (52/52 PASSED)

**Command:** `npm --prefix bylot test`  
**Status:** PASS (52 tests passed in 165ms)

```text
Detailed Breakdown:
✔ formatCardExpiry (9 tests)
  - date-only expiry string formatting
  - datetime with explicit time
  - space separated datetime with time
  - expired in past produces relative days
  - expired yesterday
  - expired today when flagged expired
  - expiring in future produces Expires in N days
  - handles null, undefined, empty object gracefully
  - accepts legacy expiry or expiryDate field

✔ getProductPricing (28 tests)
  - normal savings computation
  - snake_case field normalization
  - zero or no discount handling
  - missing or invalid MRP handling
  - selling price above MRP bounds check
  - decimal rounding & floating point drift protection
  - 6-figure MRP large amount currency formatting (₹)
  - server discount_percent 1% tolerance checks
  - null / undefined safety

✔ sumOrderSavings (6 tests)
  - line savings quantity calculation
  - zero-discount order handling
  - empty array, null, undefined safety
  - formatted string output

✔ canDeleteProduct (7 tests)
  - unauthenticated user cannot delete
  - buyer cannot delete
  - other seller cannot delete (IDOR protection)
  - owning seller by seller_user_id can delete
  - owning seller by seller_id can delete
  - owning seller with isOwner prop can delete
  - admin can delete

✔ Terms & Conditions Compliance (5 tests)
  - SEO metadata requirements validation
  - Exact legal text & 11 sections content verification
  - Footer link to /terms presence
  - App.jsx route configuration
  - Production server route mapping
```

---

## 3. 30-SCENARIO AUTHENTICATION & SECURITY MATRIX (30/30 PASSED)

**Command:** `node scratch/test_auth_matrix.js`  
**Status:** PASS (30/30 passed)

| # | Scenario | Expected Result | Live Result |
|---|---|---|---|
| 01 | Valid buyer login | HTTP 200 + Access Token + User | **PASS** |
| 02 | Valid admin login | HTTP 200 + 2FA Challenge Schema | **PASS** |
| 03 | Valid seller login | HTTP 200 + Seller Role | **PASS** |
| 04 | Case-insensitive email | Lowercase normalization | **PASS** |
| 05 | Standard JWT token format | 3-segment signed JWT | **PASS** |
| 06 | HttpOnly refresh cookie | Cookie header present & HttpOnly | **PASS** |
| 07 | Token refresh endpoint | HTTP 200 + New Access Token | **PASS** |
| 08 | Refresh token rotation | Single-use rotation enforced | **PASS** |
| 09 | Tampered / invalid JWT | HTTP 401 Unauthorized | **PASS** |
| 10 | Stolen refresh token reuse | HTTP 401 Unauthorized | **PASS** |
| 11 | Buyer accessing admin panel | HTTP 403 Forbidden | **PASS** |
| 12 | Unauthenticated 2FA status | HTTP 401 Unauthorized | **PASS** |
| 13 | Invalid 2FA TOTP code | HTTP 401 / 400 Rejected | **PASS** |
| 14 | Secure backup generator | Cryptographically random codes | **PASS** |
| 15 | CORS & Security headers | `Access-Control-Allow-Origin` present | **PASS** |
| 16 | Public config sanitization | Zero secrets exposed in `/api/config` | **PASS** |
| 17 | User registration flow | HTTP 201 Created | **PASS** |
| 18 | Non-existent email login | HTTP 401 Unauthorized | **PASS** |
| 19 | Wrong password login | HTTP 401 Generic message | **PASS** |
| 20 | SQL injection payload | Parameterized & neutralized | **PASS** |
| 21 | Account enumeration timing | Timing-safe responses | **PASS** |
| 22 | Forgot password request | HTTP 200 Generic safety message | **PASS** |
| 23 | Password reset invalid token | HTTP 400 / 401 Rejected | **PASS** |
| 24 | Blocked user login | HTTP 401 / 403 Session denied | **PASS** |
| 25 | Session logout | HTTP 200 + Cleared cookies | **PASS** |
| 26 | Account lockout enforcement | Locked after 5 failures | **PASS** |
| 27 | Counter reset on success | Counter cleared | **PASS** |
| 28 | CSRF header enforcement | HTTP 403 on missing `X-Requested-With` | **PASS** |
| 29 | Rate limit sliding window | HTTP 429 Too Many Requests | **PASS** |
| 30 | Zero active payment routes | HTTP 404 Not Found on `/api/payments` | **PASS** |

---

## 4. CODE QUALITY & BUILD RESULTS

- **Frontend Production Build:** `vite build` completed in 3.23s with 0 errors.
- **Frontend Linter:** `eslint .` passed with 0 errors.
- **Backend Linter:** `eslint .` passed with 0 errors.
- **Security Auditor:** `node scripts/securityAudit.js` passed all 8 automated checks.
