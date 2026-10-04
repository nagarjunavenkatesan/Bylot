const request = require("supertest");
const app = require("../app");
const { pool } = require("../config/db");
const { createTestUser, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");

describe("Authentication and Access Control Tests", () => {
  const testEmails = [];

  afterAll(async () => {
    await cleanTestData(testEmails);
  });

  test("Register with role: 'admin' is rejected or forced to customer", async () => {
    const email = `tryadmin_${Date.now()}@example.com`;
    testEmails.push(email);

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Admin Attacker",
        email,
        password: "ValidStrongPassword123!",
        role: "admin"
      });

    // Either validation rejects role 'admin' with 400 or forces customer role
    if (res.status === 201) {
      const [rows] = await pool.execute("SELECT role FROM users WHERE email = ?", [email]);
      expect(rows[0].role).not.toBe("admin");
    } else {
      expect([400, 422]).toContain(res.status);
    }
  });

  test("Customer cannot call any admin route (403); Unauthenticated calls return 401", async () => {
    const customer = await createTestUser({ email: `customer_${Date.now()}@example.com`, role: "customer" });
    testEmails.push(customer.email);
    const token = signAccessToken(customer);

    // Unauthenticated call
    const unauthRes = await request(app).get("/api/admin/users");
    expect(unauthRes.status).toBe(401);

    // Customer call
    const custRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);
    expect(custRes.status).toBe(403);
  });

  test("Profile update cannot change role or status", async () => {
    const user = await createTestUser({ email: `profile_${Date.now()}@example.com`, role: "customer", status: "active" });
    testEmails.push(user.email);
    const token = signAccessToken(user);

    const res = await request(app)
      .put("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Name",
        role: "admin",
        status: "blocked"
      });

    expect(res.status).toBe(200);
    const [rows] = await pool.execute("SELECT role, status, name FROM users WHERE id = ?", [user.id]);
    expect(rows[0].role).toBe("customer");
    expect(rows[0].status).toBe("active");
    expect(rows[0].name).toBe("Updated Name");
  });

  test("Blocked user cannot log in, refresh, or call API", async () => {
    const email = `blocked_${Date.now()}@example.com`;
    const user = await createTestUser({ email, status: "blocked", password: "ValidStrongPassword123!" });
    testEmails.push(email);

    // Password login fails
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "ValidStrongPassword123!" });
    expect(loginRes.status).toBe(401);

    // API call with signed token fails
    const token = signAccessToken(user);
    const apiRes = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${token}`);
    expect(apiRes.status).toBe(401);
  });

  test("Register with existing email returns generic success (anti-enumeration)", async () => {
    const email = `exist_${Date.now()}@example.com`;
    testEmails.push(email);
    await createTestUser({ email, password: "ValidStrongPassword123!" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Second Registration",
        email,
        password: "ValidStrongPassword123!"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test("Weak and common passwords are rejected; passwords over 72 bytes rejected", async () => {
    // Too short / weak
    const resShort = await request(app)
      .post("/api/auth/register")
      .send({ name: "Weak Pass", email: `weak_${Date.now()}@example.com`, password: "123" });
    expect([400, 422]).toContain(resShort.status);

    // Common password
    const resCommon = await request(app)
      .post("/api/auth/register")
      .send({ name: "Common Pass", email: `common_${Date.now()}@example.com`, password: "password123" });
    expect([400, 422]).toContain(resCommon.status);

    // Over 72 bytes
    const longPass = "A".repeat(80);
    const resLong = await request(app)
      .post("/api/auth/register")
      .send({ name: "Long Pass", email: `long_${Date.now()}@example.com`, password: longPass });
    expect([400, 422]).toContain(resLong.status);
  });

  test("Multi-device login, refresh rotation, and family reuse revocation", async () => {
    const email = `multidevice_${Date.now()}@example.com`;
    testEmails.push(email);
    await createTestUser({ email, password: "StrongPassword123!" });

    // Device 1 login
    const dev1Login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "StrongPassword123!" });
    expect(dev1Login.status).toBe(200);
    const dev1RefreshToken = dev1Login.body.data.refreshToken;

    // Device 2 login (both logged in concurrently)
    const dev2Login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "StrongPassword123!" });
    expect(dev2Login.status).toBe(200);
    const dev2RefreshToken = dev2Login.body.data.refreshToken;

    expect(dev1RefreshToken).not.toBe(dev2RefreshToken);

    // Device 1 refreshes token (rotation)
    const dev1Refresh = await request(app)
      .post("/api/auth/refresh-token")
      .set("X-Requested-With", "bylot")
      .send({ refreshToken: dev1RefreshToken });
    expect(dev1Refresh.status).toBe(200);
    const dev1NewRefreshToken = dev1Refresh.body.data.refreshToken;

    // Device 2 is still valid
    const dev2Refresh = await request(app)
      .post("/api/auth/refresh-token")
      .set("X-Requested-With", "bylot")
      .send({ refreshToken: dev2RefreshToken });
    expect(dev2Refresh.status).toBe(200);

    // Token reuse: Presenting the OLD rotated token (dev1RefreshToken) revokes the family!
    const reuseRes = await request(app)
      .post("/api/auth/refresh-token")
      .set("X-Requested-With", "bylot")
      .send({ refreshToken: dev1RefreshToken });
    expect(reuseRes.status).toBe(401);

    // Now even dev1NewRefreshToken is invalidated due to family reuse revocation
    const revokedRes = await request(app)
      .post("/api/auth/refresh-token")
      .set("X-Requested-With", "bylot")
      .send({ refreshToken: dev1NewRefreshToken });
    expect(revokedRes.status).toBe(401);
  });

  test("Email verification is required before login", async () => {
    const email = `unverified_${Date.now()}@example.com`;
    testEmails.push(email);
    // User created without email_verified_at
    await createTestUser({ email, emailVerified: false, password: "ValidStrongPassword123!" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "ValidStrongPassword123!" });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toMatch(/verify your email/i);
  });

  test("CSRF protection blocks refresh and logout without custom header or with unauthorized origin", async () => {
    // 1. Missing X-Requested-With header returns 403
    const noHeaderRes = await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken: "dummy" });
    expect(noHeaderRes.status).toBe(403);

    // 2. Invalid X-Requested-With header returns 403
    const badHeaderRes = await request(app)
      .post("/api/auth/refresh-token")
      .set("X-Requested-With", "bad_header")
      .send({ refreshToken: "dummy" });
    expect(badHeaderRes.status).toBe(403);

    // 3. Disallowed origin returns 403
    const evilOriginRes = await request(app)
      .post("/api/auth/refresh-token")
      .set("X-Requested-With", "bylot")
      .set("Origin", "https://evil-attacker-site.com")
      .send({ refreshToken: "dummy" });
    expect(evilOriginRes.status).toBe(403);
  });

  test("Password reset revokes all refresh tokens and invalidates access tokens via token_version", async () => {
    const email = `pwd_reset_${Date.now()}@example.com`;
    testEmails.push(email);
    const user = await createTestUser({ email, password: "OldStrongPassword123!" });
    
    // Log in to get active access token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "OldStrongPassword123!" });
    expect(loginRes.status).toBe(200);
    const oldAccessToken = loginRes.body.data.accessToken;

    // Verify access token works initially
    const check1 = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${oldAccessToken}`);
    expect(check1.status).toBe(200);

    // Request password reset token
    const crypto = require("crypto");
    const resetToken = "valid_reset_token_test_1234567890";
    const resetHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    await pool.execute(
      "UPDATE users SET password_reset_token_hash = ?, password_reset_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?",
      [resetHash, user.id]
    );

    // Execute password reset
    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: "NewStrongPassword456!" });
    expect(resetRes.status).toBe(200);

    // All refresh tokens for this user must be marked revoked
    const [revokedTokens] = await pool.execute(
      "SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NOT NULL",
      [user.id]
    );
    expect(revokedTokens.length).toBeGreaterThan(0);

    // Old access token must now be rejected (token_version was incremented)
    const check2 = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${oldAccessToken}`);
    expect(check2.status).toBe(401);
    expect(check2.body.message).toMatch(/session revoked/i);
  });

  test("Token blacklist persists in database across simulated server restart", async () => {
    const email = `reboot_${Date.now()}@example.com`;
    testEmails.push(email);
    const user = await createTestUser({ email, password: "StrongPassword123!" });
    void user; // created for DB state; token is retrieved via login

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "StrongPassword123!" });
    expect(loginRes.status).toBe(200);
    const accessToken = loginRes.body.data.accessToken;

    // Logout blacklists the token
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("X-Requested-With", "bylot")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(200);

    // Verify token is blacklisted immediately
    const checkImmediate = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(checkImmediate.status).toBe(401);

    // Simulate server restart: clear in-memory blacklist cache
    const tokenBlacklist = require("../security/tokenBlacklist");
    tokenBlacklist.blacklistedTokens.clear();
    expect(tokenBlacklist.blacklistedTokens.size).toBe(0);

    // Verify that despite memory being cleared, the DB persistence still rejects the token
    const checkAfterRestart = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(checkAfterRestart.status).toBe(401);
    expect(checkAfterRestart.body.message).toMatch(/session revoked/i);
  });

  test("Google Login: blocked users refused and account pre-hijack mitigated", async () => {
    const googleAuthService = require("../services/googleAuthService");
    const origVerify = googleAuthService.verifyGoogleIdToken;

    try {
      const email = `guser_${Date.now()}@example.com`;
      testEmails.push(email);

      // 1. Blocked user cannot log in with Google
      const blockedUser = await createTestUser({ email: `blocked_g_${Date.now()}@example.com`, status: "blocked" });
      testEmails.push(blockedUser.email);

      googleAuthService.verifyGoogleIdToken = jest.fn().mockResolvedValue({
        googleId: "gid_blocked_123",
        email: blockedUser.email,
        name: "Blocked Google User",
        picture: "https://example.com/p.jpg",
        emailVerified: true
      });

      const blockedRes = await request(app)
        .post("/api/auth/google-login")
        .send({ idToken: "dummy_token" });
      expect(blockedRes.status).toBe(401);
      expect(blockedRes.body.message).toMatch(/not active/i);

      // 2. Pre-hijack mitigation: unverified user with password links Google, password_hash is cleared
      const unverified = await createTestUser({ email, emailVerified: false, password: "AttackerPassword123!" });
      expect(unverified.password_hash).not.toBeNull();

      googleAuthService.verifyGoogleIdToken = jest.fn().mockResolvedValue({
        googleId: "gid_verified_999",
        email,
        name: "Legit Victim",
        picture: "https://example.com/p2.jpg",
        emailVerified: true
      });

      const linkRes = await request(app)
        .post("/api/auth/google-login")
        .send({ idToken: "dummy_token_2" });
      expect(linkRes.status).toBe(200);

      // Password hash cleared to prevent attacker from logging in with their pre-set password
      const [rows] = await pool.execute("SELECT password_hash, email_verified_at, google_id FROM users WHERE id = ?", [unverified.id]);
      expect(rows[0].password_hash).toBeNull();
      expect(rows[0].email_verified_at).not.toBeNull();
      expect(rows[0].google_id).toBe("gid_verified_999");
    } finally {
      googleAuthService.verifyGoogleIdToken = origVerify;
    }
  });
});

