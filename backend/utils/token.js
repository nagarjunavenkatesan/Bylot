const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      token_version: user.token_version || 1,
      tokenVersion: user.token_version || 1
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn || "15m" }
  );
}

function signRefreshToken(user, jti = null, familyId = null) {
  const tokenJti = jti || randomToken();
  const tokenFamilyId = familyId || randomToken();
  return jwt.sign(
    {
      sub: user.id,
      tokenType: "refresh",
      jti: tokenJti,
      familyId: tokenFamilyId
    },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn || "30d" }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  randomToken
};
