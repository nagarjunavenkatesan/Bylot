const nodemailer = require("nodemailer");
const env = require("../config/env");

function createTransporter() {
  if (!env.mail.host || !env.mail.user) return null;
  return nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: {
      user: env.mail.user,
      pass: env.mail.pass
    }
  });
}

async function sendPasswordResetEmail(email, resetToken) {
  const transporter = createTransporter();
  const resetUrl = `${env.frontendUrl}/reset-password?token=${resetToken}`;

  if (!transporter) {
    if (env.nodeEnv !== "production") {
      console.log(`[EMAIL DEV] Password reset link for ${email}: ${resetUrl}`);
    }
    return { delivered: false, resetUrl };
  }

  try {
    await transporter.sendMail({
      from: env.mail.from,
      to: email,
      subject: "Reset your Bylot password",
      text: `Use this link to reset your password: ${resetUrl}\n\nThis link is valid for 30 minutes.`
    });
    return { delivered: true };
  } catch (err) {
    console.error("[EMAIL ERROR] Failed to send password reset email:", err.message);
    return { delivered: false, resetUrl };
  }
}

async function sendVerificationEmail(email, verifyToken) {
  const transporter = createTransporter();
  const verifyUrl = `${env.frontendUrl}/verify-email?token=${verifyToken}`;

  if (!transporter) {
    if (env.nodeEnv !== "production") {
      console.log(`[EMAIL DEV] Verification link for ${email}: ${verifyUrl}`);
    }
    return { delivered: false, verifyUrl };
  }

  try {
    await transporter.sendMail({
      from: env.mail.from,
      to: email,
      subject: "Verify your Bylot account email",
      text: `Welcome to Bylot! Please verify your email by clicking the link below:\n${verifyUrl}\n\nThis link is valid for 24 hours.`
    });
    return { delivered: true };
  } catch {
    return { delivered: false, verifyUrl };
  }
}

async function sendAlreadyRegisteredEmail(email) {
  const transporter = createTransporter();
  const loginUrl = `${env.frontendUrl}/login`;
  const resetUrl = `${env.frontendUrl}/forgot-password`;

  if (!transporter) {
    return { delivered: false };
  }

  try {
    await transporter.sendMail({
      from: env.mail.from,
      to: email,
      subject: "Attempted registration on Bylot",
      text: `Someone attempted to create a Bylot account using this email address. If this was you, you already have an account! You can sign in at: ${loginUrl}\n\nIf you forgot your password, reset it here: ${resetUrl}`
    });
    return { delivered: true };
  } catch {
    return { delivered: false };
  }
}

async function sendAlertEmail(subject, message) {
  const transporter = createTransporter();
  if (!transporter) return { delivered: false };

  try {
    await transporter.sendMail({
      from: env.mail.from,
      to: env.adminEmail || env.mail.from,
      subject: `[Bylot] ${subject}`,
      text: message
    });
    return { delivered: true };
  } catch {
    return { delivered: false };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendAlreadyRegisteredEmail,
  sendAlertEmail
};
