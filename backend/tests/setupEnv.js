// backend/tests/setupEnv.js
// Executed by Jest before any test module is loaded

if (process.env.NODE_ENV === "production") {
  console.error("\n[TEST ERROR] Tests cannot be executed with NODE_ENV=production. Aborting to protect production.");
  process.exit(1);
}

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "4014";
process.env.DB_NAME = process.env.DB_NAME || "bylot_test";

if (!process.env.DB_NAME.endsWith("_test")) {
  console.error(`\n[TEST ERROR] Tests must use a dedicated database ending in '_test'. Current DB_NAME="${process.env.DB_NAME}". Aborting.`);
  process.exit(1);
}
