# BYLOT — LOGIN & AUTHENTICATION SUBSYSTEM AUDIT

**Repository:** `nagarjunavenkatesan/Bylot`  
**Domain:** `https://bylot.in`  
**Date:** 6 November 2026  
**Subsystem:** Identity, Authentication, Session Management, 2FA & Authorization  

---

## 1. ARCHITECTURE OVERVIEW

Bylot utilizes an enterprise-grade, dual-token stateless/stateful authentication architecture backed by MySQL and cryptographic primitives.

```
+---------------+                +-------------------+                +---------------+
| React Web App |  -- Credentials -> | Express Auth API  |  -- Verify Creds -> | MySQL DB      |
| / Android App |  <- Access Token - | (BCrypt, TOTP)    |  <- User Record --  | (users table) |
|               |  <- Refresh Cookie |                   |                    +---------------+
+---------------+                +-------------------+
```

### Key Credentials & Roles
- **Customer / Buyer:** `buyer@bylot.in` (`role: 'customer'`)
- **Seller:** `seller@bylot.in` (`role: 'seller'`)
- **Admin:** `admin@bylot.in` (`role: 'admin'`)
- **Admin Password Standard:** Minimum 10 chars, uppercase, lowercase, numbers, symbols, no generic patterns. Current verified test password: `Bylot#2026Secured!`.

---

## 2. DETAILED AUTHENTICATION CONTROLS

### 2.1 Token Lifecycle
1. **Access Token:**
   - Standard 3-segment signed JWT (`RS256` or `HS256`).
   - Lifetime: 15 minutes (`JWT_ACCESS_EXPIRES_IN=15m`).
   - Payload: `{ sub: userId, role: userRole, email: userEmail, token_version: N }`.
   - Stored: In-memory in React client; passed via `Authorization: Bearer <token>`.
2. **Refresh Token:**
   - Cryptographically random JWT signed with distinct `JWT_REFRESH_SECRET`.
   - Lifetime: 30 days (`JWT_REFRESH_EXPIRES_IN=30d`).
   - Transmission: Transmitted solely through `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie named `refreshToken`.
   - Rotation: On each `/api/auth/refresh-token` invocation, the existing refresh token is invalidated, the user's `token_version` is incremented, and a new refresh token is issued.
   - Reuse Detection: If an old or revoked refresh token is presented, all active sessions for that user family are revoked immediately.

### 2.2 Password Security & Hashing
- Algorithm: `bcryptjs` with salt rounds = 12.
- Constant-time comparison ensures zero timing discrepancy attacks.
- Complexity: Minimum 10 characters, requiring uppercase, lowercase, number, and special symbol (`authValidators.js`).
- Generic password blacklist check rejects easily guessable combinations (`createAdmin.js`).

### 2.3 Two-Factor Authentication (2FA) for Administrators
- Standard: RFC 6238 Time-Based One-Time Password (TOTP) algorithm (SHA-1, 30-second step, 6 digits).
- Storage: TOTP secrets are encrypted at rest using AES-256-GCM before database insertion (`cryptoUtil.js`).
- Mandatory Policy: Enforced by `authorize("admin")` middleware. If an administrator attempts to query admin management endpoints without having completed 2FA setup and verification, HTTP 403 is returned.
- Backup Recovery Codes: 8 single-use 10-character alphanumeric recovery codes, SHA-256 hashed at rest. Used codes are marked consumed immediately upon use.

### 2.4 Brute-Force & Lockout Protection
- Rate Limiting: 20 login attempts per 15-minute sliding window via `express-rate-limit`.
- Account Lockout: 5 consecutive failed login attempts locks the targeted email account for 15 minutes (`accountLockout.js`). Subsequent failures apply exponential backoff (30m, 60m).
- Information Leak Prevention: Failed logins always respond with generic `"Invalid email or password"`, preventing username harvesting.

---

## 3. VERIFIED TEST MATRIX RESULTS

| Test Scenario | Implementation | Live Execution Result |
|---|---|---|
| Buyer Login | POST `/api/auth/login` | **PASS (200 OK)** |
| Seller Login | POST `/api/auth/login` | **PASS (200 OK)** |
| Admin Login (2FA Challenge) | POST `/api/auth/login` | **PASS (200 OK, 2FA Challenge)** |
| Case-Insensitive Email | Normalizes email | **PASS (200 OK)** |
| Wrong Password | Constant-time verify | **PASS (401 Unauthorized)** |
| Non-Existent Account | Generic response | **PASS (401 Unauthorized)** |
| SQL Injection in Email | Parameterized SQL | **PASS (422 / 401)** |
| Stolen Refresh Token | Refresh Token Reuse Check | **PASS (401 Unauthorized)** |
| Malformed JWT Handling | Catches SyntaxError | **PASS (401 Unauthorized)** |
| Token Refresh & Rotation | POST `/api/auth/refresh-token` | **PASS (200 OK, New Token)** |
| Session Logout | POST `/api/auth/logout` | **PASS (200 OK, Cleared Cookie)** |
| Account Lockout | 5 consecutive failures | **PASS (Account Locked)** |
| Lockout Counter Reset | Valid login resets counter | **PASS (Counter Reset)** |
| CSRF Protection | Validates `X-Requested-With` | **PASS (403 without header)** |

