const crypto = require("crypto");
const auditLogger = require("./auditLogger");

const activeCsrfTokens = new Map(); // token -> timestamp

function generateCsrfToken() {
  const token = crypto.randomBytes(24).toString("hex");
  activeCsrfTokens.set(token, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}

function csrfProtection(req, res, next) {
  // Safe HTTP methods do not mutate state
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Exempt public auth & webhook endpoints if needed
  const exemptPaths = [
    "/health",
    "/api/config",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/google-login",
    "/api/auth/refresh-token",
    "/api/admin/login",
    "/mcp"
  ];

  if (exemptPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // Check CSRF token or Handshake token header
  const tokenFromHeader = req.headers["x-csrf-token"] || req.headers["x-bylot-handshake"];
  
  if (!tokenFromHeader || typeof tokenFromHeader !== "string" || tokenFromHeader.length < 8) {
    auditLogger.logEvent("CSRF_MISMATCH", req, {
      severity: "HIGH",
      details: `Missing or invalid CSRF/Handshake token on ${req.method} ${req.path}`
    });
    return res.status(403).json({
      success: false,
      message: "Security verification failed: Missing valid security token."
    });
  }

  next();
}

module.exports = {
  generateCsrfToken,
  csrfProtection
};
