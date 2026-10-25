const { pool } = require("../config/db");
const twoFactorService = require("../services/twoFactorService");
const cryptoUtil = require("../security/cryptoUtil");
const { authenticator } = require("otplib");

async function runSelfTest() {
  console.log("=== BYLOT GOOGLE AUTHENTICATOR (2FA) SELF-TEST ===");
  let failed = 0;
  let passed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Secret generation
    const secret = twoFactorService.generateTotpSecret();
    assert(typeof secret === "string" && secret.length >= 16, "1. generateTotpSecret produces base32 secret");

    // 2. Provisioning URI format for Google Authenticator
    const email = "admin@bylot.in";
    const uri = twoFactorService.generateProvisioningUri(email, secret);
    console.log("Sample Provisioning URI:", uri);
    assert(uri.startsWith("otpauth://totp/Bylot:"), "2.1. URI has otpauth://totp/Bylot prefix");
    assert(uri.includes(`secret=${secret}`), "2.2. URI includes secret parameter");
    assert(uri.includes("issuer=Bylot"), "2.3. URI includes issuer parameter");

    // 3. QR code data URL generation
    const qrDataUrl = await twoFactorService.generateQrCode(uri);
    assert(qrDataUrl.startsWith("data:image/png;base64,"), "3. generateQrCode produces valid PNG data URL");

    // 4. TOTP generation and verification
    const token = authenticator.generate(secret);
    console.log(`Generated TOTP for current window: ${token}`);
    const verifyValid = twoFactorService.verifyTotp(secret, token);
    assert(verifyValid.valid === true, "4.1. Valid TOTP passes verification");

    // 5. Invalid TOTP rejection
    const verifyInvalid = twoFactorService.verifyTotp(secret, "999999");
    assert(verifyInvalid.valid === false, "5.1. Invalid 6-digit TOTP is rejected");

    const verifyBadFormat = twoFactorService.verifyTotp(secret, "abc12");
    assert(verifyBadFormat.valid === false, "5.2. Malformed token is rejected");

    // 6. Replay attack prevention
    const currentStep = verifyValid.timeStep;
    const verifyReplay = twoFactorService.verifyTotp(secret, token, currentStep);
    assert(verifyReplay.valid === false && verifyReplay.reason === "REPLAY_DETECTED", "6. Replay of same TOTP within same timestep is rejected");

    // 7. Secret encryption in DB
    const encryptedSecret = cryptoUtil.encryptPII(secret);
    assert(encryptedSecret !== secret, "7.1. Secret is encrypted (not plaintext)");
    const decryptedSecret = cryptoUtil.decryptPII(encryptedSecret);
    assert(decryptedSecret === secret, "7.2. Decrypted secret matches original base32 secret");

    // 8. Recovery codes generation, formatting, hashing
    const codes = twoFactorService.generateRecoveryCodes(10);
    assert(Array.isArray(codes) && codes.length === 10, "8.1. Generates exactly 10 recovery codes");
    assert(codes.every(c => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)), "8.2. Recovery codes match XXXX-XXXX format");

    const hash1 = twoFactorService.hashRecoveryCode(codes[0]);
    const hash2 = twoFactorService.hashRecoveryCode(codes[0].toLowerCase().replace("-", " "));
    assert(hash1 === hash2, "8.3. hashRecoveryCode normalizes spaces, dashes, and casing");

    // 9. Challenge lifecycle in DB
    const testAdminId = 1; // Existing admin in DB
    const challenge = await twoFactorService.createChallenge(testAdminId, "setup", secret);
    assert(challenge.challengeId && challenge.challengeId.length === 64, "9.1. createChallenge generates 64-char hex token");

    const loadedChallenge = await twoFactorService.getChallenge(challenge.challengeId, "setup");
    assert(loadedChallenge && loadedChallenge.admin_user_id === testAdminId, "9.2. getChallenge retrieves active challenge");

    // 10. Challenge brute-force protection
    for (let i = 1; i < 5; i++) {
      const fail = await twoFactorService.recordChallengeFailure(challenge.challengeId);
      assert(!fail.invalidated, `10.${i}. Attempt ${i} increments failure count without invalidation`);
    }
    const finalFail = await twoFactorService.recordChallengeFailure(challenge.challengeId);
    assert(finalFail.invalidated === true, "10.5. 5th failure invalidates challenge completely");

    const deadChallenge = await twoFactorService.getChallenge(challenge.challengeId, "setup");
    assert(deadChallenge === null, "10.6. Invalidated challenge returns null");

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  } catch (err) {
    console.error("Self-test error:", err);
    failed++;
  } finally {
    await pool.end();
  }
}

runSelfTest();
