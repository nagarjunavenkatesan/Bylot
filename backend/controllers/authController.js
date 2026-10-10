const { pool } = require("../config/db");
const env = require("../config/env");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { normalizeEmail } = require("../utils/email");
const { hashPassword, comparePassword } = require("../utils/password");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  randomToken
} = require("../utils/token");
const {
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  createUser
} = require("../models/userModel");
const googleAuthService = require("../services/googleAuthService");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendAlreadyRegisteredEmail
} = require("../services/emailService");

const accountLockout = require("../security/accountLockout");
const tokenBlacklist = require("../security/tokenBlacklist");

// Constant dummy bcrypt hash for timing attack mitigation on unknown email
const DUMMY_HASH = "$2b$12$e80yvV8Q0qC82n04K71Q2uQnffc1GfG5ZcR2WvY3eK7jM9mO8oDqm";

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || "127.0.0.1";
}

function setRefreshTokenCookie(res, refreshToken) {
  const isProd = env.nodeEnv === "production";
  const cookieOpts = {
    httpOnly: true,
    secure: isProd || env.cookieSameSite === "none",
    sameSite: env.cookieSameSite,
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000
  };
  if (env.cookieDomain) {
    cookieOpts.domain = env.cookieDomain;
  }
  res.cookie("refreshToken", refreshToken, cookieOpts);
}

function clearRefreshTokenCookie(res) {
  const isProd = env.nodeEnv === "production";
  const cookieOpts = {
    httpOnly: true,
    secure: isProd || env.cookieSameSite === "none",
    sameSite: env.cookieSameSite,
    path: "/api/auth"
  };
  if (env.cookieDomain) {
    cookieOpts.domain = env.cookieDomain;
  }
  res.clearCookie("refreshToken", cookieOpts);
}

async function issueTokens(user, req, res, existingFamilyId = null) {
  const familyId = existingFamilyId || randomToken(16);
  const jti = randomToken(32);
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, jti, familyId);
  const tokenHash = hashToken(refreshToken);
  const userAgent = (req.headers["user-agent"] || "").slice(0, 500);
  const ipAddress = getClientIp(req).slice(0, 45);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, jti, token_hash, family_id, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, jti, tokenHash, familyId, userAgent, ipAddress, expiresAt]
  );

  setRefreshTokenCookie(res, refreshToken);

  return {
    user,
    accessToken,
    refreshToken
  };
}

const register = asyncHandler(async (req, res) => {
  const { name, phone, password, role = "customer" } = req.body;
  const email = normalizeEmail(req.body.email);

  const existing = await findUserByEmail(email);
  if (existing) {
    // Prevent user enumeration: return generic success and notify registered email owner
    await sendAlreadyRegisteredEmail(existing.email);
    return success(
      res,
      "Registration successful. If the email is not already registered, a verification link has been sent.",
      null,
      201
    );
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = randomToken(32);
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await createUser({
    name,
    email,
    phone,
    passwordHash,
    role: role === "seller" ? "seller" : "customer",
    emailVerified: false,
    verificationTokenHash,
    verificationExpiresAt
  });

  setImmediate(() => {
    sendVerificationEmail(email, verificationToken).catch((err) => {
      console.error("[EMAIL ERROR] Failed to send verification email:", err.message);
    });
  });

  return success(
    res,
    "Registration successful. Please check your email to verify your account.",
    { userId: user.id },
    201
  );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.query.token || req.body.token;
  if (!token) {
    throw new AppError("Verification token is required", 400);
  }

  const tokenHash = hashToken(token);
  const [rows] = await pool.execute(
    `SELECT id, status, email_verified_at FROM users 
     WHERE email_verification_token_hash = ? AND email_verification_expires_at > NOW() 
     LIMIT 1`,
    [tokenHash]
  );

  const user = rows[0];
  if (!user) {
    throw new AppError("Invalid or expired verification token", 400);
  }

  await pool.execute(
    `UPDATE users 
     SET email_verified_at = CURRENT_TIMESTAMP, 
         email_verification_token_hash = NULL, 
         email_verification_expires_at = NULL 
     WHERE id = ?`,
    [user.id]
  );

  return success(res, "Email verified successfully. You may now log in.", null);
});

const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const clientIp = getClientIp(req);

  const lockState = accountLockout.isLocked(email, clientIp, req);
  if (lockState.locked) {
    throw new AppError(
      `Account temporarily locked due to excessive failed attempts. Try again in ${lockState.remainingSeconds} seconds.`,
      429
    );
  }

  const user = await findUserByEmail(email);

  // Timing attack mitigation: always execute bcrypt compare
  const candidateHash = user && user.password_hash ? user.password_hash : DUMMY_HASH;
  const passwordMatch = await comparePassword(password, candidateHash);

  if (!user || !passwordMatch) {
    accountLockout.recordFailure(email, clientIp, req);
    throw new AppError("Invalid email or password", 401);
  }

  if (user.status !== "active") {
    throw new AppError("Your account is not active. Please contact support.", 401);
  }

  if (!user.email_verified_at) {
    throw new AppError("Please verify your email address before logging in. Check your inbox for the verification link.", 403);
  }

  accountLockout.recordSuccess(email, clientIp, req);

  await pool.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  const publicUser = await findUserById(user.id);
  const data = await issueTokens(publicUser, req, res);

  return success(res, "Login successful", data);
});

