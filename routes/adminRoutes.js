const express = require("express");

const router = express.Router();

const adminController = require("../controllers/adminController");

const { protect, restrictTo } = require("../middleware/authMiddleware");


router.get(
  "/dashboard",
  protect,
  restrictTo("admin"),
  adminController.getAdminDashboard
);



router.get(
  "/vendors",
  protect,
  restrictTo("admin"),
  adminController.getAllVendors
);

router.patch(
  "/vendors/:id/status",
  protect,
  restrictTo("admin"),
  adminController.updateVendorStatus
);



router.get(
  "/products",
  protect,
 restrictTo("admin"),
  adminController.getAllProducts
);



router.delete(
  "/products/:id",
  protect,
 restrictTo("admin"),
  adminController.deleteProduct
);


router.get(
  "/orders",
  protect,
  restrictTo("admin"),
  adminController.getAllOrders
);

router.patch(
  "/orders/:id/status",
  protect,
restrictTo("admin"),
  adminController.updateOrderStatus
);



router.get(
  "/payouts",
  protect,
  restrictTo("admin"),
  adminController.getAllPayouts
);

router.patch(
  "/payouts/:id/settle",
  protect,
  restrictTo("admin"),
  adminController.settlePayout
);



router.get(
  "/users",
  protect,
  restrictTo("admin"),
  adminController.getAllUsers
);

router.patch(
  "/users/:id/block",
  protect,
  restrictTo("admin"),
  adminController.toggleUserBlock
);



router.get(
  "/analytics",
  protect,
  restrictTo("admin"),
  adminController.getAdminAnalytics
);

module.exports = router;