const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { createProviderPayment, verifyProviderPayment } = require("../services/paymentService");

const createPayment = asyncHandler(async (req, res) => {
  const [orders] = await pool.execute("SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1", [req.body.orderId, req.user.id]);
  const order = orders[0];
  if (!order) throw new AppError("Order not found", 404);
  if (order.payment_status === "paid") throw new AppError("Order is already paid", 400);

  const providerPayment = await createProviderPayment(order, req.user);
  const [result] = await pool.execute(
    "INSERT INTO payments (order_id, user_id, provider, provider_payment_id, amount, currency, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [order.id, req.user.id, providerPayment.provider, providerPayment.providerPaymentId, order.grand_total, "INR", JSON.stringify(providerPayment)]
  );

  return success(res, "Payment created successfully", {
    paymentId: result.insertId,
    providerPayment
  }, 201);
});

const verifyPayment = asyncHandler(async (req, res) => {
  const verification = await verifyProviderPayment(req.body);
  const [payments] = await pool.execute("SELECT * FROM payments WHERE id = ? AND user_id = ? LIMIT 1", [req.body.paymentId, req.user.id]);
  const payment = payments[0];
  if (!payment) throw new AppError("Payment not found", 404);

  const status = verification.status === "captured" ? "captured" : verification.status;
  await pool.execute(
    "UPDATE payments SET status = ?, provider_payment_id = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?",
    [status, verification.providerPaymentId, payment.id]
  );
  await pool.execute(
    "UPDATE orders SET payment_status = ? WHERE id = ?",
    [status === "captured" ? "paid" : "failed", payment.order_id]
  );

  return success(res, "Payment verified successfully", verification);
});

module.exports = {
  createPayment,
  verifyPayment
};
