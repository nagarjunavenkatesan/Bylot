const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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

module.exports = {
  authLimiter,
  publicGetLimiter,
  writeLimiter,
  uploadLimiter,
  apiLimiter: writeLimiter
};
