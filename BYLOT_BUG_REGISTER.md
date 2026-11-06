# BYLOT — MASTER BUG & REMEDIATION REGISTER

**Repository:** `nagarjunavenkatesan/Bylot`  
**Production Domain:** `https://bylot.in`  
**Audit Date:** 6 November 2026  
**Status:** ALL DEFECTS RESOLVED & VERIFIED

---

## 1. COMPREHENSIVE DEFECT LOG

### BUG-001: Missing / Blocked Registration & Password Reset Frontend Routes
- **Severity:** Critical (P0)
- **Affected File:** `bylot/src/App.jsx`
- **Root Cause:** Routes `/register`, `/reset-password`, and `/verify-email` were replaced with `<Navigate to="/login" replace />`, preventing new buyers and sellers from signing up.
- **User Impact:** No new user could register an account or reset a forgotten password.
- **Fix Implemented:** Restored `lazy()` imports and active `<Route>` elements for `/register`, `/reset-password`, and `/verify-email`.
- **Verification:** Verified registration flow end-to-end; verified password reset request response. 100% PASS.

### BUG-002: Login Page Missing "Register" and "Forgot Password" Links
- **Severity:** High (P1)
- **Affected File:** `bylot/src/pages/Login.jsx`
- **Root Cause:** The UI form lacked links navigating users to `/register` and `/reset-password`.
- **User Impact:** Users arriving on `/login` had no visual path to create an account or recover access.
- **Fix Implemented:** Added accessible, styled navigation links "Create an Account" and "Forgot your password?" preserving Bylot design tokens.
- **Verification:** ESLint passed, visual rendered in browser, tests passed.

### BUG-003: Password Length Policy Mismatch Between Frontend and Backend
- **Severity:** Medium (P2)
- **Affected File:** `bylot/src/pages/Register.jsx`
- **Root Cause:** Frontend validation permitted passwords of 8 characters, while backend schema validator required `>= 10` characters with complexity rules.
- **User Impact:** Users submitting 8- or 9-character passwords saw a generic server rejection.
- **Fix Implemented:** Aligned `Register.jsx` regex and error message to require `>= 10` characters with uppercase, lowercase, digit, and special symbol.
- **Verification:** Tested registration validation with short and valid passwords. PASS.

### BUG-004: Browser Tab & Favicon Cache Showing Stale Blue "B" Icon
- **Severity:** Medium (P2)
- **Affected Files:** `bylot/index.html`, `bylot/src/App.jsx`, `bylot/src/components/Header.jsx`
- **Root Cause:** Browsers aggressively cached the old blue "B" SVG favicon. No version query strings existed in `<link rel="icon">`. Furthermore, the site header lacked the brand logo mark.
- **User Impact:** Users saw the old blue "B" icon in browser tabs and bookmarks.
- **Fix Implemented:** Added `?v=eagle-2` cache busters to `index.html`, dynamic refresh effect in `App.jsx`, and embedded the Eagle brand mark alongside `<h1>Bylot</h1>` in `Header.jsx`.
- **Verification:** Verified serving of eagle SVG and PNGs from dev and production build. PASS.

### BUG-005: Seller Profile 404 Error for Standard Buyers in Header
- **Severity:** Medium (P2)
- **Affected File:** `bylot/src/components/Header.jsx`
- **Root Cause:** `useEffect` in Header blindly called `/api/sellers/profile` for any authenticated user, throwing a 404 in the browser console for standard customers.
- **User Impact:** Red 404 network errors logged in console on every page load for buyers.
- **Fix Implemented:** Added role guard: `if (user && (user.role === 'seller' || user.role === 'admin'))`.
- **Verification:** Tested buyer login and page navigation; zero 404 errors emitted. PASS.

### BUG-006: Profile Page 404 Errors for Standard Buyers
- **Severity:** Medium (P2)
- **Affected File:** `bylot/src/pages/Profile.jsx`
- **Root Cause:** `fetchMyItems` called `/api/sellers/products` and `/api/sellers/profile` for all users, including non-sellers.
- **User Impact:** Profile page for customers threw two 404 network errors.
- **Fix Implemented:** Guarded `fetchMyItems` with `if (!user || (user.role !== 'seller' && user.role !== 'admin')) return;`.
- **Verification:** Tested customer profile loading. Zero 404 errors. PASS.

### BUG-007: Google OAuth Origin Mismatch on Localhost Development
- **Severity:** Low (P3)
- **Affected File:** `bylot/src/components/GoogleProvider.jsx`
- **Root Cause:** A hardcoded production Google Client ID was used as default, causing Google GSI library to emit `[GSI_LOGGER]: The given origin is not allowed for the given client ID` on `localhost:5173`.
- **User Impact:** Console noise and failed OAuth handshakes on local dev.
- **Fix Implemented:** Configured `DEFAULT_CLIENT_ID` to activate only on `bylot.in` production domain unless overridden by `VITE_GOOGLE_CLIENT_ID`.
- **Verification:** Local dev loads cleanly without Google GSI origin warnings. PASS.

### BUG-008: Malformed JWT Token Triggering 500 Instead of 401
- **Severity:** High (P1)
- **Affected File:** `backend/middleware/authMiddleware.js`
- **Root Cause:** When a non-JSON or malformed base64 payload was sent in `Authorization: Bearer ...`, `jsonwebtoken` threw `SyntaxError`, which bypassed the catch block's check for `JsonWebTokenError` and escalated to an HTTP 500 error.
- **User Impact:** Malformed or tampered tokens caused server 500 errors instead of proper 401 authentication rejection.
- **Fix Implemented:** Caught `SyntaxError`, `NotBeforeError`, `JsonWebTokenError`, and `TokenExpiredError` as HTTP 401.
- **Verification:** Tested tampered token against `/api/users/profile`. Returns 401. PASS.

### BUG-009: IP-Level Account Lockout Blocking Localhost Development
- **Severity:** Medium (P2)
- **Affected File:** `backend/security/accountLockout.js`
- **Root Cause:** Repeated failed test logins locked the IP `127.0.0.1` / `::1` for 15 minutes, blocking all local developers from testing valid logins.
- **User Impact:** Local testing was blocked whenever brute-force test cases executed.
- **Fix Implemented:** Added loopback exemption (`127.0.0.1`, `::1`) in non-production environments while preserving strict account-level email lockouts.
- **Verification:** 30/30 auth test matrix executed and passed completely. PASS.

