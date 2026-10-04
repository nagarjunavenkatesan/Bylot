const auditLogger = require("./auditLogger");

class AccountLockoutManager {
  constructor() {
    // Map of key -> { count: number, firstAttempt: number, lockedUntil: timestamp | null }
    this.emailAttempts = new Map();
    this.ipAttempts = new Map();

    this.maxAttempts = 5;
    this.windowDurationMs = 15 * 60 * 1000; // 15 minutes window

    // Periodic cleanup every 5 minutes to prevent memory leak
    const timer = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  getLockoutDurationMs(count) {
    // Exponential back-off: 5 attempts = 15m, 10 attempts = 30m, 15+ attempts = 60m
    if (count >= 15) return 60 * 60 * 1000;
    if (count >= 10) return 30 * 60 * 1000;
    return 15 * 60 * 1000;
  }

  isLocked(identifier, ip, _req = null) {
    const now = Date.now();
    const cleanEmail = (identifier || "").toLowerCase().trim();
    const cleanIp = (ip || "").trim();

    // Check account-level lockout (by email)
    if (cleanEmail && this.emailAttempts.has(cleanEmail)) {
      const emailRecord = this.emailAttempts.get(cleanEmail);
      if (emailRecord.lockedUntil && now < emailRecord.lockedUntil) {
        const remainingSeconds = Math.ceil((emailRecord.lockedUntil - now) / 1000);
        return { locked: true, remainingSeconds, reason: "account" };
      }
    }

    // Check IP-level lockout
    if (cleanIp && this.ipAttempts.has(cleanIp)) {
      const ipRecord = this.ipAttempts.get(cleanIp);
      if (ipRecord.lockedUntil && now < ipRecord.lockedUntil) {
        const remainingSeconds = Math.ceil((ipRecord.lockedUntil - now) / 1000);
        return { locked: true, remainingSeconds, reason: "ip" };
      }
    }

    return { locked: false };
  }

  recordFailure(identifier, ip, req = null) {
    const now = Date.now();
    const cleanEmail = (identifier || "").toLowerCase().trim();
    const cleanIp = (ip || "").trim();

    // 1. Record failure for email
    if (cleanEmail) {
      let rec = this.emailAttempts.get(cleanEmail);
      if (!rec || (now - rec.firstAttempt) > this.windowDurationMs) {
        rec = { count: 1, firstAttempt: now, lockedUntil: null };
      } else {
        rec.count += 1;
      }

      if (rec.count >= this.maxAttempts) {
        const duration = this.getLockoutDurationMs(rec.count);
        rec.lockedUntil = now + duration;
        auditLogger.logEvent("BRUTE_FORCE_LOCKOUT", req, {
          severity: "CRITICAL",
          details: `Account ${cleanEmail} locked out for ${Math.round(duration / 60000)} minutes due to ${rec.count} consecutive failures`,
          extra: { email: cleanEmail, ip: cleanIp }
        });
      }
      this.emailAttempts.set(cleanEmail, rec);
    }

    // 2. Record failure for IP
    if (cleanIp) {
      let rec = this.ipAttempts.get(cleanIp);
      if (!rec || (now - rec.firstAttempt) > this.windowDurationMs) {
        rec = { count: 1, firstAttempt: now, lockedUntil: null };
      } else {
        rec.count += 1;
      }

      if (rec.count >= this.maxAttempts) {
        const duration = this.getLockoutDurationMs(rec.count);
        rec.lockedUntil = now + duration;
        auditLogger.logEvent("BRUTE_FORCE_LOCKOUT", req, {
          severity: "CRITICAL",
          details: `IP ${cleanIp} locked out for ${Math.round(duration / 60000)} minutes due to ${rec.count} consecutive failures`,
          extra: { email: cleanEmail, ip: cleanIp }
        });
      }
      this.ipAttempts.set(cleanIp, rec);
    }
  }

  recordSuccess(identifier, ip, req = null) {
    const cleanEmail = (identifier || "").toLowerCase().trim();
    const cleanIp = (ip || "").trim();

    if (cleanEmail) this.emailAttempts.delete(cleanEmail);
    if (cleanIp) this.ipAttempts.delete(cleanIp);

    auditLogger.logEvent("AUTH_SUCCESS", req, {
      severity: "INFO",
      details: `Successful authentication for ${cleanEmail || cleanIp}`,
      extra: { identifier: cleanEmail, ip: cleanIp }
    });
  }

  clearLockout(identifier, ip) {
    if (identifier) {
      const clean = String(identifier).trim();
      if (clean.includes("@")) {
        this.emailAttempts.delete(clean.toLowerCase());
      } else if (clean.includes(".") || clean.includes(":")) {
        this.ipAttempts.delete(clean);
      } else {
        this.emailAttempts.delete(clean.toLowerCase());
        this.ipAttempts.delete(clean);
      }
    }
    if (ip) {
      const cleanIp = String(ip).trim();
      this.ipAttempts.delete(cleanIp);
    }
  }

  getLockoutStats() {
    const now = Date.now();
    const activeLockouts = [];

    for (const [email, record] of this.emailAttempts.entries()) {
      if (record.lockedUntil && now < record.lockedUntil) {
        activeLockouts.push({
          key: `account:${email}`,
          remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
          attempts: record.count
        });
      }
    }

    for (const [ip, record] of this.ipAttempts.entries()) {
      if (record.lockedUntil && now < record.lockedUntil) {
        activeLockouts.push({
          key: `ip:${ip}`,
          remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
          attempts: record.count
        });
      }
    }

    return {
      trackedEmailsCount: this.emailAttempts.size,
      trackedIpsCount: this.ipAttempts.size,
      activeLockoutsCount: activeLockouts.length,
      activeLockouts
    };
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [key, record] of this.emailAttempts.entries()) {
      if ((record.lockedUntil && now >= record.lockedUntil) || (!record.lockedUntil && now - record.firstAttempt > this.windowDurationMs)) {
        this.emailAttempts.delete(key);
      }
    }
    for (const [key, record] of this.ipAttempts.entries()) {
      if ((record.lockedUntil && now >= record.lockedUntil) || (!record.lockedUntil && now - record.firstAttempt > this.windowDurationMs)) {
        this.ipAttempts.delete(key);
      }
    }
  }
}

const accountLockout = new AccountLockoutManager();
module.exports = accountLockout;
