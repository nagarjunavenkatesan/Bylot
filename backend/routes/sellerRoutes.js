const express = require("express");
const controller = require("../controllers/sellerController");
const validate = require("../middleware/validateMiddleware");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { upload, processUploadedImage, checkUploadQuota } = require("../middleware/uploadMiddleware");
const { uploadLimiter } = require("../middleware/rateLimitMiddleware");
const validators = require("../validators/productValidators");
const sellerValidators = require("../validators/sellerValidators");
const orderController = require("../controllers/orderController");

const router = express.Router();

router.use(authenticate);
router.get("/profile", controller.getSellerProfile);
router.post("/profile", sellerValidators.upsertProfile, validate, controller.upsertSellerProfile);

// Image upload - restricted to approved sellers and admins with per-user rate limit & daily quota
router.post("/uploads/product-image", uploadLimiter, checkUploadQuota, upload.single("productImage"), processUploadedImage, controller.uploadProductImage);

// Product management
router.get("/dashboard", authorize("seller", "admin"), controller.sellerDashboard);
router.get("/products", controller.listSellerProducts);
router.post("/products", authorize("seller", "admin"), uploadLimiter, checkUploadQuota, upload.single("image"), processUploadedImage, validators.createProduct, validate, controller.addProduct);
router.put("/products/:id", authorize("seller", "admin"), uploadLimiter, checkUploadQuota, upload.single("image"), processUploadedImage, validators.productId, validators.updateProduct, validate, controller.editProduct);
router.delete("/products/:id", authorize("seller", "admin"), validators.productId, validate, controller.deleteProduct);

// Order management for sellers
router.get("/orders", authorize("seller", "admin"), orderController.getSellerOrders);
router.patch("/orders/:id/status", authorize("seller", "admin"), orderController.updateSellerOrderStatus);
router.put("/orders/:id/status", authorize("seller", "admin"), orderController.updateSellerOrderStatus);

module.exports = router;
