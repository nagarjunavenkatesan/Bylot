const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { findUserById } = require("../models/userModel");
const { publicFileUrl } = require("../middleware/uploadMiddleware");

const getProfile = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  return success(res, "Profile fetched successfully", user);
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  await pool.execute(
    "UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?",
    [name || null, phone || null, req.user.id]
  );
  const user = await findUserById(req.user.id);
  return success(res, "Profile updated successfully", user);
});

const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("Profile image is required", 400);
  const imageUrl = publicFileUrl(req, req.file);
  await pool.execute("UPDATE users SET profile_image = ? WHERE id = ?", [imageUrl, req.user.id]);
  return success(res, "Profile image uploaded successfully", { profileImage: imageUrl });
});

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage
};
