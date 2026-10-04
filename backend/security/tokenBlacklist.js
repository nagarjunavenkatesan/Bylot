const crypto = require("crypto");
const auditLogger = require("./auditLogger");
const { pool } = require("../config/db");

class TokenBlacklist {
  constructor() {
    this.blacklistedTokens = new Map(); // tokenHash -> expiry timestamp (ms)
    this.initialized = false;
    this.initPromise = this.init();

    // Periodically clean up expired tokens from memory and database every 10 minutes
    const timer = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  hashToken(token) {
    if (!token) return "";
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async init() {
    try {
      const [rows] = await pool.query(
        "SELECT token_hash, UNIX_TIMESTAMP(expires_at) * 1000 AS exp_ms FROM token_blacklist WHERE expires_at > NOW()"
      );
      for (const row of rows) {
        this.blacklistedTokens.set(row.token_hash, Number(row.exp_ms));
      }
      this.initialized = true;
    } catch {
      // Table might not be ready yet during early setup/test initialization
    }
  }

  async blacklist(token, expiresAtMs = Date.now() + 24 * 60 * 60 * 1000, req = null) {
    if (!token) return;
    const tokenHash = this.hashToken(token);
    this.blacklistedTokens.set(tokenHash, expiresAtMs);

    try {
      const expiresDate = new Date(expiresAtMs);
      await pool.execute(
        `INSERT INTO token_blacklist (token_hash, expires_at)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
        [tokenHash, expiresDate]
      );
    } catch (err) {
      console.error("[TokenBlacklist] Failed to persist revoked token to DB:", err.message);
    }

    auditLogger.logEvent("TOKEN_REVOKED", req, {
      severity: "INFO",
      details: "JWT Access Token revoked and added to persistent security blacklist."
    });
  }

  isBlacklisted(token) {
    if (!token) return false;
    const tokenHash = this.hashToken(token);
    const expiresAt = this.blacklistedTokens.get(tokenHash);
    if (!expiresAt) return false;

    if (Date.now() > expiresAt) {
      this.blacklistedTokens.delete(tokenHash);
      return false;
    }
    return true;
  }

  async isBlacklistedAsync(token) {
    if (!token) return false;
    if (this.isBlacklisted(token)) return true;

    // Check DB directly in case another instance added it or server recently restarted
    try {
      const tokenHash = this.hashToken(token);
      const [rows] = await pool.execute(
        "SELECT token_hash, UNIX_TIMESTAMP(expires_at) * 1000 AS exp_ms FROM token_blacklist WHERE token_hash = ? AND expires_at > NOW() LIMIT 1",
        [tokenHash]
      );
      if (rows.length > 0) {
        this.blacklistedTokens.set(tokenHash, Number(rows[0].exp_ms));
        return true;
      }
    } catch {
      // DB check fallback
    }
    return false;
  }

  async cleanup() {
    const now = Date.now();
    for (const [hash, expiresAt] of this.blacklistedTokens.entries()) {
      if (now > expiresAt) {
        this.blacklistedTokens.delete(hash);
      }
    }

    try {
      await pool.execute("DELETE FROM token_blacklist WHERE expires_at <= NOW()");
    } catch (err) {
      console.warn("[TokenBlacklist] Cleanup query notice:", err.message);
    }
  }

  getStats() {
    return {
      blacklistedCount: this.blacklistedTokens.size
    };
  }
}

const tokenBlacklist = new TokenBlacklist();
module.exports = tokenBlacklist;
