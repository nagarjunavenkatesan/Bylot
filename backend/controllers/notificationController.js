const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination, buildMeta } = require("../utils/pagination");

const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const [[count], [rows]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? OR user_id IS NULL", [req.user.id]),
    pool.execute(
      "SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [req.user.id, limit, offset]
    )
  ]);
  return success(res, "Notifications fetched successfully", rows, 200, buildMeta(count[0].total, page, limit));
});

const sendNotification = asyncHandler(async (req, res) => {
  const { userId = null, title, message, type = "system", channel = "in_app", data = null } = req.body;
  const [result] = await pool.execute(
    "INSERT INTO notifications (user_id, title, message, type, channel, data) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, title, message, type, channel, data ? JSON.stringify(data) : null]
  );
  const [rows] = await pool.execute("SELECT * FROM notifications WHERE id = ?", [result.insertId]);
  return success(res, "Notification sent successfully", rows[0], 201);
});

module.exports = {
  getNotifications,
  sendNotification
};
