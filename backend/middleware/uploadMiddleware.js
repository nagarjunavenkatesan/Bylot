const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuid } = require("uuid");
const env = require("../config/env");
const AppError = require("../utils/AppError");

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = file.fieldname === "profileImage" ? "profiles" : "products";
    const target = path.join(uploadRoot, folder);
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    cb(null, target);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
    return cb(new AppError("Only jpeg, png, and webp images are allowed", 400));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024
  }
});

function publicFileUrl(req, file) {
  const relative = path.relative(uploadRoot, file.path).replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/uploads/${relative}`;
}

module.exports = {
  upload,
  publicFileUrl
};
