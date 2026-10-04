const { OAuth2Client } = require("google-auth-library");
const env = require("../config/env");
const AppError = require("../utils/AppError");

const client = new OAuth2Client(env.googleClientId);

async function verifyGoogleIdToken(idToken) {
  if (!env.googleClientId) {
    throw new AppError("Google Sign-In is not configured", 500);
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.googleClientId
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new AppError("Invalid Google token", 401);
  }

  if (payload.email_verified !== true) {
    throw new AppError("Google account email is not verified", 401);
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture,
    emailVerified: true
  };
}

module.exports = {
  verifyGoogleIdToken
};
