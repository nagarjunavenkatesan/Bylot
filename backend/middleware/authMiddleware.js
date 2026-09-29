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

    if (tokenBlacklist.isBlacklisted(token)) {
      throw new AppError("Session revoked. Please sign in again.", 401);
    }

    const payload = verifyAccessToken(token);
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone, role, profile_image, status FROM users WHERE id = ? LIMIT 1",
      [payload.sub]
    );

    const user = rows[0];
    if (!user || user.status !== "active") {
      throw new AppError("Your account is not active. Please contact support.", 401);
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
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission for this action.", 403));
    }
    return next();
  };
}

module.exports = {
  authenticate,
  authorize
};
