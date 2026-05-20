const express = require("express");
const productController = require("../controllers/productController");
const { protect, restrictTo } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const router = express.Router();

router.get("/", productController.getProducts);


router.post(
  "/",protect,
  upload.array("images", 3),
  
  restrictTo("vendor"),
  productController.createProduct
);
router.get("/:id", productController.getProduct);
router.patch(
  "/:id",
  upload.array("images", 3),
  protect,
  restrictTo("vendor", "admin"),
  productController.updateProduct
);

router.delete(
  "/:id",
  protect,
  restrictTo("vendor", "admin"),
  productController.deleteProduct
);

module.exports = router;