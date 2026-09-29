const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { hashPassword, comparePassword } = require("../utils/password");
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken, randomToken } = require("../utils/token");
const { findUserByEmail, findUserById, createUser, saveRefreshToken } = require("../models/userModel");
const { verifyGoogleIdToken } = require("../services/googleAuthService");
const { sendPasswordResetEmail } = require("../services/emailService");

const accountLockout = require("../security/accountLockout");
const tokenBlacklist = require("../security/tokenBlacklist");

function authPayload(user, refreshToken) {
  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken
  };
}

async function issueTokens(user) {
  const refreshToken = signRefreshToken(user);
  await saveRefreshToken(user.id, hashToken(refreshToken));
  return authPayload(user, refreshToken);
}

const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role = "customer" } = req.body;
  const existing = await findUserByEmail(email);
  if (existing) throw new AppError("Email is already registered", 409);

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name, email, phone, passwordHash, role });
  const data = await issueTokens(user);
  return success(res, "Registration successful", data, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";

  const lockState = accountLockout.isLocked(email, clientIp, req);
  if (lockState.locked) {
    throw new AppError(`Account temporarily locked due to excessive failed attempts. Try again in ${lockState.remainingSeconds} seconds.`, 429);
  }

  const user = await findUserByEmail(email);
  if (!user || user.status !== "active" || !(await comparePassword(password, user.password_hash))) {
    accountLockout.recordFailure(email, clientIp, req);
    throw new AppError("Invalid email or password", 401);
  }

  accountLockout.recordSuccess(email, clientIp, req);
  await pool.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  const publicUser = await findUserById(user.id);
  const data = await issueTokens(publicUser);
  return success(res, "Login successful", data);
});

const googleLogin = asyncHandler(async (req, res) => {
  const googleUser = await verifyGoogleIdToken(req.body.idToken);
  let user = await findUserByEmail(googleUser.email);

  if (!user) {
    user = await createUser({
      name: googleUser.name,
      email: googleUser.email,
      googleId: googleUser.googleId,
      profileImage: googleUser.picture,
      emailVerified: googleUser.emailVerified
    });
  } else {
    await pool.execute(
      "UPDATE users SET google_id = COALESCE(google_id, ?), email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
      [googleUser.googleId, user.id]
    );
    user = await findUserById(user.id);
  }

  const data = await issueTokens(user);
  return success(res, "Google login successful", data);
});

const logout = asyncHandler(async (req, res) => {
  if (req.token) {
    tokenBlacklist.blacklist(req.token, Date.now() + 24 * 60 * 60 * 1000, req);
  }
  await pool.execute("UPDATE users SET refresh_token_hash = NULL WHERE id = ?", [req.user.id]);
  return success(res, "Logout successful", null);
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (err) {
    throw new AppError("Invalid refresh token", 401);
  }
  const [rows] = await pool.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [payload.sub]);
  const user = rows[0];

  if (!user || user.status !== "active" || user.refresh_token_hash !== hashToken(token)) {
    throw new AppError("Invalid refresh token", 401);
  }

  const publicUser = await findUserById(user.id);
  const data = await issueTokens(publicUser);
  return success(res, "Token refreshed successfully", data);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const user = await findUserByEmail(req.body.email);
  if (user) {
    const resetToken = randomToken();
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
  if (!user) throw new AppError("Invalid or expired reset token", 400);

  const passwordHash = await hashPassword(password);
  await pool.execute(
    "UPDATE users SET password_hash = ?, password_reset_token_hash = NULL, password_reset_expires_at = NULL, refresh_token_hash = NULL WHERE id = ?",
    [passwordHash, user.id]
  );

  return success(res, "Password has been reset successfully. Please log in with your new password.", null);
});

module.exports = {
  register,
  login,
  googleLogin,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword
};
