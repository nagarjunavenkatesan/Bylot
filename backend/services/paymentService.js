const env = require("../config/env");
const AppError = require("../utils/AppError");

async function createProviderPayment(order, user) {
  return {
    provider: env.payment.provider,
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
  if (!payload.providerPaymentId) {
    throw new AppError("providerPaymentId is required", 400);
  }

  return {
    providerPaymentId: payload.providerPaymentId,
    status: payload.status || "captured",
    verified: true
  };
}

module.exports = {
  createProviderPayment,
  verifyProviderPayment
};
