const app = require("./app");
const env = require("./config/env");
const { pingDatabase } = require("./config/db");

async function start() {
  await pingDatabase();
  app.listen(env.port, () => {
    console.log(`Bylot API running on port ${env.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start Bylot API", err);
  process.exit(1);
});
