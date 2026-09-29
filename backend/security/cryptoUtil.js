const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Secret key derived from environment or fallback key (32 bytes required for AES-256)
function getMasterKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || "bylot_enterprise_security_default_master_key_32bytes!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts cleartext using AES-256-GCM authenticated encryption.
 */
function encryptPII(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getMasterKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(String(text), "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    // Format: iv_hex:tag_hex:encrypted_hex
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  } catch (err) {
    console.error("[cryptoUtil] Encryption error:", err.message);
    throw new Error("Failed to encrypt sensitive data.");
  }
}

/**
 * Decrypts AES-256-GCM encrypted data string.
 */
function decryptPII(cipherText) {
  if (!cipherText || typeof cipherText !== "string" || !cipherText.includes(":")) return cipherText;
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return cipherText;

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const key = getMasterKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
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
  encryptPII,
  decryptPII,
  generateSecureToken,
  checkPasswordStrength
};
