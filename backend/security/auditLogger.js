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
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
      }
    } catch (err) {
      console.warn("[AuditLogger] Failed to initialize file logger:", err.message);
    }
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
      details: metadata.details || "",
      extra: metadata.extra || {}
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
      case "CSRF_MISMATCH":
      case "RATE_LIMIT_EXCEEDED":
      case "TOKEN_REVOKED_USAGE":
      case "SUSPICIOUS_PAYLOAD":
        return "HIGH";
      case "ACCOUNT_LOCKED":
      case "IP_BLOCKED":
        return "MEDIUM";
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
