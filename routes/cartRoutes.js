const express = require("express");
const cartController = require("../controllers/cartController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .get(protect, restrictTo("customer"), cartController.getCart)
  .post(protect, restrictTo("customer"), cartController.addToCart)
  .delete(protect, restrictTo("customer"), cartController.clearCart);

router
  .route("/:productId")
  .patch(protect, restrictTo("customer"), cartController.updateCartItem)
  .delete(protect, restrictTo("customer"), cartController.removeCartItem);

module.exports = router;
