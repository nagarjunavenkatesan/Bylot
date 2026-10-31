const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV standard for AES-GCM (NIST SP 800-38D)
const _TAG_LENGTH = 16; // 128-bit authentication tag

function getMasterKey(customSecret = null) {
  const isProd = process.env.NODE_ENV === "production";
  const secret = customSecret || process.env.ENCRYPTION_KEY || process.env.REPORT_ENCRYPTION_KEY || (!isProd ? process.env.JWT_ACCESS_SECRET : "");
  if (!secret) {
    if (isProd) {
      throw new Error("[FATAL] ENCRYPTION_KEY or REPORT_ENCRYPTION_KEY must be configured in production (minimum 32 characters).");
    }
    return crypto.createHash("sha256").update("dev_insecure_local_only_key_never_in_production").digest();
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts cleartext using AES-256-GCM authenticated encryption.
 */
function encryptPII(text, customSecret = null) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getMasterKey(customSecret);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(String(text), "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    // Format: iv_hex:tag_hex:encrypted_hex
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  } catch (err) {
    console.error("[cryptoUtil] Encryption error:", err.message);
    throw new Error("Failed to encrypt sensitive data.", { cause: err });
  }
}

/**
 * Decrypts AES-256-GCM encrypted data string.
 * Supports primary master key and seamless fallback if alternate environment key was used.
 */
function decryptPII(cipherText, customSecret = null) {
  if (!cipherText || typeof cipherText !== "string" || !cipherText.includes(":")) return cipherText;
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return cipherText;

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const candidateKeys = [];
    if (customSecret) {
      candidateKeys.push(crypto.createHash("sha256").update(customSecret).digest());
    } else {
      candidateKeys.push(getMasterKey());
      // If REPORT_ENCRYPTION_KEY differs from primary key, add as fallback candidate
      if (process.env.REPORT_ENCRYPTION_KEY) {
        const reportKeyBuf = crypto.createHash("sha256").update(process.env.REPORT_ENCRYPTION_KEY).digest();
        if (!candidateKeys.some(k => k.equals(reportKeyBuf))) {
          candidateKeys.push(reportKeyBuf);
        }
      }
      // If ENCRYPTION_KEY differs from primary key, add as fallback candidate
      if (process.env.ENCRYPTION_KEY) {
        const encKeyBuf = crypto.createHash("sha256").update(process.env.ENCRYPTION_KEY).digest();
        if (!candidateKeys.some(k => k.equals(encKeyBuf))) {
          candidateKeys.push(encKeyBuf);
        }
      }
    }

    for (let i = 0; i < candidateKeys.length; i++) {
      try {
        const decipher = crypto.createDecipheriv(ALGORITHM, candidateKeys[i], iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encryptedHex, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      } catch (keyErr) {
        if (i < candidateKeys.length - 1) continue;
        throw keyErr;
      }
    }
  } catch (err) {
    console.error("[cryptoUtil] Decryption error (tag verification failed or tampered data):", err.message);
    return "[DECRYPTION_ERROR]";
  }
}

/**
 * Generates secure random hex token (e.g. for CSRF, password reset, API key).
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Password strength policy checker.
 */
function checkPasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters long." };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const score = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  if (score < 3) {
    return { valid: false, reason: "Password must contain a mix of uppercase, lowercase, numbers, and special characters." };
  }
  return { valid: true, score };
}

module.exports = {
  getMasterKey,
  encryptPII,
  decryptPII,
  generateSecureToken,
  checkPasswordStrength
};
