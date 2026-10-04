const AppError = require("../utils/AppError");
const env = require("../config/env");

function cookieCsrfProtection(req, res, next) {
  // 1. Require custom header X-Requested-With: bylot
  const reqWith = req.headers["x-requested-with"];
  if (!reqWith || reqWith.toLowerCase() !== "bylot") {
    return next(new AppError("Cross-Site Request Forgery blocked: Missing or invalid X-Requested-With header", 403));
  }

  // 2. Validate Origin or Referer against allowed origin list
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const sourceUrl = originHeader || refererHeader;

  // In test environment, allow if origin is not provided or matches test domain
  if (!sourceUrl && env.nodeEnv === "test") {
    return next();
  }

  if (!sourceUrl) {
    return next(new AppError("Cross-Site Request Forgery blocked: Missing origin or referer header", 403));
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(sourceUrl).origin;
  } catch {
    return next(new AppError("Cross-Site Request Forgery blocked: Malformed origin/referer header", 403));
  }

  const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+|192\.168\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+)(:\d+)?$/i.test(parsedOrigin);
  const isAllowed = env.corsOrigins.includes(parsedOrigin) || (env.nodeEnv !== "production" && isLocalDev);

  if (!isAllowed) {
    return next(new AppError("Cross-Site Request Forgery blocked: Origin not authorized", 403));
  }

  next();
}

module.exports = {
  cookieCsrfProtection
};
