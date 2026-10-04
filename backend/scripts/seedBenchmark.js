/**
 * Seeds a dedicated benchmark database (default: bylot_benchmark) with ~100k products.
 * Usage: BENCHMARK_DB=bylot_benchmark DB_PASSWORD=... node scripts/seedBenchmark.js
 */
require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

const BENCHMARK_DB = process.env.BENCHMARK_DB || "bylot_benchmark";
const TARGET_PRODUCTS = Number(process.env.BENCHMARK_PRODUCT_COUNT || 100000);
const TARGET_SELLERS = Number(process.env.BENCHMARK_SELLER_COUNT || 300);
const BATCH = 500;

async function main() {
  const password = process.env.DB_PASSWORD;
  if (!password) {
    console.error("Set DB_PASSWORD before running seedBenchmark.js");
    process.exit(1);
  }

  const root = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password,
    multipleStatements: true
  });

  await root.query(`DROP DATABASE IF EXISTS \`${BENCHMARK_DB}\``);
  await root.query(`CREATE DATABASE \`${BENCHMARK_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.changeUser({ database: BENCHMARK_DB });

  const fs = require("fs");
  const path = require("path");
  const schema = fs.readFileSync(path.join(__dirname, "../config/schema.sql"), "utf8");
  await root.query(schema);

  const { spawnSync } = require("child_process");
  const migrate = spawnSync(process.execPath, [path.join(__dirname, "migrate.js"), "--db", BENCHMARK_DB], {
    env: { ...process.env, DB_NAME: BENCHMARK_DB },
    encoding: "utf8"
  });
  if (migrate.status !== 0) {
    console.error(migrate.stdout || migrate.stderr);
    process.exit(1);
  }

  const hash = await bcrypt.hash("BenchmarkSellerPass!2026", 10);
  const sellerIds = [];
  for (let i = 0; i < TARGET_SELLERS; i++) {
    const [u] = await root.execute(
      `INSERT INTO users (name, email, password_hash, role, status, email_verified_at, token_version)
       VALUES (?, ?, ?, 'seller', 'active', NOW(), 1)`,
      [`Bench Seller ${i}`, `bench_seller_${i}@benchmark.local`, hash]
    );
    const lat = 13.0 + (i % 50) * 0.01;
    const lng = 80.2 + (i % 50) * 0.01;
    const [s] = await root.execute(
      `INSERT INTO sellers (user_id, business_name, approval_status, status, city, latitude, longitude)
       VALUES (?, ?, 'approved', 'active', 'Chennai', ?, ?)`,
      [u.insertId, `Bench Shop ${i}`, lat, lng]
    );
    sellerIds.push(s.insertId);
  }

  console.log(`Created ${sellerIds.length} sellers. Seeding ${TARGET_PRODUCTS} products…`);

  let inserted = 0;
  while (inserted < TARGET_PRODUCTS) {
    const chunk = Math.min(BATCH, TARGET_PRODUCTS - inserted);
    const values = [];
    const params = [];
    for (let j = 0; j < chunk; j++) {
      const idx = inserted + j;
      const sellerId = sellerIds[idx % sellerIds.length];
      const mrp = 50 + (idx % 200);
      const price = Math.max(10, mrp - (idx % 40));
      const discount = Math.round(((mrp - price) / mrp) * 100);
      const productType =
        idx % 5 === 0 ? "near_expiry" : idx % 7 === 0 ? "discount" : "daily_essential";
      values.push("(?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'active', DATE_ADD(CURDATE(), INTERVAL ? DAY), ?)");
      params.push(
        `BENCH${idx}`,
        sellerId,
        `Benchmark Product ${idx}`,
        `bench-product-${idx}`,
        mrp,
        price,
        discount,
        5 + (idx % 20),
        productType,
        3 + (idx % 30)
      );
    }
    await root.execute(
      `INSERT INTO products (product_item_id, seller_id, category_id, name, slug, mrp, selling_price, discount_percent, stock_quantity, product_type, status, expiry_date)
       VALUES ${values.join(",")}`,
      params
    );
    inserted += chunk;
    if (inserted % 5000 === 0) console.log(`  ${inserted} products…`);
  }

  console.log(`Done. Database ${BENCHMARK_DB} has ${inserted} products.`);
  await root.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
