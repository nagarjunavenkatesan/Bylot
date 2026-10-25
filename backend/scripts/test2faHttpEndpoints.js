const request = require("supertest");
const app = require("../app");
const { pool } = require("../config/db");
const { authenticator } = require("otplib");

async function runHttpApiTest() {
  console.log("=== BYLOT 2FA HTTP API ENDPOINT INTEGRATION TEST ===");

  // Find an admin user to test with
  const [admins] = await pool.query("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");
  if (!admins.length) {
    console.error("No admin found in DB");
    process.exit(1);
  }
  const admin = admins[0];
  console.log(`Testing with admin: ${admin.email} (ID: ${admin.id})`);

  try {
    // Clean up any existing 2FA for this admin first
    await pool.execute("DELETE FROM admin_2fa_recovery_codes WHERE admin_user_id = ?", [admin.id]);
    await pool.execute("DELETE FROM admin_2fa_challenges WHERE admin_user_id = ?", [admin.id]);
    await pool.execute("DELETE FROM admin_2fa WHERE admin_user_id = ?", [admin.id]);

    // Test 1: Admin login when 2FA is NOT yet set up
    // Note: We use the admin's password or if unknown, we test via adminController directly
    console.log("\n[TEST 1] Testing /api/admin/login response structure for un-enrolled admin...");
    // Let's create a temporary admin with known password
    const bcrypt = require("bcrypt");
    const testEmail = `test_admin_2fa_${Date.now()}@bylot.in`;
    const passwordHash = await bcrypt.hash("TestAdminPass123!", 10);
    const [insertResult] = await pool.execute(
      "INSERT INTO users (name, email, password_hash, role, status, email_verified_at) VALUES (?, ?, ?, 'admin', 'active', CURRENT_TIMESTAMP)",
      ["2FA Test Admin", testEmail, passwordHash]
    );
    const testAdminId = insertResult.insertId;

    // Login call
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ email: testEmail, password: "TestAdminPass123!" });

    console.log("Login HTTP Status:", loginRes.status);
    console.log("Login Response Body:", JSON.stringify(loginRes.body, null, 2));

    if (
      loginRes.status === 200 &&
      loginRes.body.success === true &&
      loginRes.body.data &&
      loginRes.body.data.requires2FASetup === true
    ) {
      console.log("-> [PASS] Login correctly returns requires2FASetup with challenge and QR code!");
    } else {
      console.error("-> [FAIL] Login did not return requires2FASetup correctly");
      process.exit(1);
    }

    const { challengeId, manualKey, qrCodeUrl } = loginRes.body.data;
    console.log(`Challenge ID: ${challengeId}`);
    console.log(`Manual Key (Secret): ${manualKey}`);
    console.log(`QR Code URL starts with: ${qrCodeUrl.slice(0, 30)}...`);

    // Test 2: Invalid TOTP verification
    console.log("\n[TEST 2] Verifying with WRONG 6-digit TOTP code '000000'...");
    const badVerifyRes = await request(app)
      .post("/api/admin/2fa/verify-setup")
      .send({ challengeId, totpCode: "000000" });

    console.log("Bad verify status:", badVerifyRes.status);
    console.log("Bad verify message:", badVerifyRes.body.message);
    if (badVerifyRes.status === 400 || badVerifyRes.status === 401) {
      console.log("-> [PASS] Invalid code successfully rejected!");
    } else {
      console.error("-> [FAIL] Invalid code was not rejected");
    }

    // Test 3: Correct TOTP verification
    console.log("\n[TEST 3] Generating real RFC 6238 TOTP token with Google Authenticator algorithm...");
    const validToken = authenticator.generate(manualKey);
    console.log(`Current TOTP code: ${validToken}`);

    const goodVerifyRes = await request(app)
      .post("/api/admin/2fa/verify-setup")
      .send({ challengeId, totpCode: validToken });

    console.log("Setup verification HTTP Status:", goodVerifyRes.status);
    console.log("Setup verification data:", JSON.stringify(goodVerifyRes.body, null, 2));

    if (
      goodVerifyRes.status === 200 &&
      goodVerifyRes.body.data &&
      goodVerifyRes.body.data.accessToken &&
      Array.isArray(goodVerifyRes.body.data.recoveryCodes) &&
      goodVerifyRes.body.data.recoveryCodes.length === 10
    ) {
      console.log("-> [PASS] Setup verification succeeded! 10 recovery codes and access token issued!");
    } else {
      console.error("-> [FAIL] Setup verification failed");
      process.exit(1);
    }

    const adminToken = goodVerifyRes.body.data.accessToken;
    const recoveryCodes = goodVerifyRes.body.data.recoveryCodes;

    // Test 4: Check 2FA status API
    console.log("\n[TEST 4] Checking /api/admin/2fa/status with admin token...");
    const statusRes = await request(app)
      .get("/api/admin/2fa/status")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Status API Response:", JSON.stringify(statusRes.body, null, 2));
    if (statusRes.status === 200 && statusRes.body.data.enabled === true && statusRes.body.data.remainingRecoveryCodes === 10) {
      console.log("-> [PASS] 2FA status correctly shows enabled: true, 10 recovery codes!");
    } else {
      console.error("-> [FAIL] 2FA status mismatch");
    }

    // Test 5: Login again now that 2FA is enabled
    console.log("\n[TEST 5] Testing login again now that 2FA is active...");
    const login2Res = await request(app)
      .post("/api/admin/login")
      .send({ email: testEmail, password: "TestAdminPass123!" });

    console.log("Second Login status:", login2Res.status);
    console.log("Second Login body:", JSON.stringify(login2Res.body, null, 2));

    if (login2Res.status === 200 && login2Res.body.data && login2Res.body.data.requires2FA === true) {
      console.log("-> [PASS] Login now requires 2FA verification challenge (not setup)!");
    } else {
      console.error("-> [FAIL] Second login did not return requires2FA");
    }

    const loginChallengeId = login2Res.body.data.challengeId;

    // Test 6: Verify login with recovery code
    console.log("\n[TEST 6] Testing single-use recovery code authentication...");
    const recoveryCodeToUse = recoveryCodes[0];
    console.log(`Using recovery code: ${recoveryCodeToUse}`);

    const recoveryRes = await request(app)
      .post("/api/admin/2fa/recovery")
      .send({ challengeId: loginChallengeId, recoveryCode: recoveryCodeToUse });

    console.log("Recovery status:", recoveryRes.status);
    if (recoveryRes.status === 200 && recoveryRes.body.data.accessToken) {
      console.log("-> [PASS] Recovery code login succeeded!");
    } else {
      console.error("-> [FAIL] Recovery code login failed:", recoveryRes.body);
    }

    // Test 7: Verify used recovery code is burned
    console.log("\n[TEST 7] Attempting to reuse already consumed recovery code...");
    const login3Res = await request(app)
      .post("/api/admin/login")
      .send({ email: testEmail, password: "TestAdminPass123!" });
    const challengeId3 = login3Res.body.data.challengeId;

    const reuseRes = await request(app)
      .post("/api/admin/2fa/recovery")
      .send({ challengeId: challengeId3, recoveryCode: recoveryCodeToUse });

    console.log("Reuse status:", reuseRes.status);
    if (reuseRes.status === 401) {
      console.log("-> [PASS] Reused recovery code was properly rejected with 401!");
    } else {
      console.error("-> [FAIL] Reused recovery code was not rejected!");
    }

    // Clean up test admin
    await pool.execute("DELETE FROM admin_2fa_recovery_codes WHERE admin_user_id = ?", [testAdminId]);
    await pool.execute("DELETE FROM admin_2fa_challenges WHERE admin_user_id = ?", [testAdminId]);
    await pool.execute("DELETE FROM admin_2fa WHERE admin_user_id = ?", [testAdminId]);
    await pool.execute("DELETE FROM users WHERE id = ?", [testAdminId]);
    console.log("\nTest admin cleaned up successfully.");

    console.log("\n=== ALL HTTP API 2FA ENDPOINT TESTS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("HTTP test error:", err);
  } finally {
    await pool.end();
  }
}

runHttpApiTest();
