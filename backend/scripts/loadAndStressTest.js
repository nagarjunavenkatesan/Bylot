const http = require("http");
const { URL } = require("url");
const os = require("os");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Suppress excessive morgan logging during benchmark
process.env.NODE_ENV = "test";
const app = require("../app");

const TEST_PORT = 5055;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function makeRequest(urlStr, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const start = process.hrtime.bigint();
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: {
          Accept: "application/json",
          "X-Forwarded-For": options.clientIp || "203.0.113.1",
          ...(options.headers || {})
        },
        timeout: 10000
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          resolve({
            statusCode: res.statusCode,
            durationMs,
            success: res.statusCode >= 200 && res.statusCode < 400
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({ statusCode: 504, durationMs, success: false, error: "timeout" });
    });

    req.on("error", (err) => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({ statusCode: 500, durationMs, success: false, error: err.message });
    });

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

async function runConcurrentBatch(urls, concurrency, totalRequests) {
  let completed = 0;
  let inFlight = 0;
  let requestIndex = 0;
  const results = [];
  const startGlobal = process.hrtime.bigint();

  return new Promise((resolve) => {
    function launchNext() {
      if (completed >= totalRequests) {
        const totalDurationSec = Number(process.hrtime.bigint() - startGlobal) / 1e9;
        return resolve({ results, totalDurationSec });
      }

      while (inFlight < concurrency && requestIndex < totalRequests) {
        inFlight++;
        const currentReq = requestIndex++;
        const targetUrl = urls[currentReq % urls.length];
        const userId = currentReq % concurrency;
        const clientIp = `198.51.${Math.floor(userId / 250) + 1}.${(userId % 250) + 1}`;

        makeRequest(targetUrl, { clientIp })
          .then((res) => {
            results.push(res);
          })
          .catch((err) => {
            results.push({ statusCode: 500, durationMs: 0, success: false, error: err.message });
          })
          .finally(() => {
            inFlight--;
            completed++;
            launchNext();
          });
      }
    }

    launchNext();
  });
}

function summarizeResults(results, totalDurationSec, concurrency) {
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const statusCodes = {};
  let errorsCount = 0;

  for (const r of results) {
    statusCodes[r.statusCode] = (statusCodes[r.statusCode] || 0) + 1;
    if (r.statusCode >= 500 || !r.statusCode) {
      errorsCount++;
    }
  }

  const min = durations[0] || 0;
  const max = durations[durations.length - 1] || 0;
  const mean = durations.reduce((acc, v) => acc + v, 0) / (durations.length || 1);
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const rps = results.length / totalDurationSec;
  const errorRate = ((errorsCount / results.length) * 100).toFixed(2);

  return {
    concurrency,
    totalRequests: results.length,
    durationSec: totalDurationSec.toFixed(2),
    rps: rps.toFixed(1),
    minMs: min.toFixed(1),
    meanMs: mean.toFixed(1),
    p50Ms: p50.toFixed(1),
    p95Ms: p95.toFixed(1),
    p99Ms: p99.toFixed(1),
    maxMs: max.toFixed(1),
    statusCodes,
    errorRate: `${errorRate}%`,
    errorsCount
  };
}

