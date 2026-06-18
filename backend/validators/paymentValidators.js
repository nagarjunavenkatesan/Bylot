const { body } = require("express-validator");

const createPayment = [
  body("orderId").isInt({ min: 1 })
];

const verifyPayment = [
  body("paymentId").isInt({ min: 1 }),
  body("providerPaymentId").notEmpty(),
  body("status").optional().isIn(["authorized", "captured", "failed"])
];

module.exports = {
  createPayment,
  verifyPayment
};
