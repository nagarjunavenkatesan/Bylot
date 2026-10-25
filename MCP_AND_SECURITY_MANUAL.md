# Bylot Enterprise Security System & Model Context Protocol (MCP) Manual

## 1. High Security System Architecture

The application has been upgraded with an enterprise defense-in-depth security system consisting of 6 core modules, hardened HTTP headers, double-submit CSRF protection, and audit logging.

### Security Modules (`backend/security/`)
| Module | Location | Purpose |
|---|---|---|
| **Audit Logger** | [`backend/security/auditLogger.js`](file:///c:/Users/HP/Music/Bylot-main/Bylot-main/backend/security/auditLogger.js) | Structured audit logging of security events (SQLi, XSS, failed logins, admin actions, IP blocking) persisted to `logs/security-audit.json`. |
| **Cryptography (AES-256-GCM)** | [`backend/security/cryptoUtil.js`](file:///c:/Users/HP/Music/Bylot-main/Bylot-main/backend/security/cryptoUtil.js) | Authenticated encryption at rest for sensitive PII data, secure token generation, and password policy strength verification. |
| **Account Lockout** | [`backend/security/accountLockout.js`](file:///c:/Users/HP/Music/Bylot-main/Bylot-main/backend/security/accountLockout.js) | Brute force defense: tracks failed login attempts; triggers a 15-minute lockout after 5 failed attempts. |
| **Token Revocation (Blacklist)** | [`backend/security/tokenBlacklist.js`](file:///c:/Users/HP/Music/Bylot-main/Bylot-main/backend/security/tokenBlacklist.js) | Immediate invalidation of JWT tokens on logout or security alerts, preventing stolen access token reuse. |
| **Input Sanitizer** | [`backend/security/inputSanitizer.js`](file:///c:/Users/HP/Music/Bylot-main/Bylot-main/backend/security/inputSanitizer.js) | Deep sanitization against Cross-Site Scripting (XSS), SQL injection patterns, and Prototype Pollution attacks. |
| **CSRF Defense** | [`backend/security/csrfProtection.js`](file:///c:/Users/HP/Music/Bylot-main/Bylot-main/backend/security/csrfProtection.js) | Double submit CSRF verification for all state-changing API endpoints (`POST`, `PUT`, `DELETE`, `PATCH`). |

### Running the Security Auditor CLI
To evaluate system compliance and security posture score:
```bash
cd backend
npm run security-audit
```
Current Score: **100 / 100 (Optimal)**

---

## 2. Model Context Protocol (MCP) Server

The Bylot application now features a full **Model Context Protocol (MCP)** server implemented according to the official `@modelcontextprotocol/sdk` standard.

### Execution Options
1. **Stdio Transport (for AI Clients like Claude Desktop, Antigravity IDE, Cursor)**:
   ```bash
   cd backend
   npm run mcp
   # or directly:
   node mcp/server.js
   ```

2. **HTTP API Bridge**:
   - Manifest: `GET /mcp/manifest`
   - Tool Execution: `POST /mcp/tools/:toolName`

### MCP Capabilities Exposed
#### Tools (7)
1. `bylot_system_status`: Real-time system health, uptime, database connection state, and server runtime information.
2. `bylot_security_audit`: Live security posture assessment, audit logs, active lockouts, threat level score, and WAF metrics.
3. `bylot_manage_users`: Search, inspect, block, or unblock user accounts.
4. `bylot_manage_products`: Search, inspect stock, flag policy violations (near-expiry, deceptive prices), or update status.
5. `bylot_manage_orders`: Query purchase orders, inspect order timelines, and track grand totals.
6. `bylot_security_action`: Execute administrative actions like clearing account lockouts or running a complete security scan.
7. `bylot_database_analytics`: Retrieve district-level analytics, seller stats, category distribution, and marketplace performance metrics.

#### Resources (3)
1. `bylot://security/report`: Live security audit report & threat matrix.
2. `bylot://system/health`: Full health & infrastructure diagnostic snapshot.
3. `bylot://analytics/digest`: Real-time marketplace analytics digest.

#### Prompts (2)
1. `security_threat_analysis`: Prompt template for analyzing active security threats, suspicious IPs, and login anomaly reports.
2. `marketplace_health_check`: Prompt template for evaluating platform performance, user status, product compliance, and order fulfillment.

---

## 3. How to Connect External AI Clients (e.g. Claude Desktop)

In your MCP client configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "bylot": {
      "command": "node",
      "args": [
        "c:/Users/HP/Music/Bylot-main/Bylot-main/backend/mcp/server.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

## 4. Admin Panel Integration

The web frontend includes a dedicated **Security & MCP** dashboard within the Admin Panel ([`bylot/src/components/SecurityMcpDashboard.jsx`](file:///c:/Users/HP/Music/Bylot-main/Bylot-main/bylot/src/components/SecurityMcpDashboard.jsx)):
- Real-time Threat Level indicator and security audit stream.
- Live MCP Interactive Tool Sandbox to test tool execution with instant JSON output.
- Active lockouts monitor and one-click security refresh.
- Admin Two-Step Verification (2FA) settings: status monitoring, one-time recovery code regeneration, and cryptographically verified 2FA toggle.

---

## 5. Admin Two-Factor Authentication (TOTP 2FA)

### Security Specifications & Architecture
- **Protocol**: Standard RFC 6238 TOTP (SHA-1, 30-second step, 6-digit codes, ±1 window clock-skew tolerance).
- **Compatible Authenticator**: Google Authenticator, Microsoft Authenticator, Apple Passwords, 1Password, Bitwarden.
- **Challenge Architecture**: Short-lived (5-minute expiration) cryptographically secure single-use challenges (`admin_2fa_challenges`).
- **Access Token Guard**: Neither admin JWT access tokens nor refresh tokens are issued before successful TOTP or backup code verification.
- **Secret Encryption at Rest**: Encrypted in `admin_2fa` table using authenticated AES-256-GCM (`cryptoUtil.encryptPII`) with random 16-byte IVs. Raw secrets are NEVER returned via APIs or recorded in audit logs.
- **Emergency Recovery Codes**: 10 cryptographically random single-use recovery codes (`XXXX-XXXX`) generated on setup or regeneration. Stored exclusively as normalized SHA-256 hashes (`admin_2fa_recovery_codes`) with immediate invalidation upon consumption (`used_at` timestamp).
- **Anti-Brute Force**: 5-attempt challenge limit per session, challenge invalidation on threshold exceedance, IP rate limiting via `twoFactorLimiter`, and generic error messages preventing credential enumeration.
- **Replay Protection**: Stores `last_used_time_step` on admin record; prevents replaying identical OTP codes within the same valid time window.
- **Google OAuth Admin Guard**: Administrators logging in via Google OAuth are strictly subjected to the mandatory 2FA challenge flow; customer Google OAuth continues uninterrupted.

