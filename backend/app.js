const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const env = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { ghostField, sigil, handshake, mirage, mirror, threshold, blocklist } = require("./middleware/strangeFirewall");
const { trafficMonitor } = require("./middleware/trafficMonitor");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const orderRoutes = require("./routes/orderRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const securityRoutes = require("./routes/securityRoutes");
const mcpRoutes = require("./routes/mcpRoutes");
const { inputSanitizerMiddleware } = require("./security/inputSanitizer");
const { csrfProtection } = require("./security/csrfProtection");

const app = express();

app.set("trust proxy", 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
  xFrameOptions: { action: "deny" },
  xContentTypeOptions: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i.test(origin);
}
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (isLocalDevOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-Bylot-Handshake", "X-CSRF-Token"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(inputSanitizerMiddleware);
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// The Strange Firewall — seven layers of unconventional security
app.use(blocklist);
app.use(ghostField);
app.use(sigil);
app.use(mirage);
app.use(handshake);
app.use(mirror);
app.use(threshold);

// CSRF Protection on mutating routes
app.use(csrfProtection);

// Traffic monitor — auto-detects spikes and protects the site
app.use(trafficMonitor);

// HTTP Compression (gzip / deflate) for API and asset responses
app.use(compression({
  threshold: 1024, // only compress responses above 1KB
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  }
}));

app.use("/uploads", express.static(path.resolve(process.cwd(), env.uploadDir), {
  maxAge: "7d",
  etag: true
}));

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Bylot API is healthy", data: { uptime: process.uptime() } });
});

app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    success: true,
    data: {
      googleClientId: env.googleClientId || ""
    }
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/items", productRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
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
        // Never cache HTML so users always get fresh asset links
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
