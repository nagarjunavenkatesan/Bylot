require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const required = [
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET"
];

if (isProduction) {
  required.push("DB_PASSWORD");
}

for (const key of required) {
  if (!process.env[key] || process.env[key].trim() === "") {
    throw new Error(`[FATAL] Missing required environment variable: ${key}`);
  }
}

if (isProduction) {
  const accessSec = process.env.JWT_ACCESS_SECRET;
  const refreshSec = process.env.JWT_REFRESH_SECRET;
  if (accessSec.length < 32 || accessSec.includes("change_me") || accessSec.includes("replace_with")) {
    throw new Error("[FATAL] JWT_ACCESS_SECRET is too weak or using default placeholder for production (must be at least 32 characters)");
  }
  if (refreshSec.length < 32 || refreshSec.includes("change_me") || refreshSec.includes("replace_with")) {
    throw new Error("[FATAL] JWT_REFRESH_SECRET is too weak or using default placeholder for production (must be at least 32 characters)");
  }
  if (accessSec === refreshSec) {
    throw new Error("[FATAL] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be identical");
  }
}

const rawCors = [
  ...(process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()),
  ...(process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : [])
].filter(Boolean);

// Unique origins
let corsOrigins = Array.from(new Set(rawCors));
if (isProduction) {
  // Disallow localhost and private IP addresses in production CORS
  corsOrigins = corsOrigins.filter(o => !/^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+|192\.168\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+)(:\d+)?$/i.test(o));
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d"
  },
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  corsOrigins,
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || "Bylot <no-reply@bylot.in>"
  },
  adminEmail: process.env.ADMIN_EMAIL || "",
  payment: {
    provider: process.env.PAYMENT_PROVIDER || "manual",
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || ""
  }
};
