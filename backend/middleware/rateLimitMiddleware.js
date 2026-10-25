const rateLimit = require("express-rate-limit");
const isTestEnv = process.env.NODE_ENV === "test";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later."
  }
});

const publicGetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500, // Generous limit for public GET requests
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down."
  }
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150, // Stricter limit for POST/PUT/PATCH/DELETE writes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down."
  }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Upload limit exceeded. Please wait before uploading more images."
  }
});

const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 1000 : 30, // 30 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Please try again later."
  }
});

module.exports = {
  authLimiter,
  twoFactorLimiter,
  publicGetLimiter,
  writeLimiter,
  uploadLimiter,
  apiLimiter: writeLimiter
};
