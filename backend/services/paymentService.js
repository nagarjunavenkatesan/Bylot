const crypto = require("crypto");
const env = require("../config/env");
const AppError = require("../utils/AppError");

async function createProviderPayment(order, user) {
  if (env.payment.provider === "razorpay") {
    return {
      provider: "razorpay",
      providerPaymentId: `order_${order.order_number}`,
      amount: order.grand_total,
      currency: "INR",
      customer: {
        id: user.id,
        email: user.email
      }
    };
  }

  // Default manual/offline provider
  return {
    provider: env.payment.provider || "manual",
    providerPaymentId: `manual_${order.order_number}`,
    amount: order.grand_total,
    currency: "INR",
    customer: {
      id: user.id,
      email: user.email
    }
  };
}

async function verifyProviderPayment(payload) {
  // CRITICAL PAYMENT SECURITY:
  // Never trust client-supplied status without cryptographic verification from provider.
  if (env.payment.provider === "razorpay") {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError("Missing Razorpay signature or payment details for verification", 400);
    }

    const secret = env.payment.webhookSecret || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw new AppError("Razorpay webhook or key secret is not configured on the server", 500);
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new AppError("Invalid payment signature: verification failed", 400);
    }

    return {
      providerPaymentId: razorpay_payment_id,
      status: "captured",
      verified: true
    };
  }

  // If using manual/offline payments or unconfigured provider:
  // Clients CANNOT mark payments as captured directly.
  throw new AppError(
    "Direct client payment verification is disabled for manual payments. Manual and offline payments must be confirmed by an administrator.",
    400
  );
}

module.exports = {
  createProviderPayment,
  verifyProviderPayment
};
