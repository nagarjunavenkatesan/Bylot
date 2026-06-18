const express = require("express");
const controller = require("../controllers/userController");
const validate = require("../middleware/validateMiddleware");
const { authenticate } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");
const validators = require("../validators/userValidators");

const router = express.Router();

router.use(authenticate);
router.get("/profile", controller.getProfile);
router.put("/profile", validators.updateProfile, validate, controller.updateProfile);
router.post("/profile/image", upload.single("profileImage"), controller.uploadProfileImage);

module.exports = router;
