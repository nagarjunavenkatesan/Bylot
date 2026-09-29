const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const env = require("../config/env");
const auditLogger = require("../security/auditLogger");
const accountLockout = require("../security/accountLockout");
const tokenBlacklist = require("../security/tokenBlacklist");
const runSecurityAudit = require("../scripts/securityAudit");

// GET /mcp/manifest - MCP Capability Description
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
        "bylot_manage_users",
        "bylot_manage_products",
        "bylot_manage_orders",
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

// POST /mcp/tools/:toolName - Call MCP tool over HTTP
router.post("/tools/:toolName", async (req, res) => {
  const { toolName } = req.params;
  const args = req.body || {};

  try {
    switch (toolName) {
      case "bylot_system_status": {
        let dbStatus = "ONLINE";
        try {
          await pool.query("SELECT 1");
        } catch (e) {
          dbStatus = `OFFLINE (${e.message})`;
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
        const auditStats = auditLogger.getStats();
        const logs = auditLogger.getRecentLogs(args.limit || 20, null, args.minSeverity || null);
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
          accountLockout.clearLockout(args.identifier || "", args.identifier || "");
          return res.json({ success: true, message: `Lockout cleared for ${args.identifier}` });
        }
        if (args.action === "run_audit_scan") {
          const scanResults = runSecurityAudit();
          return res.json({ success: true, result: scanResults });
        }
        return res.status(400).json({ success: false, message: "Invalid action." });
      }

      case "bylot_database_analytics": {
        const [[userCount]] = await pool.query("SELECT COUNT(*) as total FROM users");
        const [[productCount]] = await pool.query("SELECT COUNT(*) as total FROM products");
        const [[orderCount]] = await pool.query("SELECT COUNT(*) as total FROM orders");
        const [[revenueSum]] = await pool.query("SELECT COALESCE(SUM(grand_total), 0) as total FROM orders WHERE payment_status = 'paid'");

        return res.json({
          success: true,
          tool: toolName,
          result: {
            totalUsers: userCount.total,
            totalProducts: productCount.total,
            totalOrders: orderCount.total,
            totalRevenuePaid: revenueSum.total,
            timestamp: new Date().toISOString()
          }
        });
      }

      default:
        return res.status(404).json({ success: false, message: `Tool '${toolName}' not found or requires stdio execution.` });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
