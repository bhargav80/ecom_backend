const express = require("express");
const reviewController = require("../controllers/reviewController");
const { protect,restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .get(protect,reviewController.getAllReviews)
  .post(protect,restrictTo("customer"), reviewController.createReview);

router
  .route("/:id")
 .patch(protect,restrictTo("customer"), reviewController.updateReview)
.delete(protect, reviewController.deleteReview);

module.exports = router;