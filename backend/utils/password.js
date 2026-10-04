const bcrypt = require("bcrypt");
const env = require("../config/env");

const COMMON_PASSWORDS = new Set([
  "password123",
  "1234567890",
  "12345678901",
  "qwertyuiop",
  "administrator",
  "admin12345",
  "welcome123",
  "letmein123",
  "pass123456",
  "iloveyou123",
  "sunshine123",
  "princess123",
  "football123",
  "charlie1234",
  "donald1234"
]);

function checkPasswordStrength(password, userContext = {}) {
  if (typeof password !== "string") {
    return { valid: false, message: "Password must be a valid string" };
  }

  // Enforce 72-byte bcrypt limit
  const byteLength = Buffer.byteLength(password, "utf8");
  if (byteLength > 72) {
    return { valid: false, message: "Password cannot exceed 72 bytes in length" };
  }

  // Minimum length 10
  if (password.length < 10) {
    return { valid: false, message: "Password must be at least 10 characters long" };
  }

  const lowerPass = password.toLowerCase();

  // Common password check
  if (COMMON_PASSWORDS.has(lowerPass)) {
    return { valid: false, message: "Password is too common. Please choose a more secure password." };
  }

  // Sequential or repeating characters (e.g., "1111111111", "aaaaaaaaaa")
  if (/^(.)\1+$/.test(password)) {
    return { valid: false, message: "Password cannot consist of a single repeated character" };
  }

  // Not equal to or containing email prefix or name
  if (userContext.email) {
    const emailPrefix = String(userContext.email).split("@")[0].toLowerCase().trim();
    if (emailPrefix.length >= 3 && lowerPass.includes(emailPrefix)) {
      return { valid: false, message: "Password cannot contain your email username" };
    }
  }

  if (userContext.name) {
    const nameClean = String(userContext.name).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (nameClean.length >= 3 && lowerPass.includes(nameClean)) {
      return { valid: false, message: "Password cannot contain your name" };
    }
  }

  return { valid: true };
}

async function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptSaltRounds);
}

async function comparePassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

module.exports = {
  checkPasswordStrength,
  hashPassword,
  comparePassword
};
