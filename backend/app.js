const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const env = require("./config/env");
const { pool } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { trafficMonitor } = require("./middleware/trafficMonitor");
const { inputSanitizerMiddleware } = require("./security/inputSanitizer");
const { authLimiter, publicGetLimiter, writeLimiter } = require("./middleware/rateLimitMiddleware");
const validate = require("./middleware/validateMiddleware");
const authValidators = require("./validators/authValidators");
const authController = require("./controllers/authController");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const orderRoutes = require("./routes/orderRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const securityRoutes = require("./routes/securityRoutes");
const mcpRoutes = require("./routes/mcpRoutes");

const cookieParser = require("cookie-parser");

const app = express();

app.disable("x-powered-by");
// Trust proxy configured for 2 hops (outer nginx + container frontend nginx)
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 2);
app.set("trust proxy", trustProxyHops);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["https://accounts.google.com"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  xFrameOptions: { action: "deny" },
  xContentTypeOptions: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (env.nodeEnv !== "production" && isLocalDevOrigin(origin)) {
      return callback(null, true);
    }
    const err = new Error(`Origin not allowed by CORS: ${origin}`);
    err.status = 403;
    return callback(err);
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "x-api-key"]
}));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());
app.use(inputSanitizerMiddleware);
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// Lightweight traffic monitor
app.use(trafficMonitor);

// HTTP Compression (gzip / deflate) for API and asset responses
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  }
}));

// Uploads static directory - static files served with security headers and caching
app.use("/uploads", (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  next();
}, express.static(path.resolve(process.cwd(), env.uploadDir), {
  maxAge: "7d",
  etag: true,
  dotfiles: "deny"
}));

// Health check endpoints - /health verifies process and DB health
app.get("/health", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.ping();
      res.json({
        success: true,
        message: "Bylot API and Database are healthy",
        data: {
          uptime: Math.floor(process.uptime()),
          environment: env.nodeEnv,
          database: "connected",
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      connection.release();
    }
  } catch {
    res.status(503).json({
      success: false,
      message: "Database connection unavailable",
      data: {
        uptime: Math.floor(process.uptime()),
        environment: env.nodeEnv,
        database: "disconnected",
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get("/health/db", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.ping();
      res.json({
        success: true,
        message: "Database connection healthy",
        data: { status: "up" }
      });
    } finally {
      connection.release();
    }
  } catch {
    res.status(503).json({
      success: false,
      message: "Database connection unavailable",
      data: { status: "down" }
    });
  }
});

// Per-IP rate limiting on API: generous for GET, stricter for writes
app.use("/api", (req, res, next) => {
  if (req.method === "GET") {
    return publicGetLimiter(req, res, next);
  }
  return writeLimiter(req, res, next);
});

// Public config endpoint - safe, non-blocking, returns only safe public keys
app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    success: true,
    data: {
      googleClientId: env.googleClientId || ""
    }
  });
});

// Direct authentication aliases for frontend compatibility
app.post("/api/register", authLimiter, authValidators.register, validate, authController.register);
app.post("/api/login", authLimiter, authValidators.login, validate, authController.login);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/items", productRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/security", securityRoutes);
app.use("/mcp", mcpRoutes);

// Serve built React frontend in production with caching
const frontendDist = path.resolve(__dirname, "..", "bylot", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    maxAge: "1d",
    etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/health") ||
      req.path.startsWith("/mcp") ||
      req.path.includes("/.") ||
      req.path.endsWith(".env") ||
      req.path.endsWith(".key") ||
      req.path.endsWith(".pem")
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
