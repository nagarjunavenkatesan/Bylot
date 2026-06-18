const express = require("express");
const controller = require("../controllers/sellerController");
const validate = require("../middleware/validateMiddleware");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");
const validators = require("../validators/productValidators");
const sellerValidators = require("../validators/sellerValidators");

const router = express.Router();

router.use(authenticate);
router.get("/profile", authorize("seller", "admin"), controller.getSellerProfile);
router.post("/profile", sellerValidators.upsertProfile, validate, controller.upsertSellerProfile);
router.post("/uploads/product-image", authorize("seller", "admin"), upload.single("productImage"), controller.uploadProductImage);

router.use(authorize("seller", "admin"));
router.get("/dashboard", controller.sellerDashboard);
router.get("/products", controller.listSellerProducts);
router.post("/products", validators.createProduct, validate, controller.addProduct);
router.put("/products/:id", validators.productId, validators.updateProduct, validate, controller.editProduct);
router.delete("/products/:id", validators.productId, validate, controller.deleteProduct);
router.patch("/products/:id/inventory", validators.productId, validators.inventory, validate, controller.updateInventory);

module.exports = router;
