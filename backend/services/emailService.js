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
  const resetUrl = `${env.apiBaseUrl}/reset-password?token=${resetToken}`;

  if (!transporter) {
    return { delivered: false, resetUrl };
  }

  await transporter.sendMail({
    from: env.mail.from,
    to: email,
    subject: "Reset your Bylot password",
    text: `Use this link to reset your password: ${resetUrl}`
  });

  return { delivered: true };
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
  sendAlertEmail
};
