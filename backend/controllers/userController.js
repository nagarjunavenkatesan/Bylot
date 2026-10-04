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
  const updates = [];
  const params = [];

  if (name !== undefined) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      throw new AppError("Name must be between 2 and 120 characters", 400);
    }
    updates.push("name = ?");
    params.push(trimmedName);
  }

  if (phone !== undefined) {
    const trimmedPhone = typeof phone === "string" ? phone.trim() : null;
    const phoneVal = trimmedPhone === "" ? null : trimmedPhone;
    if (phoneVal && phoneVal.length > 30) {
      throw new AppError("Phone number is too long", 400);
    }
    updates.push("phone = ?");
    params.push(phoneVal);
  }

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(req.user.id);
    await pool.execute(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      params
    );
  }

  const user = await findUserById(req.user.id);
  return success(res, "Profile updated successfully", user);
});

const { deleteUploadedFile } = require("../middleware/uploadMiddleware");

const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("Profile image is required", 400);
  const imageUrl = publicFileUrl(req, req.file);
  const oldImage = req.user.profile_image;
  try {
    await pool.execute("UPDATE users SET profile_image = ? WHERE id = ?", [imageUrl, req.user.id]);
    if (oldImage && oldImage.startsWith("/uploads/")) {
      deleteUploadedFile(oldImage);
    }
    return success(res, "Profile image uploaded successfully", { profileImage: imageUrl });
  } catch (err) {
    if (req.file.path) {
      deleteUploadedFile(req.file.path);
    }
    throw err;
  }
});

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage
};
