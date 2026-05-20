const express = require("express");
const orderController = require("../controllers/orderController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/webhook/cashfree/refund",
  express.raw({ type: "application/json" }),
  orderController.cashfreeRefundWebhook
);
router.get("/my-orders", protect, orderController.getMyOrders);
router.post("/checkout", protect, orderController.checkout);
router.patch("/:id/status",protect, restrictTo("admin"),orderController.updateOrderStatus);
router.put("/:orderId/cancel",protect,orderController.cancelOrder);
router.get("/:id",protect,orderController.getOrder);


module.exports = router;

