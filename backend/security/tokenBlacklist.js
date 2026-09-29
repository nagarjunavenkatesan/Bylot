const auditLogger = require("./auditLogger");

class TokenBlacklist {
  constructor() {
    this.blacklistedTokens = new Map(); // token -> expiry timestamp
    // Periodically clean up expired tokens from memory every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  blacklist(token, expiresAtMs = Date.now() + 24 * 60 * 60 * 1000, req = null) {
    if (!token) return;
    this.blacklistedTokens.set(token, expiresAtMs);
    auditLogger.logEvent("TOKEN_REVOKED", req, {
      severity: "INFO",
      details: "JWT Access Token revoked and added to security blacklist."
    });
  }

  isBlacklisted(token) {
    if (!token) return false;
    const expiresAt = this.blacklistedTokens.get(token);
    if (!expiresAt) return false;
    
    if (Date.now() > expiresAt) {
      this.blacklistedTokens.delete(token);
      return false;
    }
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [token, expiresAt] of this.blacklistedTokens.entries()) {
      if (now > expiresAt) {
        this.blacklistedTokens.delete(token);
      }
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
