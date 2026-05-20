const mongoose = require("mongoose");

const vendorTransactionSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  quantity: Number,

  amount: Number,
  productName: String,
  productPrice: Number,
  type: {
    type: String,
    enum: ["credit", "debit"],
  },

  status: {
    type: String,
    enum: ["pending", "settled","cancelled"],
    default: "pending",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});


module.exports = mongoose.model("VendorTransaction", vendorTransactionSchema);