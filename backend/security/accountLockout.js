const auditLogger = require("./auditLogger");

class AccountLockoutManager {
  constructor() {
    this.failedAttempts = new Map(); // Key: email or IP -> { count: number, lockedUntil: timestamp | null }
    this.maxAttempts = 5;
    this.lockoutDurationMs = 15 * 60 * 1000; // 15 minutes
    this.windowDurationMs = 10 * 60 * 1000;  // 10 minutes window
  }

  getKey(identifier, ip) {
    return `${(identifier || "").toLowerCase().trim()}:${ip}`;
  }

  isLocked(identifier, ip, req = null) {
    const key = this.getKey(identifier, ip);
    const record = this.failedAttempts.get(key);
    if (!record) return { locked: false };

    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds };
    }

    // Lockout expired, clear lock
    if (record.lockedUntil && now >= record.lockedUntil) {
      this.failedAttempts.delete(key);
    }
    return { locked: false };
  }

  recordFailure(identifier, ip, req = null) {
    const key = this.getKey(identifier, ip);
    const now = Date.now();
    let record = this.failedAttempts.get(key);

    if (!record || (now - record.firstAttempt) > this.windowDurationMs) {
      record = { count: 1, firstAttempt: now, lockedUntil: null };
    } else {
      record.count += 1;
    }

    if (record.count >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutDurationMs;
      auditLogger.logEvent("BRUTE_FORCE_LOCKOUT", req, {
        severity: "CRITICAL",
        details: `Account/IP locked out for 15 minutes due to ${record.count} consecutive failed login attempts on ${identifier}`,
        extra: { identifier, ip }
      });
    } else {
      auditLogger.logEvent("AUTH_FAILURE", req, {
        severity: "HIGH",
        details: `Failed login attempt ${record.count}/${this.maxAttempts} for ${identifier}`,
        extra: { identifier, ip }
      });
    }

    this.failedAttempts.set(key, record);
    return record;
  }

  recordSuccess(identifier, ip, req = null) {
    const key = this.getKey(identifier, ip);
    if (this.failedAttempts.has(key)) {
      this.failedAttempts.delete(key);
    }
    auditLogger.logEvent("AUTH_SUCCESS", req, {
      severity: "INFO",
      details: `Successful authentication for ${identifier}`,
      extra: { identifier, ip }
    });
  }

  getLockoutStats() {
    const activeLockouts = [];
    const now = Date.now();
    for (const [key, record] of this.failedAttempts.entries()) {
      if (record.lockedUntil && now < record.lockedUntil) {
        activeLockouts.push({
          key,
          remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
          attempts: record.count
        });
      }
    }
    return {
      trackedCount: this.failedAttempts.size,
      activeLockoutsCount: activeLockouts.length,
      activeLockouts
    };
  }

  clearLockout(identifier, ip) {
    const key = this.getKey(identifier, ip);
    this.failedAttempts.delete(key);
  }
}

const accountLockout = new AccountLockoutManager();
module.exports = accountLockout;
