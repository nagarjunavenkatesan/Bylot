const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const env = require("../config/env");
const auditLogger = require("../security/auditLogger");
const accountLockout = require("../security/accountLockout");
const tokenBlacklist = require("../security/tokenBlacklist");
const { authenticate, authorize } = require("../middleware/authMiddleware");

// CRITICAL SECURITY: Protect ALL /mcp routes (including manifest) with Admin authentication
router.use(authenticate, authorize("admin"));

// GET /mcp/manifest - MCP Capability Description (Admin Only)
router.get("/manifest", (req, res) => {
  res.json({
    success: true,
    data: {
      name: "bylot-mcp-server",
      version: "1.0.0",
      description: "Bylot Web App Model Context Protocol (MCP) HTTP Endpoint",
      capabilities: ["tools", "resources", "prompts"],
      tools: [
        "bylot_system_status",
        "bylot_security_audit",
        "bylot_security_action",
        "bylot_database_analytics"
      ],
      resources: [
        "bylot://security/report",
        "bylot://system/health",
        "bylot://analytics/digest"
      ]
    }
  });
});

// POST /mcp/tools/:toolName - Call MCP tool over HTTP (Admin Only)
router.post("/tools/:toolName", async (req, res) => {
  const { toolName } = req.params;
  const args = req.body || {};

  try {
    switch (toolName) {
      case "bylot_system_status": {
        let dbStatus = "ONLINE";
        try {
          await pool.query("SELECT 1");
        } catch {
          dbStatus = "OFFLINE";
        }
        return res.json({
          success: true,
          tool: toolName,
          result: {
            appName: "Bylot Marketplace API",
            environment: env.nodeEnv,
            uptimeSeconds: Math.floor(process.uptime()),
            dbStatus,
            port: env.port,
            timestamp: new Date().toISOString()
          }
        });
      }

      case "bylot_security_audit": {
        const safeLimit = Math.min(Math.max(1, Number(args.limit) || 20), 100);
        const auditStats = auditLogger.getStats();
        const logs = auditLogger.getRecentLogs(safeLimit, null, args.minSeverity || null);
        const lockouts = accountLockout.getLockoutStats();
        const revoked = tokenBlacklist.getStats();

        return res.json({
          success: true,
          tool: toolName,
          result: {
            summary: "Bylot Live Security Audit Report",
            securityPosture: auditStats.severityBreakdown.CRITICAL > 0 ? "ELEVATED THREAT" : "OPTIMAL",
            auditStats,
            activeLockouts: lockouts,
            revokedTokens: revoked,
            recentSecurityEvents: logs
          }
        });
      }

      case "bylot_security_action": {
        if (args.action === "clear_lockout") {
          const email = args.email || args.identifier;
          const ip = args.ip;
          if (!email && !ip) {
            return res.status(400).json({ success: false, message: "Email or IP required." });
          }
          accountLockout.clearLockout(email || "", ip || "");
          return res.json({ success: true, message: `Lockout cleared for ${email || ip}` });
        }
        return res.status(400).json({ success: false, message: "Invalid action." });
      }

      case "bylot_database_analytics": {
        const [[userCount]] = await pool.query("SELECT COUNT(*) as total FROM users");
        const [[productCount]] = await pool.query("SELECT COUNT(*) as total FROM products");
        const [[orderCount]] = await pool.query("SELECT COUNT(*) as total FROM orders");

        return res.json({
          success: true,
          tool: toolName,
          result: {
            totalUsers: userCount.total,
            totalProducts: productCount.total,
            totalOrders: orderCount.total,
            timestamp: new Date().toISOString()
          }
        });
      }

      default:
        return res.status(404).json({ success: false, message: `Tool '${toolName}' not found.` });
    }
  } catch (err) {
    console.error("[MCP Error]:", err.message);
    res.status(500).json({ success: false, message: "MCP tool execution failed." });
  }
});

module.exports = router;
