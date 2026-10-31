const crypto = require("crypto");
const { authenticator } = require("otplib");
const qrcode = require("qrcode");
const { pool } = require("../config/db");
const cryptoUtil = require("../security/cryptoUtil");
const auditLogger = require("../security/auditLogger");

// Configure authenticator with ±1 time step (30s) tolerance
authenticator.options = { window: 1 };

const ISSUER_NAME = "Bylot";
const CHALLENGE_LIFETIME_MINUTES = 5;
const MAX_CHALLENGE_ATTEMPTS = 5;
const RECOVERY_CODES_COUNT = 10;

/**
 * Generates an RFC 6238-compliant TOTP base32 secret.
 */
function generateTotpSecret() {
  return authenticator.generateSecret();
}

/**
 * Builds an otpauth:// URI compatible with Google Authenticator and RFC 6238.
 * Format: otpauth://totp/Bylot:admin@example.com?secret=SECRET&period=30&digits=6&algorithm=SHA1&issuer=Bylot
 */
function generateProvisioningUri(email, secret) {
  const cleanEmail = String(email || "admin@bylot.in").trim();
  const cleanSecret = String(secret || "").trim().replace(/\s+/g, "").toUpperCase();
  return authenticator.keyuri(cleanEmail, ISSUER_NAME, cleanSecret);
}

/**
 * Generates a base64 Data URL QR code from the provisioning URI.
 */
async function generateQrCode(provisioningUri) {
  return qrcode.toDataURL(provisioningUri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256
  });
}

/**
 * Verifies a 6-digit TOTP code against a base32 secret.
 * Enforces ±1 time step (30s) clock-skew tolerance and checks for replay against last_used_time_step.
 */
function verifyTotp(secret, token, lastUsedTimeStep = null) {
  const cleanToken = String(token || "").trim();
  if (!/^\d{6}$/.test(cleanToken)) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  const cleanSecret = String(secret || "").trim().replace(/\s+/g, "").toUpperCase();
  if (!cleanSecret || cleanSecret === "[DECRYPTION_ERROR]") {
    return { valid: false, reason: "INVALID_SECRET" };
  }

  try {
    const delta = authenticator.checkDelta(cleanToken, cleanSecret);
    if (delta === null || delta === undefined) {
      return { valid: false, reason: "INVALID_CODE" };
    }

    const timeStep = Math.floor(Date.now() / 30000) + delta;

    // Replay attack prevention: timeStep must be strictly greater than last_used_time_step
    if (lastUsedTimeStep !== null && lastUsedTimeStep !== undefined) {
      if (Number(timeStep) <= Number(lastUsedTimeStep)) {
        return { valid: false, reason: "REPLAY_DETECTED", timeStep };
      }
    }

    return { valid: true, timeStep };
  } catch (err) {
    console.error("[twoFactorService] verifyTotp error:", err.message);
    return { valid: false, reason: "VERIFY_ERROR" };
  }
}

/**
 * Normalizes recovery code (removes dashes, spaces, uppercase).
 */
