const Review = require("../models/reviewModel");

exports.createReview = async (req, res) => {
  try {
    const review = await Review.create({
      review: req.body.review,
      rating: req.body.rating,
      product: req.body.product,
      user: req.user._id,
    });

    res.status(201).json({
      status: "success",
      data: review,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateReview = async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return res.status(404).json({ message: "Review not found" });
  }

  if (review.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Not authorized" });
  }

  const updated = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ data: updated });
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("product");

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
      });
    }

    const userId = req.user._id.toString();
    const reviewOwner = review.user.toString();
    const productVendor = review.product.vendor.toString();

    if (req.user.role === "admin") {
      await Review.findByIdAndDelete(req.params.id);
    } else if (req.user.role === "customer") {
      if (reviewOwner !== userId) {
        return res.status(403).json({
          message: "You can only delete your own reviews",
        });
      }
      await Review.findByIdAndDelete(req.params.id);
    } else if (req.user.role === "vendor") {
      if (productVendor !== userId) {
        return res.status(403).json({
          message: "You can only delete reviews of your products",
        });
      }
      await Review.findByIdAndDelete(req.params.id);
    } else {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Review deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const queryObj = { ...req.query };
    const excludedFields = ["page", "sort", "limit"];
    excludedFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    const filter = JSON.parse(queryStr);

    let query = Review.find(filter).populate("user","userName")

    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);
    const reviews = await query;
    const total = await Review.countDocuments(filter);

    res.status(200).json({
      status: "success",
      totalReviews: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      results: reviews.length,
      data: reviews,
    });
  } catch (error) {
     res.status(400).json({
      message: error.message,
    })
  }
};
