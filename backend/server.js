const http = require("http");
const https = require("https");
const fs = require("fs");
const app = require("./app");
const env = require("./config/env");
const { pingDatabase } = require("./config/db");

let serverInstance = null;

function gracefulShutdown(err) {
  console.error("FATAL PROCESS ERROR:", err);
  if (serverInstance) {
    serverInstance.close(() => {
      console.error("Server closed due to fatal error. Exiting process.");
      process.exit(1);
    });
    // Force exit if close hangs
    setTimeout(() => process.exit(1), 5000).unref();
  } else {
    process.exit(1);
  }
}

// Process safety handlers — exit non-zero on fatal errors so supervisor/docker can restart cleanly
process.on("uncaughtException", (err) => {
  gracefulShutdown(err);
});

process.on("unhandledRejection", (reason) => {
  gracefulShutdown(reason instanceof Error ? reason : new Error(String(reason)));
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  if (serverInstance) {
    serverInstance.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  if (serverInstance) {
    serverInstance.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

async function start() {
  try {
    await pingDatabase();
    console.log("MySQL Database connected successfully.");
  } catch (dbErr) {
    if (env.nodeEnv === "production") {
      console.error("[FATAL] Database connection failed in production. Refusing to start:", dbErr.message);
      process.exit(1);
    } else {
      console.warn("Database connection warning (development mode):", dbErr.message);
    }
  }

  const useHttps = process.env.NODE_USE_HTTPS === "true";
  const keyPath = process.env.TLS_KEY_PATH;
  const certPath = process.env.TLS_CERT_PATH;

  if (useHttps && keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    serverInstance = https.createServer(httpsOptions, app).listen(env.port, () => {
      console.log(`Bylot API running with TLS on https://localhost:${env.port}`);
    });
  } else {
    serverInstance = http.createServer(app).listen(env.port, () => {
      console.log(`Bylot API running on http://localhost:${env.port} (Environment: ${env.nodeEnv}, Trust Proxy Hops: ${env.trustProxyHops})`);
    });
  }
}

start().catch((err) => {
  console.error("Failed to start Bylot API", err);
  process.exit(1);
});
