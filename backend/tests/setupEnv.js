// backend/tests/setupEnv.js
// Executed by Jest before any test module is loaded

if (process.env.NODE_ENV === "production") {
  console.error("\n[TEST ERROR] Tests cannot be executed with NODE_ENV=production. Aborting to protect production.");
  process.exit(1);
}

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

process.env.NODE_ENV = "test";
if (!process.env.DB_PASSWORD) {
  console.error("\n[TEST ERROR] DB_PASSWORD environment variable is required for tests. Aborting.");
  process.exit(1);
}
process.env.DB_NAME = process.env.DB_NAME || "bylot_test";

if (!process.env.DB_NAME.endsWith("_test")) {
  console.error(`\n[TEST ERROR] Tests must use a dedicated database ending in '_test'. Current DB_NAME="${process.env.DB_NAME}". Aborting.`);
  process.exit(1);
}
