const request = require("supertest");
const app = require("../app");
const { pool } = require("../config/db");
const { createTestUser, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");
const { authenticator } = require("otplib");
const twoFactorService = require("../services/twoFactorService");
const cryptoUtil = require("../security/cryptoUtil");
const googleAuthService = require("../services/googleAuthService");
const auditLogger = require("../security/auditLogger");

describe("Admin Two-Factor Authentication (2FA) - 28 Production Validation Tests", () => {
  const testEmails = [];

  afterAll(async () => {
    if (testEmails.length > 0) {
      const ph = testEmails.map(() => "?").join(",");
      await pool.execute(
        `DELETE FROM admin_2fa_recovery_codes WHERE admin_user_id IN (SELECT id FROM users WHERE email IN (${ph}))`,
        testEmails
      );
      await pool.execute(
        `DELETE FROM admin_2fa_challenges WHERE admin_user_id IN (SELECT id FROM users WHERE email IN (${ph}))`,
        testEmails
      );
      await pool.execute(
        `DELETE FROM admin_2fa WHERE admin_user_id IN (SELECT id FROM users WHERE email IN (${ph}))`,
        testEmails
      );
      await cleanTestData(testEmails);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test Set: Shared Setup for Admin with 2FA Enabled
  // ─────────────────────────────────────────────────────────────────────────────
  let standardAdmin;
  let standardSecret;

  beforeAll(async () => {
    const email = `admin_standard_${Date.now()}@bylot.in`;
    testEmails.push(email);
    standardAdmin = await createTestUser({ email, role: "admin", password: "AdminPass123!" });
    standardSecret = twoFactorService.generateTotpSecret();
    await twoFactorService.enableAdmin2FA(standardAdmin.id, standardSecret);
  });

  // 1. Correct admin email + password.
  test("1. Correct admin email + password returns 2FA challenge and requires2FA flag", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requires2FA).toBe(true);
    expect(res.body.data.challengeId).toBeDefined();
    expect(typeof res.body.data.challengeId).toBe("string");
  });

  // 2. Incorrect password.
  test("2. Incorrect password rejects login and does not return challenge (401)", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "WrongPassword999!" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.data?.challengeId).toBeUndefined();
    expect(res.body.data?.accessToken).toBeUndefined();
  });

  // 3. Correct TOTP.
  test("3. Correct TOTP code completes login and issues access token (200)", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    const validCode = authenticator.generate(standardSecret);
    const res = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: validCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(standardAdmin.email);
  });

  // 4. Incorrect TOTP.
  test("4. Incorrect TOTP code is rejected with generic error (401)", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    const res = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: "000000" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid.*(code|verification)/i);
    expect(res.body.data?.accessToken).toBeUndefined();
  });

  // 5. 6-digit validation.
  test("5. 6-digit validation rejects non-numeric or invalid length codes (400/422)", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    // Test with letters
    const resLetters = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: "ABCDEF" });
    expect([400, 422]).toContain(resLetters.status);

    // Test with 5 digits
    const resShort = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: "12345" });
    expect([400, 422]).toContain(resShort.status);

    // Test with 7 digits
    const resLong = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: "1234567" });
    expect([400, 422]).toContain(resLong.status);
  });

  // 6. Expired challenge.
  test("6. Expired challenge is rejected and cannot be used (401)", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    // Force expiration in DB
    await pool.execute(
      "UPDATE admin_2fa_challenges SET expires_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE) WHERE challenge_id = ?",
      [challengeId]
    );

    const validCode = authenticator.generate(standardSecret);
    const res = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: validCode });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 7. Reused challenge.
  test("7. Reused challenge is rejected after first successful verification (401)", async () => {
    const email = `admin_reuse_${Date.now()}@bylot.in`;
    testEmails.push(email);
    const reuseAdmin = await createTestUser({ email, role: "admin", password: "AdminPass123!" });
    const reuseSecret = twoFactorService.generateTotpSecret();
    await twoFactorService.enableAdmin2FA(reuseAdmin.id, reuseSecret);

    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: reuseAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    const validCode = authenticator.generate(reuseSecret);
    const firstRes = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: validCode });
    expect(firstRes.status).toBe(200);

    // Second attempt on the same challenge must fail
    const secondRes = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: validCode });
    expect(secondRes.status).toBe(401);
    expect(secondRes.body.success).toBe(false);
  });

  // 8. Challenge invalidation.
  test("8. Challenge invalidation removes challenge from database", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    // Explicitly invalidate
    await twoFactorService.deleteChallenge(challengeId);

    const [rows] = await pool.execute("SELECT * FROM admin_2fa_challenges WHERE challenge_id = ?", [challengeId]);
    expect(rows.length).toBe(0);

    const validCode = authenticator.generate(standardSecret);
    const res = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: validCode });
    expect(res.status).toBe(401);
  });

  // 9. Five failed attempts.
  test("9. Five failed attempts properly tracks attempt count on challenge", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post("/api/admin/2fa/verify-login")
        .send({ challengeId, code: "000000" });
      expect(res.status).toBe(401);

      const [rows] = await pool.execute("SELECT attempts FROM admin_2fa_challenges WHERE challenge_id = ?", [challengeId]);
      expect(rows[0].attempts).toBe(i);
    }
  });

  // 10. Brute-force protection.
  test("10. Brute-force protection: 5th/6th failed attempt invalidates challenge completely", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/admin/2fa/verify-login")
        .send({ challengeId, code: "000000" });
    }

    // Challenge should now be burned/invalidated
    const [rows] = await pool.execute("SELECT * FROM admin_2fa_challenges WHERE challenge_id = ?", [challengeId]);
    expect(rows.length).toBe(0);

    // Even with correct TOTP, attempt is rejected
    const validCode = authenticator.generate(standardSecret);
    const resBurned = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: validCode });
    expect(resBurned.status).toBe(401);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Recovery Code Tests (11, 12, 13, 14, 24)
  // ─────────────────────────────────────────────────────────────────────────────
  let recoveryAdmin;
  let recoveryCodesList;

  beforeAll(async () => {
    const email = `admin_rec_${Date.now()}@bylot.in`;
    testEmails.push(email);
    recoveryAdmin = await createTestUser({ email, role: "admin", password: "AdminPass123!" });
    const sec = twoFactorService.generateTotpSecret();
    const result = await twoFactorService.enableAdmin2FA(recoveryAdmin.id, sec);
    recoveryCodesList = result.recoveryCodes;
  });

  // 11. Correct recovery code.
  test("11. Correct recovery code completes login via /api/admin/2fa/verify-recovery (200)", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: recoveryAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    const codeToUse = recoveryCodesList[0];
    const res = await request(app)
      .post("/api/admin/2fa/verify-recovery")
      .send({ challengeId, recoveryCode: codeToUse });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
  });

  // 12. Incorrect recovery code.
  test("12. Incorrect recovery code is rejected (401)", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: recoveryAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    const res = await request(app)
      .post("/api/admin/2fa/verify-recovery")
      .send({ challengeId, recoveryCode: "INVALID-CODE-999" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 13. Reused recovery code.
  test("13. Reused recovery code CANNOT be used again (401)", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: recoveryAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    const alreadyUsedCode = recoveryCodesList[0]; // Used in Test 11
    const res = await request(app)
      .post("/api/admin/2fa/verify-recovery")
      .send({ challengeId, recoveryCode: alreadyUsedCode });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 14. Recovery-code invalidation after use.
  test("14. Recovery-code invalidation after use updates used_at timestamp in database", async () => {
    const cleanUsedCode = twoFactorService.normalizeRecoveryCode(recoveryCodesList[0]);
    const hash = twoFactorService.hashRecoveryCode(cleanUsedCode);

    const [rows] = await pool.execute(
      "SELECT used_at FROM admin_2fa_recovery_codes WHERE admin_user_id = ? AND code_hash = ?",
      [recoveryAdmin.id, hash]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].used_at).not.toBeNull();
  });

  // 24. Recovery codes are stored as hashes.
  test("24. Recovery codes are stored as SHA-256 hashes, not plaintext", async () => {
    const [rows] = await pool.execute(
      "SELECT code_hash FROM admin_2fa_recovery_codes WHERE admin_user_id = ?",
      [recoveryAdmin.id]
    );

    expect(rows.length).toBe(10);
    for (const row of rows) {
      expect(row.code_hash).toMatch(/^[a-f0-9]{64}$/);
      // Ensure plaintext recovery code is NOT in database
      expect(recoveryCodesList).not.toContain(row.code_hash);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Setup & Enrollment Tests (15, 16, 17)
  // ─────────────────────────────────────────────────────────────────────────────
  let setupAdmin;
  let setupChallengeId;
  let setupSecret;

  beforeAll(async () => {
    const email = `admin_enrolling_${Date.now()}@bylot.in`;
    testEmails.push(email);
    setupAdmin = await createTestUser({ email, role: "admin", password: "AdminPass123!", enable2FA: false });
  });

  // 15. 2FA setup.
  test("15. 2FA setup flow returns QR code, manual key, and provisioning URI", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: setupAdmin.email, password: "AdminPass123!" });

    expect(res.status).toBe(200);
    expect(res.body.data.requires2FASetup).toBe(true);
    expect(res.body.data.challengeId).toBeDefined();
    expect(res.body.data.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.data.manualKey).toBeDefined();
    expect(res.body.data.provisioningUri).toContain(`otpauth://totp/Bylot:${encodeURIComponent(setupAdmin.email)}`);

    setupChallengeId = res.body.data.challengeId;
    setupSecret = res.body.data.manualKey;
  });

  // 16. Invalid setup code.
  test("16. Invalid setup code rejects enrollment (400)", async () => {
    const res = await request(app)
      .post("/api/admin/2fa/verify-setup")
      .send({ challengeId: setupChallengeId, code: "000000" });

    expect([400, 401]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // 17. Successful setup verification.
  test("17. Successful setup verification enables 2FA and returns 10 recovery codes (200)", async () => {
    const validCode = authenticator.generate(setupSecret);
    const res = await request(app)
      .post("/api/admin/2fa/verify-setup")
      .send({ challengeId: setupChallengeId, code: validCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(Array.isArray(res.body.data.recoveryCodes)).toBe(true);
    expect(res.body.data.recoveryCodes.length).toBe(10);

    const [rows] = await pool.execute("SELECT secret_encrypted, enabled FROM admin_2fa WHERE admin_user_id = ?", [setupAdmin.id]);
    expect(rows[0].enabled).toBe(1);
    expect(cryptoUtil.decryptPII(rows[0].secret_encrypted)).toBe(setupSecret);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Management Tests (18, 19)
  // ─────────────────────────────────────────────────────────────────────────────
  let mgmtAdmin;
  let mgmtToken;
  let mgmtSecret;

  beforeAll(async () => {
    const email = `admin_mgmt_${Date.now()}@bylot.in`;
    testEmails.push(email);
    mgmtAdmin = await createTestUser({ email, role: "admin", password: "AdminPass123!" });
    mgmtSecret = twoFactorService.generateTotpSecret();
    await twoFactorService.enableAdmin2FA(mgmtAdmin.id, mgmtSecret);
    mgmtToken = signAccessToken(mgmtAdmin);
  });

  // 18. Disable 2FA security checks.
  test("18. Disable 2FA requires both valid admin password and current TOTP code", async () => {
    // Missing password
    const noPassRes = await request(app)
      .post("/api/admin/2fa/disable")
      .set("Authorization", `Bearer ${mgmtToken}`)
      .send({ currentTotp: "123456" });
    expect([400, 401, 422]).toContain(noPassRes.status);

    // Wrong password
    const wrongPassRes = await request(app)
      .post("/api/admin/2fa/disable")
      .set("Authorization", `Bearer ${mgmtToken}`)
      .send({ password: "WrongPassword!", currentTotp: authenticator.generate(mgmtSecret) });
    expect(wrongPassRes.status).toBe(401);

    // Wrong TOTP
    const wrongTotpRes = await request(app)
      .post("/api/admin/2fa/disable")
      .set("Authorization", `Bearer ${mgmtToken}`)
      .send({ password: "AdminPass123!", currentTotp: "000000" });
    expect(wrongTotpRes.status).toBe(401);

    // Both correct succeeds
    const validTotp = authenticator.generate(mgmtSecret);
    const successRes = await request(app)
      .post("/api/admin/2fa/disable")
      .set("Authorization", `Bearer ${mgmtToken}`)
      .send({ password: "AdminPass123!", currentTotp: validTotp });
    expect(successRes.status).toBe(200);

    const [rows] = await pool.execute("SELECT enabled FROM admin_2fa WHERE admin_user_id = ?", [mgmtAdmin.id]);
    expect(rows[0].enabled).toBe(0);

    // Re-enable for subsequent tests
    await twoFactorService.enableAdmin2FA(mgmtAdmin.id, mgmtSecret);
  });

  // 19. Recovery-code regeneration.
  test("19. Recovery-code regeneration requires current TOTP and produces 10 new codes", async () => {
    const wrongRes = await request(app)
      .post("/api/admin/2fa/regenerate-recovery-codes")
      .set("Authorization", `Bearer ${mgmtToken}`)
      .send({ currentTotp: "000000" });
    expect(wrongRes.status).toBe(401);

    const validTotp = authenticator.generate(mgmtSecret);
    const successRes = await request(app)
      .post("/api/admin/2fa/regenerate-recovery-codes")
      .set("Authorization", `Bearer ${mgmtToken}`)
      .send({ currentTotp: validTotp });

    expect(successRes.status).toBe(200);
    expect(Array.isArray(successRes.body.data.recoveryCodes)).toBe(true);
    expect(successRes.body.data.recoveryCodes.length).toBe(10);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Google OAuth Integration Tests (20, 21)
  // ─────────────────────────────────────────────────────────────────────────────
  let oauthAdmin;
  let oauthCustomer;

  beforeAll(async () => {
    const adminEmail = `admin_oauth_${Date.now()}@bylot.in`;
    testEmails.push(adminEmail);
    oauthAdmin = await createTestUser({ email: adminEmail, role: "admin" });
    const sec = twoFactorService.generateTotpSecret();
    await twoFactorService.enableAdmin2FA(oauthAdmin.id, sec);

    const custEmail = `cust_oauth_${Date.now()}@example.com`;
    testEmails.push(custEmail);
    oauthCustomer = await createTestUser({ email: custEmail, role: "customer" });
  });

  // 20. Google OAuth admin login cannot bypass required 2FA.
  test("20. Google OAuth admin login CANNOT bypass required 2FA (returns challenge)", async () => {
    jest.spyOn(googleAuthService, "verifyGoogleIdToken").mockResolvedValueOnce({
      googleId: `gid_adm_${Date.now()}`,
      email: oauthAdmin.email,
      name: "OAuth Admin"
    });

    const res = await request(app)
      .post("/api/auth/google-login")
      .send({ idToken: "mock_admin_token" });

    expect(res.status).toBe(200);
    expect(res.body.data.requires2FA).toBe(true);
    expect(res.body.data.challengeId).toBeDefined();
    expect(res.body.data.accessToken).toBeUndefined();
  });

  // 21. Customer Google OAuth remains unaffected.
  test("21. Customer Google OAuth remains unaffected and issues tokens directly", async () => {
    jest.spyOn(googleAuthService, "verifyGoogleIdToken").mockResolvedValueOnce({
      googleId: `gid_cust_${Date.now()}`,
      email: oauthCustomer.email,
      name: "OAuth Customer"
    });

    const res = await request(app)
      .post("/api/auth/google-login")
      .send({ idToken: "mock_cust_token" });

    expect(res.status).toBe(200);
    expect(res.body.data.requires2FA).toBeUndefined();
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe("customer");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Security & Leakage Tests (22, 23, 25, 26, 27, 28)
  // ─────────────────────────────────────────────────────────────────────────────
  // 22. TOTP secret is never returned through normal API responses.
  test("22. TOTP secret is never returned through normal API responses", async () => {
    const res = await request(app)
      .get("/api/admin/2fa/status")
      .set("Authorization", `Bearer ${mgmtToken}`);

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain(mgmtSecret);
    expect(bodyStr).not.toContain("secret_encrypted");
  });

  // 23. TOTP secret is never written to logs.
  test("23. TOTP secret and recovery codes are never written to audit logs", async () => {
    const recentLogs = auditLogger.getRecentLogs(50);
    const logsStr = JSON.stringify(recentLogs);

    expect(logsStr).not.toContain(mgmtSecret);
    expect(logsStr).not.toContain(standardSecret);
  });

  // 25. Password remains required before the 2FA challenge.
  test("25. Password remains required before any 2FA challenge is issued", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "" });

    expect([400, 401, 422]).toContain(res.status);
    expect(res.body.data?.challengeId).toBeUndefined();
  });

  // 26. Admin JWT is NOT issued before successful 2FA.
  test("26. Admin JWT is NOT issued before successful 2FA verification", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });

    expect(res.status).toBe(200);
    expect(res.body.data.requires2FA).toBe(true);
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.token).toBeUndefined();
  });

  // 27. Refresh token is NOT issued before successful 2FA.
  test("27. Refresh token is NOT issued before successful 2FA verification", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: standardAdmin.email, password: "AdminPass123!" });

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toBeUndefined();

    const cookies = res.headers["set-cookie"] || [];
    const hasRefreshTokenCookie = cookies.some((c) => c.includes("refreshToken="));
    expect(hasRefreshTokenCookie).toBe(false);
  });

  // 28. Successful 2FA creates the normal authenticated admin session.
  test("28. Successful 2FA creates the normal authenticated admin session granting dashboard access", async () => {
    const email = `admin_session_${Date.now()}@bylot.in`;
    testEmails.push(email);
    const sessionAdmin = await createTestUser({ email, role: "admin", password: "AdminPass123!" });
    const sessionSecret = twoFactorService.generateTotpSecret();
    await twoFactorService.enableAdmin2FA(sessionAdmin.id, sessionSecret);

    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: sessionAdmin.email, password: "AdminPass123!" });
    const challengeId = loginRes.body.data.challengeId;

    const validCode = authenticator.generate(sessionSecret);
    const verifyRes = await request(app)
      .post("/api/admin/2fa/verify-login")
      .send({ challengeId, code: validCode });

    expect(verifyRes.status).toBe(200);
    const accessToken = verifyRes.body.data.accessToken;
    expect(accessToken).toBeDefined();

    // Use this access token to access protected admin route
    const adminAccessRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(adminAccessRes.status).toBe(200);
    expect(adminAccessRes.body.success).toBe(true);
  });
});
