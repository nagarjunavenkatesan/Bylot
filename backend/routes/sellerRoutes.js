const express = require("express");
const controller = require("../controllers/sellerController");
const validate = require("../middleware/validateMiddleware");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");
const validators = require("../validators/productValidators");
const sellerValidators = require("../validators/sellerValidators");

const router = express.Router();

router.use(authenticate);
router.get("/profile", controller.getSellerProfile);
router.post("/profile", sellerValidators.upsertProfile, validate, controller.upsertSellerProfile);
router.post("/uploads/product-image", upload.single("productImage"), controller.uploadProductImage);

// Product management
router.get("/dashboard", authorize("seller", "admin"), controller.sellerDashboard);
router.get("/products", controller.listSellerProducts);
router.post("/products", upload.single("image"), controller.addProduct);
router.put("/products/:id", upload.single("image"), validators.productId, validate, controller.editProduct);
router.delete("/products/:id", validators.productId, validate, controller.deleteProduct);
router.patch("/products/:id/inventory", validators.productId, validators.inventory, validate, controller.updateInventory);

module.exports = router;
