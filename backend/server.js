const https = require("https");
const fs = require("fs");
const path = require("path");
const app = require("./app");
const env = require("./config/env");
const { pingDatabase } = require("./config/db");

// Process safety handlers — prevent Node server crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('SERVER UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('SERVER UNHANDLED REJECTION:', reason);
});

async function start() {
  try {
    await pingDatabase();
    console.log("MySQL Database connected successfully.");
  } catch (dbErr) {
    console.warn("Database connection warning (running in mock/standalone mode if DB is offline):", dbErr.message);
  }

  const certDir = path.join(__dirname, "certs");
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    https.createServer(httpsOptions, app).listen(env.port, () => {
      console.log(`Bylot API running on https://localhost:${env.port}`);
    });
  } else {
    app.listen(env.port, () => {
      console.log(`Bylot API running on http://localhost:${env.port}`);
    });
  }
}

start().catch((err) => {
  console.error("Failed to start Bylot API", err);
  process.exit(1);
});