function normalizeRecoveryCode(rawCode) {
  return String(rawCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Generates an array of secure random recovery codes.
 * Format: 8-char alphanumeric XXXX-XXXX (easy to read and type).
 */
function generateRecoveryCodes(count = RECOVERY_CODES_COUNT) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}

/**
 * Hashes a recovery code using SHA-256 after normalization.
 */
function hashRecoveryCode(code) {
  const normalized = normalizeRecoveryCode(code);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Stores hashed recovery codes in admin_2fa_recovery_codes for an admin user.
 */
async function storeRecoveryCodes(executor, adminUserId, plaintextCodes) {
  await executor.execute("DELETE FROM admin_2fa_recovery_codes WHERE admin_user_id = ?", [adminUserId]);

  for (const code of plaintextCodes) {
    const hash = hashRecoveryCode(code);
    await executor.execute(
      "INSERT INTO admin_2fa_recovery_codes (admin_user_id, code_hash) VALUES (?, ?)",
      [adminUserId, hash]
    );
  }
}

/**
 * Verifies and burns a single-use recovery code.
 */
async function verifyAndConsumeRecoveryCode(adminUserId, candidateCode) {
  const cleanCode = normalizeRecoveryCode(candidateCode);
  if (!cleanCode || cleanCode.length < 6) {
    return false;
  }

  const hash = hashRecoveryCode(cleanCode);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      "SELECT id FROM admin_2fa_recovery_codes WHERE admin_user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1 FOR UPDATE",
      [adminUserId, hash]
    );

    if (!rows[0]) {
      await connection.rollback();
      return false;
    }

    await connection.execute(
      "UPDATE admin_2fa_recovery_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
      [rows[0].id]
    );

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Creates a short-lived, single-use 2FA challenge tied to the admin user.
 */
async function createChallenge(adminUserId, challengeType = "login", tempSecret = null) {
  const challengeId = cryptoUtil.generateSecureToken(32);
  const tempSecretEncrypted = tempSecret ? cryptoUtil.encryptPII(tempSecret) : null;

  // Invalidate any existing pending challenges for this admin
  await pool.execute("DELETE FROM admin_2fa_challenges WHERE admin_user_id = ?", [adminUserId]);

  await pool.execute(
    `INSERT INTO admin_2fa_challenges 
     (challenge_id, admin_user_id, challenge_type, temp_secret_encrypted, attempts, max_attempts, expires_at)
     VALUES (?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [challengeId, adminUserId, challengeType, tempSecretEncrypted, MAX_CHALLENGE_ATTEMPTS, CHALLENGE_LIFETIME_MINUTES]
  );

  return {
    challengeId,
    expiresIn: CHALLENGE_LIFETIME_MINUTES * 60
  };
}

/**
 * Looks up an active 2FA challenge. Returns null if expired or max attempts reached.
 */
async function getChallenge(challengeId, expectedType = null) {
  if (!challengeId || typeof challengeId !== "string") return null;

  const typeClause = expectedType ? "AND challenge_type = ?" : "";
  const params = expectedType ? [challengeId, expectedType] : [challengeId];

  const [rows] = await pool.execute(
    `SELECT id, challenge_id, admin_user_id, challenge_type, temp_secret_encrypted, attempts, max_attempts, expires_at
     FROM admin_2fa_challenges
     WHERE challenge_id = ? ${typeClause} AND expires_at > NOW()
     LIMIT 1`,
    params
  );

  const challenge = rows[0];
  if (!challenge) return null;

  if (challenge.attempts >= challenge.max_attempts) {
    // Challenge expired due to too many failed attempts
    await pool.execute("DELETE FROM admin_2fa_challenges WHERE id = ?", [challenge.id]);
    return null;
  }

  return challenge;
}

/**
 * Records a failed attempt on a challenge. If max attempts reached, deletes and invalidates challenge.
 */
async function recordChallengeFailure(challengeId, req = null) {
  const [rows] = await pool.execute(
    "SELECT id, admin_user_id, attempts, max_attempts FROM admin_2fa_challenges WHERE challenge_id = ? LIMIT 1",
    [challengeId]
  );

  if (!rows[0]) return { invalidated: true, remainingAttempts: 0 };

  const currentAttempts = rows[0].attempts + 1;
  const maxAttempts = rows[0].max_attempts;

  if (currentAttempts >= maxAttempts) {
    await pool.execute("DELETE FROM admin_2fa_challenges WHERE id = ?", [rows[0].id]);
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      severity: "CRITICAL",
      userId: rows[0].admin_user_id,
      details: "Maximum 2FA verification attempts exceeded. Challenge invalidated."
    });
    return { invalidated: true, remainingAttempts: 0 };
  }

  await pool.execute("UPDATE admin_2fa_challenges SET attempts = ? WHERE id = ?", [currentAttempts, rows[0].id]);
  return { invalidated: false, remainingAttempts: maxAttempts - currentAttempts };
}

/**
 * Explicitly consumes/deletes a challenge upon successful completion.
 */
async function deleteChallenge(challengeId) {
  if (!challengeId) return;
  await pool.execute("DELETE FROM admin_2fa_challenges WHERE challenge_id = ?", [challengeId]);
}

/**
 * Retrieves the 2FA record for an admin.
 */
async function getAdmin2FARecord(adminUserId) {
  const [rows] = await pool.execute(
    "SELECT id, admin_user_id, secret_encrypted, enabled, last_used_time_step, created_at, updated_at FROM admin_2fa WHERE admin_user_id = ? LIMIT 1",
    [adminUserId]
  );
  return rows[0] || null;
}

/**
 * Safe public status view for Admin settings (NEVER exposes secrets or recovery codes).
 */
async function getAdmin2FAStatus(adminUserId) {
  const record = await getAdmin2FARecord(adminUserId);
  const [recoveryRows] = await pool.execute(
    "SELECT COUNT(*) AS remaining FROM admin_2fa_recovery_codes WHERE admin_user_id = ? AND used_at IS NULL",
    [adminUserId]
  );

  const remaining = Number(recoveryRows[0]?.remaining || 0);

  return {
    enabled: Boolean(record && record.enabled),
    remainingRecoveryCodes: remaining,
    enrolledAt: record ? record.created_at : null,
    updatedAt: record ? record.updated_at : null
  };
}

/**
 * Enables 2FA for an admin user and stores the encrypted secret and initial recovery codes in a transaction.
 */
async function enableAdmin2FA(adminUserId, secret, timeStep = null) {
  const encryptedSecret = cryptoUtil.encryptPII(secret);
  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODES_COUNT);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO admin_2fa (admin_user_id, secret_encrypted, enabled, last_used_time_step)
       VALUES (?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE
         secret_encrypted = VALUES(secret_encrypted),
         enabled = 1,
         last_used_time_step = VALUES(last_used_time_step),
         updated_at = CURRENT_TIMESTAMP`,
      [adminUserId, encryptedSecret, timeStep]
    );

    await storeRecoveryCodes(connection, adminUserId, recoveryCodes);

    await connection.commit();
    return { recoveryCodes };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Updates last_used_time_step to prevent replay attacks.
 */
async function updateLastUsedTimeStep(adminUserId, timeStep) {
  await pool.execute(
    "UPDATE admin_2fa SET last_used_time_step = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_user_id = ?",
    [timeStep, adminUserId]
  );
}

/**
 * Regenerates recovery codes for an admin user.
 */
async function regenerateRecoveryCodes(adminUserId) {
  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODES_COUNT);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await storeRecoveryCodes(connection, adminUserId, recoveryCodes);
    await connection.commit();
    return { recoveryCodes };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Disables 2FA for an admin user.
 */
async function disableAdmin2FA(adminUserId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      "UPDATE admin_2fa SET enabled = 0, secret_encrypted = '', last_used_time_step = NULL, updated_at = CURRENT_TIMESTAMP WHERE admin_user_id = ?",
      [adminUserId]
    );

    await connection.execute("DELETE FROM admin_2fa_recovery_codes WHERE admin_user_id = ?", [adminUserId]);
    await connection.execute("DELETE FROM admin_2fa_challenges WHERE admin_user_id = ?", [adminUserId]);

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  ISSUER_NAME,
  MAX_CHALLENGE_ATTEMPTS,
  generateTotpSecret,
  generateProvisioningUri,
  generateQrCode,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyAndConsumeRecoveryCode,
  createChallenge,
  getChallenge,
  recordChallengeFailure,
  deleteChallenge,
  getAdmin2FARecord,
  getAdmin2FAStatus,
  enableAdmin2FA,
  updateLastUsedTimeStep,
  regenerateRecoveryCodes,
  disableAdmin2FA
};
