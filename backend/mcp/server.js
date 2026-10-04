#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");

const { pool } = require("../config/db");
const env = require("../config/env");
const auditLogger = require("../security/auditLogger");
const accountLockout = require("../security/accountLockout");
const tokenBlacklist = require("../security/tokenBlacklist");
const runSecurityAudit = require("../scripts/securityAudit");

const server = new Server(
  {
    name: "bylot-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);

// -------------------------------------------------------------
// 1. TOOLS REGISTRATION
// -------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "bylot_system_status",
        description: "Get real-time system status, API health, uptime, environment config, and database connection status.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "bylot_security_audit",
        description: "Run live security posture assessment, inspect audit logs, threat score, active lockouts, and WAF metrics.",
        inputSchema: {
          type: "object",
          properties: {
            minSeverity: { type: "string", description: "Filter logs by minimum severity (INFO, MEDIUM, HIGH, CRITICAL)" },
            limit: { type: "number", description: "Max logs to return (default: 20)" }
          }
        }
      },
      {
        name: "bylot_manage_users",
        description: "Search, inspect, block, or unblock user accounts in Bylot marketplace.",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["list", "search", "block", "unblock"], description: "Action to perform" },
            query: { type: "string", description: "Search query for email or name" },
            userId: { type: "number", description: "User ID for block/unblock action" }
          },
          required: ["action"]
        }
      },
      {
        name: "bylot_manage_products",
        description: "Manage marketplace products: list, search, flag policy violations (near-expiry, fake price), or toggle status.",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["list", "search", "update_status"], description: "Action to perform" },
            query: { type: "string", description: "Keyword search for product" },
            productId: { type: "number", description: "Product ID" },
            status: { type: "string", enum: ["active", "inactive", "out_of_stock"], description: "New status" }
          },
          required: ["action"]
        }
      },
      {
        name: "bylot_manage_orders",
        description: "Query purchase orders, inspect order timelines, and track grand totals.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of orders to retrieve (default: 10)" },
            status: { type: "string", description: "Filter by order status (pending, confirmed, delivered, cancelled)" }
          }
        }
      },
      {
        name: "bylot_security_action",
        description: "Execute security administrative actions: clear account lockout, run full security audit scan.",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["clear_lockout", "run_audit_scan"], description: "Security action" },
            identifier: { type: "string", description: "Email or IP for clear_lockout" }
          },
          required: ["action"]
        }
      },
      {
        name: "bylot_database_analytics",
        description: "Fetch aggregate marketplace metrics: revenue, user count, product distribution, and district analytics.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

// -------------------------------------------------------------
// 2. TOOL CALL HANDLERS
// -------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "bylot_system_status": {
        let dbStatus = "ONLINE";
        try {
          await pool.query("SELECT 1");
        } catch (e) {
          dbStatus = `OFFLINE (${e.message})`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  appName: "Bylot Marketplace API",
                  environment: env.nodeEnv,
                  uptimeSeconds: Math.floor(process.uptime()),
                  dbStatus,
                  port: env.port,
                  apiBaseUrl: env.apiBaseUrl,
                  timestamp: new Date().toISOString()
                },
                null,
                2
              )
            }
          ]
        };
      }

      case "bylot_security_audit": {
        const minSeverity = args?.minSeverity || null;
        const limit = Math.min(Math.max(1, Number(args?.limit) || 20), 100);

        const auditStats = auditLogger.getStats();
        const logs = auditLogger.getRecentLogs(limit, null, minSeverity);
        const lockouts = accountLockout.getLockoutStats();
        const revoked = tokenBlacklist.getStats();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: "Bylot Live Security Audit Report",
                  securityPosture: auditStats.severityBreakdown.CRITICAL > 0 ? "ELEVATED THREAT" : "OPTIMAL",
                  auditStats,
                  activeLockouts: lockouts,
                  revokedTokens: revoked,
                  recentSecurityEvents: logs
                },
                null,
                2
              )
            }
          ]
        };
      }

      case "bylot_manage_users": {
        const { action, query, userId } = args;

        if (action === "list" || action === "search") {
          const limit = Math.min(Math.max(1, Number(args?.limit) || 20), 100);
          let sql = "SELECT id, name, email, phone, role, status, created_at FROM users";
          const params = [];
          if (query) {
            sql += " WHERE email LIKE ? OR name LIKE ?";
            params.push(`%${query}%`, `%${query}%`);
          }
          sql += " ORDER BY id DESC LIMIT ?";
          params.push(limit);

          try {
            const [rows] = await pool.execute(sql, params);
            return {
              content: [{ type: "text", text: JSON.stringify({ count: rows.length, users: rows }, null, 2) }]
            };
          } catch (err) {
            console.error("[MCP Error] manage_users:", err);
            return { content: [{ type: "text", text: JSON.stringify({ error: "An administrative error occurred while processing users." }) }] };
          }
        }

        if (action === "block" || action === "unblock") {
          if (!userId) throw new Error("userId is required for block/unblock action.");
          const newStatus = action === "block" ? "suspended" : "active";
          try {
            await pool.execute("UPDATE users SET status = ? WHERE id = ?", [newStatus, userId]);
            auditLogger.logEvent("ADMIN_ACTION", null, {
              severity: "MEDIUM",
              details: `User ID ${userId} status changed to ${newStatus} via MCP server.`
            });
            return {
              content: [{ type: "text", text: JSON.stringify({ success: true, message: `User ID ${userId} is now ${newStatus}.` }) }]
            };
          } catch (err) {
            console.error("[MCP Error] manage_users block/unblock:", err);
            return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to update user status." }) }] };
          }
        }
        break;
      }

      case "bylot_manage_products": {
        const { action, query, productId, status } = args;

        if (action === "list" || action === "search") {
          const limit = Math.min(Math.max(1, Number(args?.limit) || 20), 100);
          let sql = "SELECT id, name, mrp, selling_price, discount_percent, stock_quantity, status, expiry_date FROM products";
          const params = [];
          if (query) {
            sql += " WHERE name LIKE ?";
            params.push(`%${query}%`);
          }
          sql += " ORDER BY id DESC LIMIT ?";
          params.push(limit);

          try {
            const [rows] = await pool.execute(sql, params);
            return {
              content: [{ type: "text", text: JSON.stringify({ count: rows.length, products: rows }, null, 2) }]
            };
          } catch (err) {
            console.error("[MCP Error] manage_products:", err);
            return { content: [{ type: "text", text: JSON.stringify({ error: "An administrative error occurred while processing products." }) }] };
          }
        }

        if (action === "update_status") {
          if (!productId || !status) throw new Error("productId and status required.");
          try {
            await pool.execute("UPDATE products SET status = ? WHERE id = ?", [status, productId]);
            return {
              content: [{ type: "text", text: JSON.stringify({ success: true, message: `Product ID ${productId} set to ${status}.` }) }]
            };
          } catch (err) {
            console.error("[MCP Error] update_status:", err);
            return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to update product status." }) }] };
          }
        }
        break;
      }

      case "bylot_manage_orders": {
        const limit = Math.min(Math.max(1, Number(args?.limit) || 10), 100);
        const filterStatus = args?.status || null;

        let sql = "SELECT id, order_number, user_id, grand_total, status, created_at FROM orders";
        const params = [];
        if (filterStatus) {
          sql += " WHERE status = ?";
          params.push(filterStatus);
        }
        sql += " ORDER BY id DESC LIMIT ?";
        params.push(limit);

        try {
          const [rows] = await pool.execute(sql, params);
          return {
            content: [{ type: "text", text: JSON.stringify({ count: rows.length, orders: rows }, null, 2) }]
          };
        } catch (err) {
          console.error("[MCP Error] manage_orders:", err);
          return { content: [{ type: "text", text: JSON.stringify({ error: "An administrative error occurred while processing orders." }) }] };
        }
      }

      case "bylot_security_action": {
        const { action, identifier } = args;

        if (action === "clear_lockout") {
          accountLockout.clearLockout(identifier || "", identifier || "");
          return {
            content: [{ type: "text", text: JSON.stringify({ success: true, message: `Lockout cleared for ${identifier}` }) }]
          };
        }

        if (action === "run_audit_scan") {
          const scanResults = runSecurityAudit();
          return {
            content: [{ type: "text", text: JSON.stringify(scanResults, null, 2) }]
          };
        }
        break;
      }

      case "bylot_database_analytics": {
        try {
          const [[userCount]] = await pool.query("SELECT COUNT(*) as total FROM users");
          const [[productCount]] = await pool.query("SELECT COUNT(*) as total FROM products");
          const [[orderCount]] = await pool.query("SELECT COUNT(*) as total FROM orders");

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    totalUsers: userCount.total,
                    totalProducts: productCount.total,
                    totalOrders: orderCount.total,
                    timestamp: new Date().toISOString()
                  },
                  null,
                  2
                )
              }
            ]
          };
        } catch (err) {
          console.error("[MCP Error] database_analytics:", err);
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch database analytics." }) }]
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[MCP Tool Fatal Error] ${name}:`, error);
    return {
      content: [{ type: "text", text: `Error executing ${name}: An internal administrative error occurred.` }],
      isError: true
    };
  }
});

// -------------------------------------------------------------
// 3. RESOURCES REGISTRATION
// -------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "bylot://security/report",
        name: "Bylot Live Security Audit Report",
        mimeType: "application/json",
        description: "Real-time threat status, security events log, and lockout metrics."
      },
      {
        uri: "bylot://system/health",
        name: "Bylot Infrastructure Health",
        mimeType: "application/json",
        description: "API Uptime, Database Ping, Memory & Environment configuration."
      },
      {
        uri: "bylot://analytics/digest",
        name: "Bylot Marketplace Analytics Digest",
        mimeType: "application/json",
        description: "Aggregate summary of users, products, orders, and sales."
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "bylot://security/report") {
    const data = {
      securityStats: auditLogger.getStats(),
      recentEvents: auditLogger.getRecentLogs(30),
      lockouts: accountLockout.getLockoutStats()
    };
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }]
    };
  }

  if (uri === "bylot://system/health") {
    const data = {
      name: "Bylot API",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeEnv: env.nodeEnv
    };
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }]
    };
  }

  throw new Error(`Resource not found: ${uri}`);
});

// -------------------------------------------------------------
// 4. PROMPTS REGISTRATION
// -------------------------------------------------------------

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "security_threat_analysis",
        description: "Prompt template to analyze active platform threats and recommend hardening steps.",
        arguments: []
      },
      {
        name: "marketplace_health_check",
        description: "Prompt template to assess marketplace performance and product compliance.",
        arguments: []
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  if (name === "security_threat_analysis") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Please inspect the Bylot security report using `bylot_security_audit` and `bylot://security/report`. Identify any brute-force attacks, blocked IPs, or suspicious SQLi/XSS events, and provide actionable security mitigations."
          }
        }
      ]
    };
  }

  if (name === "marketplace_health_check") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Evaluate the overall health of the Bylot marketplace. Use `bylot_database_analytics`, `bylot_manage_products`, and `bylot_system_status` to summarize user activity, pending orders, and inventory policy compliance."
          }
        }
      ]
    };
  }

  throw new Error(`Prompt not found: ${name}`);
});

// -------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bylot MCP Server running on stdio transport.");
}

main().catch((err) => {
  console.error("Fatal error starting Bylot MCP Server:", err);
  process.exit(1);
});