async function runLoadAndStressSuite() {
  console.log("=================================================");
  console.log("    BYLOT PERFORMANCE, LOAD & STRESS TESTING     ");
  console.log("=================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, "127.0.0.1", resolve));
  console.log(`[INIT] Bylot test API listening on ${BASE_URL}`);

  // Warmup health check
  const healthRes = await makeRequest(`${BASE_URL}/health`, { clientIp: "127.0.0.1" });
  console.log(`[INIT] Health check response: HTTP ${healthRes.statusCode} (${healthRes.durationMs.toFixed(1)}ms)\n`);

  const testUrls = [
    `${BASE_URL}/health`,
    `${BASE_URL}/api/config`,
    `${BASE_URL}/api/categories`,
    `${BASE_URL}/api/products?limit=20`,
    `${BASE_URL}/api/products/search?q=test&limit=10`,
    `${BASE_URL}/robots.txt`,
    `${BASE_URL}/sitemap.xml`
  ];

  // 1. API Performance Measurement (Single User Latency baseline)
  console.log("--- 1. ENDPOINT LATENCY PROFILING (30 SAMPLES EACH) ---");
  const baselineResults = [];
  for (const url of testUrls) {
    const latencies = [];
    const parsedPath = new URL(url).pathname + new URL(url).search;
    for (let i = 0; i < 30; i++) {
      const res = await makeRequest(url, { clientIp: `203.0.113.${i + 1}` });
      latencies.push(res.durationMs);
    }
    latencies.sort((a, b) => a - b);
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);
    baselineResults.push({
      path: parsedPath,
      p50: p50.toFixed(1),
      p95: p95.toFixed(1),
      p99: p99.toFixed(1)
    });
    console.log(`  ${parsedPath.padEnd(35)} p50: ${p50.toFixed(1)}ms | p95: ${p95.toFixed(1)}ms | p99: ${p99.toFixed(1)}ms`);
  }

  // 2. Load Testing Concurrency Levels
  console.log("\n--- 2. CONCURRENT USER LOAD TESTING ---");
  const concurrencyLevels = [
    { users: 10, totalRequests: 100 },
    { users: 50, totalRequests: 250 },
    { users: 100, totalRequests: 500 },
    { users: 250, totalRequests: 1000 },
    { users: 500, totalRequests: 1500 }
  ];

  const loadSummaryTable = [];
  for (const lvl of concurrencyLevels) {
    const { results, totalDurationSec } = await runConcurrentBatch(testUrls, lvl.users, lvl.totalRequests);
    const summary = summarizeResults(results, totalDurationSec, lvl.users);
    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    summary.heapUsedMb = `${memAfter.toFixed(1)}MB`;

    loadSummaryTable.push(summary);
    console.log(
      `  Users: ${String(lvl.users).padEnd(4)} | RPS: ${summary.rps.padEnd(7)} | p50: ${summary.p50Ms.padEnd(6)}ms | p95: ${summary.p95Ms.padEnd(7)}ms | p99: ${summary.p99Ms.padEnd(7)}ms | 5xx Err: ${summary.errorRate}`
    );
  }

  // 3. Stress Test (Saturation Point Detection)
  console.log("\n--- 3. STRESS TEST (MAX CAPACITY EVALUATION) ---");
  const stressLevels = [600, 750, 1000];
  let maxStableRps = loadSummaryTable[loadSummaryTable.length - 1].rps;
  let maxStableUsers = 500;

  for (const users of stressLevels) {
    const totalRequests = users * 2;
    const { results, totalDurationSec } = await runConcurrentBatch(testUrls, users, totalRequests);
    const summary = summarizeResults(results, totalDurationSec, users);

    const isStable = parseFloat(summary.errorRate) < 1.0 && parseFloat(summary.p95Ms) < 1500;
    console.log(
      `  Stress Users: ${String(users).padEnd(4)} | RPS: ${summary.rps.padEnd(7)} | p95: ${summary.p95Ms.padEnd(7)}ms | 5xx Err: ${summary.errorRate} | Status: ${isStable ? "STABLE" : "DEGRADED/SATURATED"}`
    );
    if (isStable) {
      maxStableRps = summary.rps;
      maxStableUsers = users;
    } else {
      break;
    }
  }

  // Final cleanup
  await new Promise((resolve) => server.close(resolve));
  console.log(`\n[CLEANUP] Test API server shut down gracefully.`);

  console.log("\n=================================================");
  console.log("   ✅ LOAD & STRESS TEST COMPLETED SUCCESSFULLY   ");
  console.log("=================================================\n");

  return {
    baselineResults,
    loadSummaryTable,
    maxStableCapacity: {
      concurrentUsers: maxStableUsers,
      maxRps: maxStableRps,
      systemCores: os.cpus().length,
      totalMemoryMb: (os.totalmem() / 1024 / 1024).toFixed(0)
    }
  };
}

if (require.main === module) {
  runLoadAndStressSuite()
    .then((report) => {
      console.log("Load Test Report:", JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ LOAD TEST FAILED:", err);
      process.exit(1);
    });
}

module.exports = runLoadAndStressSuite;
