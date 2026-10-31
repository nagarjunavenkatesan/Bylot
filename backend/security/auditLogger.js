const fs = require("fs");
const path = require("path");

class AuditLogger {
  constructor() {
    this.logsDir = path.resolve(process.cwd(), "logs");
    this.auditFilePath = path.join(this.logsDir, "security-audit.json");
    this.inMemoryLogs = [];
    this.maxMemoryLogs = 500;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      if (fs.existsSync(this.auditFilePath)) {
        const raw = fs.readFileSync(this.auditFilePath, "utf8");
        const lines = raw.trim().split("\n").filter(Boolean);
        this.inMemoryLogs = lines.slice(-this.maxMemoryLogs).map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(Boolean);
      }
    } catch (err) {
      console.warn("[AuditLogger] Failed to initialize file logger:", err.message);
    }
  }

  sanitizeLogData(data) {
    if (!data || typeof data !== "object") return data;
    const SENSITIVE_KEYS = [
      "password", "secret", "totp", "totpcode", "code", "recoverycode",
      "jwt", "token", "refreshtoken", "accesstoken", "authorization",
      "secret_encrypted", "secretencrypted", "key"
    ];
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeLogData(item));
    }
    const sanitized = {};
    for (const [k, v] of Object.entries(data)) {
      const lower = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (SENSITIVE_KEYS.some(sk => lower.includes(sk))) {
        sanitized[k] = "[REDACTED]";
      } else if (typeof v === "object" && v !== null) {
        sanitized[k] = this.sanitizeLogData(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  logEvent(type, req = null, metadata = {}) {
    const timestamp = new Date().toISOString();
    const ip = req
      ? (req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "unknown")
      : (metadata.ip || "system");
    
    const userAgent = req?.headers ? (req.headers["user-agent"] || "unknown") : "unknown";
    const pathName = req?.originalUrl || req?.url || metadata.path || "N/A";
    const method = req?.method || metadata.method || "N/A";
    const userId = req?.user?.id || metadata.userId || null;

    const safeDetails = typeof metadata.details === "string" ? metadata.details : JSON.stringify(this.sanitizeLogData(metadata.details || {}));
    const safeExtra = this.sanitizeLogData(metadata.extra || {});

    const entry = {
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp,
      type,
      severity: metadata.severity || this.getSeverity(type),
      ip,
      method,
      path: pathName,
      userId,
      userAgent: userAgent.slice(0, 150),
      details: safeDetails,
      extra: safeExtra
    };

    this.inMemoryLogs.push(entry);
    if (this.inMemoryLogs.length > this.maxMemoryLogs) {
      this.inMemoryLogs.shift();
    }

    // Persist asynchronously
    setImmediate(() => {
      try {
        fs.appendFileSync(this.auditFilePath, JSON.stringify(entry) + "\n", "utf8");
      } catch (err) {
        console.error("[AuditLogger] Failed to write entry:", err.message);
      }
    });

    return entry;
  }

  getSeverity(type) {
    switch (type) {
      case "SQLI_ATTEMPT":
      case "XSS_ATTEMPT":
      case "BRUTE_FORCE_LOCKOUT":
      case "UNAUTHORIZED_ADMIN_ACCESS":
      case "FILE_MALWARE_SUSPECT":
        return "CRITICAL";
      case "AUTH_FAILURE":
      case "ADMIN_2FA_LOGIN_FAILED":
      case "ADMIN_2FA_RECOVERY_USED":
      case "ADMIN_2FA_DISABLED":
      case "CSRF_MISMATCH":
      case "RATE_LIMIT_EXCEEDED":
      case "TOKEN_REVOKED_USAGE":
      case "SUSPICIOUS_PAYLOAD":
      case "REPORT_GENERATION_FAILED":
      case "PRODUCT_DELETE_FORBIDDEN":
        return "HIGH";
      case "ACCOUNT_LOCKED":
      case "IP_BLOCKED":
      case "REPORT_DELETE":
        return "MEDIUM";
      case "ADMIN_2FA_ENROLL_STARTED":
      case "ADMIN_2FA_ENABLED":
      case "ADMIN_2FA_LOGIN_SUCCESS":
      case "ADMIN_2FA_RECOVERY_CODES_REGENERATED":
      case "REPORT_CREATED":
      case "REPORT_DOWNLOAD":
      case "REPORT_AUTO_EXPIRED":
      case "PRODUCT_DELETED":
        return "INFO";
      default:
        return "INFO";
    }
  }

  getRecentLogs(limit = 50, filterType = null, minSeverity = null) {
    let results = [...this.inMemoryLogs];
    if (filterType) {
      results = results.filter((log) => log.type === filterType);
    }
    if (minSeverity) {
      const severityMap = { INFO: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      const minLevel = severityMap[minSeverity] || 1;
      results = results.filter((log) => (severityMap[log.severity] || 1) >= minLevel);
    }
    return results.slice(-limit).reverse();
  }

  getStats() {
    const stats = {
      totalEvents: this.inMemoryLogs.length,
      severityBreakdown: { INFO: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      topTypes: {},
      topIPs: {}
    };

    for (const log of this.inMemoryLogs) {
      stats.severityBreakdown[log.severity] = (stats.severityBreakdown[log.severity] || 0) + 1;
      stats.topTypes[log.type] = (stats.topTypes[log.type] || 0) + 1;
      if (log.ip && log.ip !== "system" && log.ip !== "unknown") {
        stats.topIPs[log.ip] = (stats.topIPs[log.ip] || 0) + 1;
      }
    }
    return stats;
  }
}

const auditLogger = new AuditLogger();
module.exports = auditLogger;
