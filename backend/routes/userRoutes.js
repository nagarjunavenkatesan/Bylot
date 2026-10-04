const express = require("express");
const controller = require("../controllers/userController");
const validate = require("../middleware/validateMiddleware");
const { authenticate } = require("../middleware/authMiddleware");
const { upload, processUploadedImage, checkUploadQuota } = require("../middleware/uploadMiddleware");
const { uploadLimiter } = require("../middleware/rateLimitMiddleware");
const validators = require("../validators/userValidators");

const router = express.Router();

router.use(authenticate);
router.get("/profile", controller.getProfile);
router.put("/profile", validators.updateProfile, validate, controller.updateProfile);
router.post("/profile", validators.updateProfile, validate, controller.updateProfile);
router.patch("/profile", validators.updateProfile, validate, controller.updateProfile);
router.post("/profile/image", uploadLimiter, checkUploadQuota, upload.single("profileImage"), processUploadedImage, controller.uploadProfileImage);

module.exports = router;
