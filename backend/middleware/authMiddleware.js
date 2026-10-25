const { pool } = require("../config/db");
const AppError = require("../utils/AppError");
const { verifyAccessToken } = require("../utils/token");
const tokenBlacklist = require("../security/tokenBlacklist");

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new AppError("Please sign in to continue.", 401);
    }

    if (await tokenBlacklist.isBlacklistedAsync(token)) {
      throw new AppError("Session revoked. Please sign in again.", 401);
    }

    const payload = verifyAccessToken(token);
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone, role, profile_image, status, token_version FROM users WHERE id = ? LIMIT 1",
      [payload.sub]
    );

    const user = rows[0];
    if (!user || user.status !== "active") {
      throw new AppError("Your account is not active. Please contact support.", 401);
    }

    const tokenVersionInPayload = payload.token_version !== undefined ? payload.token_version : payload.tokenVersion;
    if (tokenVersionInPayload !== undefined && user.token_version !== undefined && tokenVersionInPayload !== user.token_version) {
      throw new AppError("Session revoked. Please sign in again.", 401);
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err.name === "JsonWebTokenError" || err.name === "TokenExpiredError"
      ? new AppError("Session expired. Please sign in again.", 401)
      : err);
  }
}

function authorize(...roles) {
  return async (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission for this action.", 403));
    }
    // Mandatory Admin 2FA check: administrators cannot access admin business routes without active 2FA
    // Allow self-service 2FA status and enrollment endpoints
    const isSelf2faEndpoint = req.baseUrl === "/api/admin" && (req.path === "/2fa/status" || req.path === "/2fa/setup");
    if (!isSelf2faEndpoint && roles.includes("admin") && req.user.role === "admin") {
      try {
        const [rows] = await pool.execute(
          "SELECT enabled FROM admin_2fa WHERE admin_user_id = ? LIMIT 1",
          [req.user.id]
        );
        if (!rows[0] || !rows[0].enabled) {
          return next(new AppError("Administrator two-step authentication is mandatory. Please complete 2FA setup.", 403));
        }
      } catch (err) {
        return next(err);
      }
    }
    return next();
  };
}

module.exports = {
  authenticate,
  authorize
};