const googleLogin = asyncHandler(async (req, res) => {
  const googleUser = await googleAuthService.verifyGoogleIdToken(req.body.idToken);
  const email = normalizeEmail(googleUser.email);

  // 1. Look up by Google sub (googleId) first
  let user = await findUserByGoogleId(googleUser.googleId);

  // 2. If not found by Google sub, look up by email
  if (!user) {
    user = await findUserByEmail(email);
  }

  if (!user) {
    user = await createUser({
      name: googleUser.name,
      email,
      googleId: googleUser.googleId,
      profileImage: googleUser.picture,
      emailVerified: true
    });
  } else {
    if (user.status !== "active") {
      throw new AppError("Your account is not active. Please contact support.", 401);
    }

    // Mitigation for pre-hijack attack: If an unverified account existed with a password set by someone else,
    // clear the password hash upon linking verified Google login
    const hadUnverifiedPassword = !user.email_verified_at && user.password_hash;

    await pool.execute(
      `UPDATE users 
       SET google_id = COALESCE(google_id, ?),
           email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
           password_hash = CASE WHEN ? = 1 THEN NULL ELSE password_hash END,
           last_login_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [googleUser.googleId, hadUnverifiedPassword ? 1 : 0, user.id]
    );

    user = await findUserById(user.id);
  }

  const data = await issueTokens(user, req, res);
  return success(res, "Google login successful", data);
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (token) {
    const tokenHash = hashToken(token);
    await pool.execute(
      "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
      [tokenHash]
    );
  }

  if (req.token) {
    tokenBlacklist.blacklist(req.token, Date.now() + 24 * 60 * 60 * 1000, req);
  }

  clearRefreshTokenCookie(res);
  return success(res, "Logout successful", null);
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    throw new AppError("Refresh token is required", 401);
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearRefreshTokenCookie(res);
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const tokenHash = hashToken(token);

  // Look up token in refresh_tokens table
  const [tokens] = await pool.execute(
    "SELECT * FROM refresh_tokens WHERE token_hash = ? OR jti = ? LIMIT 1",
    [tokenHash, payload.jti || ""]
  );

  const existingToken = tokens[0];

  // Token reuse detection: if a rotated/revoked refresh token is presented again, revoke whole family
  if (existingToken && existingToken.revoked_at) {
    await pool.execute(
      "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE family_id = ?",
      [existingToken.family_id]
    );
    // Invalidate active access tokens as well
    await pool.execute(
      "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
      [existingToken.user_id]
    );
    clearRefreshTokenCookie(res);
    throw new AppError("Security alert: Revoked refresh token reused. All sessions have been terminated.", 401);
  }

  if (!existingToken || new Date(existingToken.expires_at) < new Date()) {
    clearRefreshTokenCookie(res);
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const [users] = await pool.execute(
    "SELECT * FROM users WHERE id = ? AND status = 'active' LIMIT 1",
    [existingToken.user_id]
  );
  const user = users[0];

  if (!user) {
    clearRefreshTokenCookie(res);
    throw new AppError("User account not found or inactive", 401);
  }

  // Revoke current token (rotation)
  await pool.execute(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
    [existingToken.id]
  );

  const publicUser = await findUserById(user.id);
  // Issue new tokens maintaining the token family
  const data = await issueTokens(publicUser, req, res, existingToken.family_id);

  return success(res, "Token refreshed successfully", data);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await findUserByEmail(email);

  if (user && user.status === "active") {
    const resetToken = randomToken(32);
    const resetHash = hashToken(resetToken);
    await pool.execute(
      "UPDATE users SET password_reset_token_hash = ?, password_reset_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?",
      [resetHash, user.id]
    );
    await sendPasswordResetEmail(user.email, resetToken);
  }

  return success(res, "If the email exists, password reset instructions have been sent", null);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const resetHash = hashToken(token);

  const [rows] = await pool.execute(
    "SELECT id FROM users WHERE password_reset_token_hash = ? AND password_reset_expires_at > NOW() AND status = 'active' LIMIT 1",
    [resetHash]
  );
  const user = rows[0];
  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const passwordHash = await hashPassword(password);

  // Invalidate all refresh tokens and increment token_version to invalidate all access tokens
  await pool.execute(
    `UPDATE users 
     SET password_hash = ?, 
         password_reset_token_hash = NULL, 
         password_reset_expires_at = NULL, 
         token_version = token_version + 1 
     WHERE id = ?`,
    [passwordHash, user.id]
  );

  await pool.execute(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
    [user.id]
  );

  clearRefreshTokenCookie(res);

  return success(res, "Password has been reset successfully. Please log in with your new password.", null);
});

const resendVerification = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await findUserByEmail(email);

  if (user && !user.email_verified_at && user.status === "active") {
    const verificationToken = randomToken(32);
    const verificationTokenHash = hashToken(verificationToken);
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.execute(
      `UPDATE users 
       SET email_verification_token_hash = ?, 
           email_verification_expires_at = ? 
       WHERE id = ?`,
      [verificationTokenHash, verificationExpiresAt, user.id]
    );

    setImmediate(() => {
      sendVerificationEmail(email, verificationToken).catch((err) => {
        console.error("[EMAIL ERROR] Failed to resend verification email:", err.message);
      });
    });
  }

  return success(res, "If an unverified account exists for this email, a verification link has been sent.", null);
});

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  googleLogin,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  issueTokens,
  setRefreshTokenCookie,
  clearRefreshTokenCookie
};

