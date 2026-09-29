const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/authMiddleware");
const auditLogger = require("../security/auditLogger");
const accountLockout = require("../security/accountLockout");
const tokenBlacklist = require("../security/tokenBlacklist");
const { generateCsrfToken } = require("../security/cryptoUtil");

// Public CSRF handshake token generator
router.get("/csrf-token", (req, res) => {
  const csrfToken = generateCsrfToken();
  res.json({
    success: true,
    data: { csrfToken }
  });
});

// Admin-only Security Dashboard Endpoints
router.use(authenticate, authorize("admin"));

// GET /api/security/status - Get total security posture status
router.get("/status", (req, res) => {
  const stats = auditLogger.getStats();
  const lockouts = accountLockout.getLockoutStats();
  const tokens = tokenBlacklist.getStats();

  res.json({
    success: true,
    data: {
      posture: "SECURE",
      threatLevel: stats.severityBreakdown.CRITICAL > 0 ? "ELEVATED" : "NORMAL",
      auditStats: stats,
      activeLockouts: lockouts,
      revokedTokens: tokens,
      timestamp: new Date().toISOString()
    }
  });
});

// GET /api/security/events - Fetch recent security events
router.get("/events", (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const filterType = req.query.type || null;
  const minSeverity = req.query.severity || null;

  const logs = auditLogger.getRecentLogs(limit, filterType, minSeverity);
  res.json({
    success: true,
    data: {
      count: logs.length,
      logs
    }
  });
});

// POST /api/security/clear-lockout - Manually unlock an identity
router.post("/clear-lockout", (req, res) => {
  const { identifier, ip } = req.body;
  if (!identifier && !ip) {
    return res.status(400).json({ success: false, message: "Identifier or IP required." });
  }

  accountLockout.clearLockout(identifier || "", ip || "");
  auditLogger.logEvent("ADMIN_ACTION", req, {
    severity: "INFO",
    details: `Admin unlocked identity: ${identifier || ip}`
  });

  res.json({
    success: true,
    message: `Lockout cleared for ${identifier || ip}.`
  });
});

module.exports = router;
