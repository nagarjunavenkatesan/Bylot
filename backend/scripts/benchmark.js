/**
 * HTTP benchmark against a running API (default http://127.0.0.1:5000).
 * Usage: node scripts/benchmark.js [--base=http://127.0.0.1:5000]
 */
require("dotenv").config();
const http = require("http");
const https = require("https");
const { URL } = require("url");
const mysql = require("mysql2/promise");

const SAMPLES = Number(process.env.BENCHMARK_SAMPLES || 30);
const WARMUP = 3;

const BASELINE = {
  "default list": 535,
  discounts: 703,
  "sort expiry": 489,
  "sort price": 463,
  "search name": 322,
  "near-expiry": 246,
  category: 124,
  "deep page (cursor)": 475,
  nearby: 400
};

function parseArgs() {
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  return { base: baseArg ? baseArg.split("=")[1] : process.env.BENCHMARK_BASE || "http://127.0.0.1:5000" };
}

function requestMs(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === "https:" ? https : http;
    const start = process.hrtime.bigint();
    const req = lib.request(
      url,
      { method: "GET", headers: { Accept: "application/json" } },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          const ms = Number(process.hrtime.bigint() - start) / 1e6;
          if (res.statusCode >= 400) reject(new Error(`${url.pathname} HTTP ${res.statusCode}`));
          else resolve(ms);
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error("timeout"));
    });
    req.end();
  });
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function benchEndpoint(name, path) {
  for (let i = 0; i < WARMUP; i++) {
    await requestMs(path);
  }
  const times = [];
  for (let i = 0; i < SAMPLES; i++) {
    times.push(await requestMs(path));
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = percentile(times, 95);
  return { name, median, p95, times };
}

async function explainQuery(conn, label, sql, params) {
  const [rows] = await conn.execute(`EXPLAIN ${sql}`, params);
  const bad = rows.some(
    (r) =>
      (r.type === "ALL" && !String(r.key).includes("ft")) ||
      (r.Extra && String(r.Extra).includes("Using filesort") && !label.includes("search"))
  );
  return { label, rows, bad };
}

async function main() {
  const { base } = parseArgs();
  const password = process.env.DB_PASSWORD;
  const benchmarkDb = process.env.BENCHMARK_DB || "bylot_benchmark";

  let deepCursor = "";
  if (password) {
    try {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password,
        database: benchmarkDb
      });
      const [[row]] = await conn.execute(
        "SELECT id FROM products WHERE status = 'active' ORDER BY id DESC LIMIT 1 OFFSET 50000"
      );
      if (row) deepCursor = String(row.id);
      await conn.end();
    } catch {
      deepCursor = "50000";
    }
  }

  const endpoints = [
    ["default list", `${base}/api/products?limit=20`],
    ["discounts", `${base}/api/products/discounts?limit=20`],
    ["near-expiry", `${base}/api/products/near-expiry?limit=20`],
    ["sort expiry", `${base}/api/products?sort=expiry_asc&limit=20`],
    ["sort price", `${base}/api/products?sort=price_asc&limit=20`],
    ["search name", `${base}/api/products/search?q=Benchmark&limit=20`],
    ["category", `${base}/api/products?categoryId=1&limit=20`],
    ["nearby", `${base}/api/products/nearby?lat=13.08&lng=80.27&radiusKm=25&limit=20`],
    ["deep page (cursor)", `${base}/api/products?limit=20&cursor=${deepCursor || "1"}`]
  ];

  console.log(`Benchmark base: ${base} (${SAMPLES} samples after ${WARMUP} warmup)\n`);
  const results = [];
  for (const [name, url] of endpoints) {
    try {
      const r = await benchEndpoint(name, url);
      results.push(r);
      console.log(`${name}: median ${r.median.toFixed(1)} ms, p95 ${r.p95.toFixed(1)} ms`);
    } catch (err) {
      console.log(`${name}: FAILED (${err.message})`);
      results.push({ name, median: NaN, p95: NaN });
    }
  }

  console.log("\n| Endpoint | Baseline (ms) | Median (ms) | p95 (ms) |");
  console.log("|----------|---------------|-------------|----------|");
  for (const r of results) {
    const baseMs = BASELINE[r.name] ?? "—";
    console.log(
      `| ${r.name} | ${baseMs} | ${Number.isFinite(r.median) ? r.median.toFixed(1) : "ERR"} | ${Number.isFinite(r.p95) ? r.p95.toFixed(1) : "ERR"} |`
    );
  }

  if (password) {
    console.log("\nEXPLAIN checks (benchmark DB):");
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password,
      database: benchmarkDb
    });
    const explains = await Promise.all([
      explainQuery(
        conn,
        "default list",
        `SELECT p.id FROM products p JOIN sellers s ON s.id = p.seller_id JOIN users u ON u.id = s.user_id WHERE p.status = 'active' AND s.approval_status = 'approved' ORDER BY p.created_at DESC LIMIT 20`,
        []
      ),
      explainQuery(
        conn,
        "discounts",
        `SELECT p.id FROM products p WHERE p.status = 'active' AND p.discount_percent > 0 ORDER BY p.discount_percent DESC LIMIT 20`,
        []
      )
    ]);
    for (const ex of explains) {
      console.log(`\n${ex.label}: filesort/full scan flagged = ${ex.bad}`);
      console.table(ex.rows.map((r) => ({ type: r.type, key: r.key, rows: r.rows, Extra: r.Extra })));
    }
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
