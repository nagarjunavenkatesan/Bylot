const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/authMiddleware");
const auditLogger = require("../security/auditLogger");
const accountLockout = require("../security/accountLockout");
const tokenBlacklist = require("../security/tokenBlacklist");

// All Security Dashboard Endpoints require Admin Authentication
router.use(authenticate, authorize("admin"));

// GET /api/security/status - Get security metrics
router.get("/status", (req, res) => {
  const stats = auditLogger.getStats();
  const lockouts = accountLockout.getLockoutStats();
  const tokens = tokenBlacklist.getStats();

  res.json({
    success: true,
    data: {
      posture: stats.severityBreakdown.CRITICAL > 0 ? "ATTENTION_REQUIRED" : "NORMAL",
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
  const limit = Math.min(Math.max(1, Number(req.query.limit || 50)), 200);
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

// POST /api/security/clear-lockout - Manually unlock an identity (by email or IP)
router.post("/clear-lockout", (req, res) => {
  const { identifier, email, ip } = req.body;
  const targetEmail = identifier || email;
  const targetIp = ip;

  if (!targetEmail && !targetIp) {
    return res.status(400).json({ success: false, message: "Email or IP address is required." });
  }

  accountLockout.clearLockout(targetEmail || "", targetIp || "");
  auditLogger.logEvent("ADMIN_ACTION", req, {
    severity: "INFO",
    details: `Admin unlocked identity: email=${targetEmail || "none"}, ip=${targetIp || "none"}`
  });

  res.json({
    success: true,
    message: `Lockout cleared for ${targetEmail || targetIp}.`
  });
});

module.exports = router;
