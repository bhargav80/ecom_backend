const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product must have a name"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product must have a description"],
    },
    price: {
      type: Number,
      required: [true, "Product must have a price"],
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    category: {
      type: String,
      required: true,
      lowercase: true,
    },
    images: [{url:String,public_id:String,}],
    ratingsAverage: {
      type: Number,
      min: 1,
      max: 5,
      default: 4.5,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
