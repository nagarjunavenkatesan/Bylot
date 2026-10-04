const fs = require("fs");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const { v4: uuid } = require("uuid");
const env = require("../config/env");
const AppError = require("../utils/AppError");

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

// Memory storage to inspect magic bytes before touching disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024
  }
});

function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

async function processUploadedImage(req, res, next) {
  if (!req.file) return next();

  try {
    const mime = detectImageMime(req.file.buffer);

    if (!mime || !ALLOWED_MIMES.includes(mime)) {
      return next(new AppError("Invalid image file. Only genuine JPEG, PNG, and WebP images are allowed.", 400));
    }

    const folder = req.file.fieldname === "profileImage" ? "profiles" : "products";
    const folderPath = path.join(uploadRoot, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Always generate a random server-side filename and re-encode to WebP
    const filename = `${uuid()}.webp`;
    const targetPath = path.join(folderPath, filename);

    // Re-encode with sharp to strip metadata and any embedded malicious payloads
    await sharp(req.file.buffer)
      .rotate()
      .webp({ quality: 85 })
      .toFile(targetPath);

    const targetStat = fs.statSync(targetPath);
    recordUploadUsage(req.user?.id, targetStat.size);

    req.file.filename = filename;
    req.file.path = targetPath;
    req.file.mimetype = "image/webp";
    delete req.file.buffer;

    next();
  } catch (err) {
    next(err);
  }
}

const userUploadQuotas = new Map();
const MAX_UPLOADS_PER_DAY = Number(process.env.MAX_UPLOADS_PER_DAY || 30);
const MAX_UPLOAD_MB_PER_DAY = Number(process.env.MAX_UPLOAD_MB_PER_DAY || 30);

function checkUploadQuota(req, res, next) {
  if (!req.user || !req.user.id) return next();
  const userId = String(req.user.id);
  const now = Date.now();
  let record = userUploadQuotas.get(userId);

  if (!record || now > record.resetAt) {
    record = { count: 0, totalBytes: 0, resetAt: now + 24 * 60 * 60 * 1000 };
    userUploadQuotas.set(userId, record);
  }

  if (record.count >= MAX_UPLOADS_PER_DAY) {
    return next(new AppError("Daily upload quota exceeded (max file count). Please try again tomorrow.", 429));
  }

  if (record.totalBytes >= MAX_UPLOAD_MB_PER_DAY * 1024 * 1024) {
    return next(new AppError("Daily upload quota exceeded (max storage size). Please try again tomorrow.", 429));
  }

  next();
}

function recordUploadUsage(userId, byteLength) {
  if (!userId) return;
  const idStr = String(userId);
  const record = userUploadQuotas.get(idStr);
  if (record) {
    record.count += 1;
    record.totalBytes += (byteLength || 0);
  }
}

function deleteUploadedFile(fileUrlOrPath) {
  if (!fileUrlOrPath || typeof fileUrlOrPath !== "string") return;
  try {
    let cleanPath = fileUrlOrPath;
    if (cleanPath.startsWith("/uploads/")) {
      cleanPath = path.join(uploadRoot, cleanPath.replace("/uploads/", ""));
    }
    if (fs.existsSync(cleanPath)) {
      fs.unlinkSync(cleanPath);
    }
  } catch {
    // Non-blocking cleanup
  }
}

function publicFileUrl(req, file) {
  const relative = path.relative(uploadRoot, file.path).replace(/\\/g, "/");
  return `/uploads/${relative}`;
}

module.exports = {
  upload,
  processUploadedImage,
  checkUploadQuota,
  userUploadQuotas,
  deleteUploadedFile,
  publicFileUrl
};

