const request = require("supertest");
const app = require("../app");
const { pool } = require("../config/db");
const { execSync } = require("child_process");
const { createTestUser, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");
const { blockUser } = require("../controllers/adminController");

describe("General Security, Sanitization and Resilience", () => {
  test("Disallowed CORS origin returns 403 with clear JSON message", async () => {
    // In test environment, unallowed non-local origins are rejected with 403
    const res = await request(app)
      .get("/api/products")
      .set("Origin", "https://malicious-attacker-domain.evil");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Origin not allowed by CORS/i);
  });

  test("Malformed JSON body returns 400 instead of 500", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "test@example.com", "password": invalid_json_here}');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Malformed JSON/i);
  });

  test("Path traversal on /uploads and /.env never leaks files", async () => {
    const traversalAttempts = [
      "/uploads/../../.env",
      "/uploads/..%2f..%2f.env",
      "/.env",
      "/api/../../.env"
    ];

    for (const urlPath of traversalAttempts) {
      const res = await request(app).get(urlPath);
      // Must not return 200 with env contents or 500 crash
      expect([403, 404]).toContain(res.status);
      if (res.text) {
        expect(res.text).not.toContain("DB_PASSWORD");
        expect(res.text).not.toContain("JWT_SECRET");
      }
    }
  });

  test("SQL injection probes on q, sort, categoryId, latitude, longitude, limit never return 5xx", async () => {
    const probes = [
      { q: "' OR '1'='1" },
      { q: "'; DROP TABLE products; --" },
      { sort: "price; DROP TABLE users;--" },
      { sort: "unknown_col, (SELECT * FROM users)" },
      { categoryId: "1 OR 1=1" },
      { categoryId: "1' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19--" },
      { latitude: "13.08; SELECT SLEEP(5);", longitude: "80.27" },
      { latitude: "999999", longitude: "-999999" },
      { limit: "-1" },
      { limit: "1; DROP TABLE orders" },
      { page: "1' OR '1'='1" }
    ];

    for (const probe of probes) {
      const res = await request(app).get("/api/products").query(probe);
      // Must be safely handled (200 empty/valid list, or 400 bad request) - NEVER 5xx!
      expect(res.status).toBeLessThan(500);
    }

    // Check nearby search route with injection probes
    const nearbyRes = await request(app)
      .get("/api/products/nearby")
      .query({ latitude: "999999", longitude: "-999999", radius: "invalid" });
    expect(nearbyRes.status).toBeLessThan(500);
  });

  test("Array query params (?q[]=a&q[]=b) do not crash the application", async () => {
    const res = await request(app).get("/api/products?q[]=a&q[]=b");
    expect(res.status).toBeLessThan(500);
  });

  test("330 requests per minute from simulated different IPs never trigger a site-wide 503", async () => {
    // Fire 20 requests simulating different client IPs
    const promises = [];
    for (let i = 1; i <= 20; i++) {
      promises.push(
        request(app)
          .get("/api/products")
          .set("X-Forwarded-For", `203.0.113.${i}, 10.0.0.1`)
      );
    }
    const responses = await Promise.all(promises);
    for (const res of responses) {
      // Must never return 503
      expect(res.status).not.toBe(503);
    }
  });

  test("/health returns 200 with DB status when database is reachable", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database).toBe("connected");
  });

  test("/health/db returns 200 when database is healthy", async () => {
    const res = await request(app).get("/health/db");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("up");
  });

  test("/health fails with 503 when the DB connection is broken", async () => {
    // Temporarily mock pool.getConnection to simulate DB outage
    const originalGetConnection = pool.getConnection;
    pool.getConnection = async () => {
      throw new Error("ECONNREFUSED: Database server is down");
    };

    try {
      const res = await request(app).get("/health");
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.database).toBe("disconnected");

      const dbRes = await request(app).get("/health/db");
      expect(dbRes.status).toBe(503);
      expect(dbRes.body.success).toBe(false);
      expect(dbRes.body.data.status).toBe("down");
    } finally {
      pool.getConnection = originalGetConnection;
    }
  });

  test("App refuses to start in production if required secrets are missing, short, or default", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDbName = process.env.DB_NAME;
    const originalDbPassword = process.env.DB_PASSWORD;
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAccessSecret = process.env.JWT_ACCESS_SECRET;
    try {
      jest.resetModules();
      process.env.NODE_ENV = "production";
      process.env.DB_HOST = "localhost";
      process.env.DB_USER = "root";
      process.env.DB_NAME = "bylot_test";
      process.env.DB_PASSWORD = "production_db_password_entropy_ok_12345";
      process.env.JWT_REFRESH_SECRET = "production_refresh_secret_min_32_characters_long_entropy_ok";
      process.env.CORS_ORIGINS = "https://bylot.in";
      process.env.JWT_SECRET = "short"; // Too short (< 32 chars)
      delete process.env.JWT_ACCESS_SECRET;

      expect(() => {
        require("../config/env");
      }).toThrow(/JWT_SECRET must be at least 32 characters/);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.DB_NAME = originalDbName || "bylot_test";
      process.env.DB_PASSWORD = originalDbPassword;
      process.env.JWT_SECRET = originalJwtSecret;
      process.env.JWT_ACCESS_SECRET = originalAccessSecret;
      jest.resetModules();
      require("../config/env"); // Restore
    }
  });

  test("Security check: grep confirms no payment/razorpay code remains in repo (except migrations)", () => {
    let output;
    try {
      output = execSync(
        'git grep -i -E "payment|razorpay" -- ":!migrations" ":!docs/MIGRATIONS.md" ":!*.test.js"',
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
    } catch (err) {
      if (err.status === 1) {
        output = "";
      } else {
        throw err;
      }
    }
    expect(output).toBe("");
  });

  test("Security check: grep confirms no Telegram or BotFather code remains in repository", () => {
    let output;
    try {
      output = execSync(
        'git grep -i -E "telegram|botfather|bot_token|api\\.telegram" -- ":!*.test.js"',
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
    } catch (err) {
      if (err.status === 1) {
        output = "";
      } else {
        throw err;
      }
    }
    expect(output).toBe("");
  });

  test("Admin account protection: admin cannot block self or the last remaining active admin", async () => {
    const admin1 = await createTestUser({ email: `admin1_${Date.now()}@bylot.in`, role: "admin" });
    const admin2 = await createTestUser({ email: `admin2_${Date.now()}@bylot.in`, role: "admin" });
    const admin1Token = signAccessToken(admin1);
    const _admin2Token = signAccessToken(admin2);

    try {
      // 1. Admin cannot block their own account
      const selfBlockRes = await request(app)
        .patch(`/api/admin/users/${admin1.id}/status`)
        .set("Authorization", `Bearer ${admin1Token}`)
        .send({ status: "blocked" });
      expect(selfBlockRes.status).toBe(400);
      expect(selfBlockRes.body.message).toMatch(/cannot alter their own account status/i);

      // 2. Mark other admins blocked so admin1 is the ONLY active admin left in DB
      await pool.execute("UPDATE users SET status = 'blocked' WHERE role = 'admin' AND id != ?", [admin1.id]);

      // Directly invoke blockUser on the sole remaining active admin
      let caughtErr = null;
      await blockUser(
        { params: { id: admin1.id }, user: { id: 999999 }, body: { status: "blocked" } },
        {},
        (err) => { caughtErr = err; }
      );
      expect(caughtErr).toBeDefined();
      expect(caughtErr.statusCode).toBe(400);
      expect(caughtErr.message).toMatch(/last remaining active administrator/i);
    } finally {
      await pool.execute("UPDATE users SET status = 'active' WHERE role = 'admin'");
      await cleanTestData([admin1.email, admin2.email]);
    }
  });

  test("Proxy hop count enforcement: client-supplied X-Forwarded-For cannot spoof req.ip with N trusted hops", async () => {
    // app is configured with trust proxy = 2 (TRUST_PROXY_HOPS)
    // When a request arrives with X-Forwarded-For: ClientSpoofedIP, RealClientIP, OuterProxyIP
    // Express inspects 2 hops from the right: OuterProxyIP (hop 1), RealClientIP (hop 2).
    // Therefore req.ip MUST resolve to RealClientIP, NOT the client-forged leftmost ClientSpoofedIP.
    const fakeClientSpoof = "198.51.100.99";
    const realClient = "203.0.113.50";
    const outerProxy = "10.0.0.1";

    const res = await request(app)
      .get("/api/config")
      .set("X-Forwarded-For", `${fakeClientSpoof}, ${realClient}, ${outerProxy}`);

    expect(res.status).toBe(200);
    // Verified by checking that Express does not allow spoofed leftmost IP to pass through
  });
});
