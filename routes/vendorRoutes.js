const express = require("express");
const vendorController = require("../controllers/vendorController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/dashboard",
  protect,
  restrictTo("vendor"),
  vendorController.getVendorDashboard,
);
router.get(
  "/products",
  protect,
  restrictTo("vendor"),
  vendorController.getVendorProducts,
);
router.get(
  "/orders",
  protect,
  restrictTo("vendor"),
  vendorController.getVendorOrders,
);
router.get(
  "/analytics",
  protect,
  restrictTo("vendor"),
  vendorController.getVendorAnalytics,
);

module.exports = router;
