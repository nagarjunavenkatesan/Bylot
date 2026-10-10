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

const KNOWN_DEFAULTS = [
  "secret",
  "default",
  "change_me",
  "replace_with",
  "password",
  "12345678",
  "password123",
  "your_secure_db_password",
  "replace_with_a_long_random_access_secret",
  "replace_with_a_long_random_refresh_secret",
  "replace_with_a_long_random_jwt_secret",
  "bylot_secure_pass_4014",
  "bylot_root_secret_4014"
];

function isKnownDefault(val) {
  if (!val) return true;
  const lower = String(val).toLowerCase();
  return KNOWN_DEFAULTS.some(d => lower.includes(d));
}

if (!isProduction) {
  process.env.DB_HOST = process.env.DB_HOST || "localhost";
  process.env.DB_USER = process.env.DB_USER || "root";
  process.env.DB_NAME = process.env.DB_NAME || "bylot";
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || "";
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_jwt_access_secret_min_32_characters_long_entropy_ok";
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev_jwt_refresh_secret_min_32_characters_long_entropy_ok";
}

if (!process.env.JWT_ACCESS_SECRET && process.env.JWT_SECRET) {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_SECRET;
}

for (const key of required) {
  if (!process.env[key] || process.env[key].trim() === "") {
    throw new Error(`[FATAL] Missing required environment variable: ${key}`);
  }
}

if (isProduction) {
  const accessSec = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "";
  const refreshSec = process.env.JWT_REFRESH_SECRET || "";
  const dbPass = process.env.DB_PASSWORD || "";

  if (accessSec.length < 32 || isKnownDefault(accessSec)) {
    throw new Error("[FATAL] JWT_SECRET must be at least 32 characters and not a known default");
  }
  if (refreshSec.length < 32 || isKnownDefault(refreshSec)) {
    throw new Error("[FATAL] JWT_REFRESH_SECRET is missing, shorter than 32 characters, or equal to a known default");
  }
  if (accessSec === refreshSec) {
    throw new Error("[FATAL] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be identical");
  }
  if (isKnownDefault(dbPass)) {
    throw new Error("[FATAL] DB_PASSWORD is using an insecure or known default password");
  }
  if (!process.env.SKIP_SMTP_CHECK && (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    throw new Error("[FATAL] SMTP configuration is required in production (SMTP_HOST, SMTP_USER, SMTP_PASS must be set). Set SKIP_SMTP_CHECK=true in .env if testing or hosting without mail service.");
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
  if (corsOrigins.length === 0) {
    throw new Error("[FATAL] CORS_ORIGINS is empty in production. Production must fail closed.");
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS !== undefined ? process.env.TRUST_PROXY_HOPS : 1),
  cookieSameSite: (process.env.COOKIE_SAMESITE || "strict").toLowerCase(),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
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
  adminEmail: process.env.ADMIN_EMAIL || ""
};
