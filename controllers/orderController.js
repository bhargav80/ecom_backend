const mongoose = require("mongoose");
const axios = require("axios");
const crypto = require("crypto");
const Product = require("../models/product");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const VendorTransaction = require("../models/vendorTransaction");

// exports.cashfreeWebhook = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     console.log("🔥 Webhook HIT");

//     const signature = req.headers["x-webhook-signature"];
//     const payload = req.body.toString();
//     const data = JSON.parse(payload);
//     console.log("FULL WEBHOOK DATA:", JSON.stringify(data, null, 2))
//     if (data?.data?.test_object) {
//       console.log("🧪 Test webhook received");
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(200).send("OK");
//     }

//     const timestamp = req.headers["x-webhook-timestamp"];
//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
//       .update(timestamp + payload)
//       .digest("base64");

//     if (signature !== expectedSignature) {
//       throw new Error("Invalid webhook signature");
//     }

//     const { order_id } = data.data.order;
//     const paymentStatus = data.data.payment?.payment_status;
// const eventType = data.type;
//     console.log("Event:", eventType);
// console.log("Payment status:", paymentStatus);
//     if (paymentStatus !== "SUCCESS") {
//   await session.abortTransaction();
//   session.endSession();
//   return res.status(200).json({ message: "Ignored" });
// }

//     const order = await Order.findOne({ _id: order_id })
//       .populate("orderItems.product")
//       .session(session);

//     if (!order) {
//       throw new Error("Order not found");
//     }

//     if (order.paymentStatus === "paid") {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(200).json({ message: "Already processed" });
//     }

//     order.paymentStatus = "paid";
//     await order.save({ session });
//     console.log("✅ Payment status updated");
//     for (const item of order.orderItems) {
//       const product = item.product;
//       if (!product) {
//         throw new Error(`Product not found for item: ${item.productName}`);
//       }
//       if (product.stock < item.quantity) {
//         throw new Error(`${product.name} out of stock`);
//       }

//       product.stock -= item.quantity;
//       await product.save({ session });

//       const total = item.price * item.quantity;
//       const platformFee = total * 0.1;
//       const vendorAmount = total - platformFee;

//       await VendorTransaction.create(
//         [
//           {
//             vendor: product.vendor,
//             order: order._id,
//             product: product._id,
//             productName: item.productName,
//             productPrice: item.price,
//             quantity: item.quantity,
//             amount: vendorAmount,
//             type: "credit",
//           },
//         ],
//         { session },
//       );console.log(`✅ Vendor transaction created for ${item.productName}`);
//     }

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({ message: "Webhook processed" });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();

//     console.error("Webhook error:", error.message);

//     res.status(200).send("OK");
//   }
// };

exports.cashfreeWebhook = async (req, res) => {
  try {
    console.log("🔥 Webhook HIT");

    const payload = req.body.toString();
    const data = JSON.parse(payload);

    if (data?.data?.test_object) {
      return res.status(200).send("OK");
    }

    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const expectedSignature = crypto
      .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
      .update(timestamp + payload)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.error("❌ Signature mismatch");
      return res.status(200).send("OK");
    }

    const eventType = data.type;
    const { order_id } = data.data.order;
    const paymentStatus = data.data.payment?.payment_status;

    console.log("Event:", eventType, "| Payment:", paymentStatus);

    if (paymentStatus !== "SUCCESS") {
      return res.status(200).json({ message: "Ignored" });
    }

    // ✅ Idempotency check OUTSIDE transaction — prevents race condition
    const existingOrder = await Order.findOne({ _id: order_id });
    if (!existingOrder) {
      console.error(`Order not found: ${order_id}`);
      return res.status(200).send("OK");
    }

    if (existingOrder.paymentStatus === "paid") {
      console.log("Already processed, skipping");
      return res.status(200).json({ message: "Already processed" });
    }

    // ✅ Retry loop — handles write conflicts
    let attempts = 0;
    const MAX_RETRIES = 3;

    while (attempts < MAX_RETRIES) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const order = await Order.findOne({ _id: order_id })
          .populate("orderItems.product")
          .session(session);

        if (!order) throw new Error("Order not found in transaction");

        if (order.paymentStatus === "paid") {
          await session.abortTransaction();
          session.endSession();
          return res.status(200).json({ message: "Already processed" });
        }

        order.paymentStatus = "paid";
        await order.save({ session });

        for (const item of order.orderItems) {
          const product = item.product;

          if (!product) throw new Error(`Product missing: ${item.productName}`);
          if (product.stock < item.quantity)
            throw new Error(`${product.name} out of stock`);

          product.stock -= item.quantity;
          await product.save({ session });

          const total = item.price * item.quantity;
          const vendorAmount = total - total * 0.1;

          await VendorTransaction.create(
            [
              {
                vendor: product.vendor,
                order: order._id,
                product: product._id,
                productName: item.productName,
                productPrice: item.price,
                quantity: item.quantity,
                amount: vendorAmount,
                type: "credit",
              },
            ],
            { session },
          );
        }
        await Cart.findOneAndUpdate(
          { user: order.user },
          { $set: { items: [] } },
          { session, new: true },
        );
        await session.commitTransaction();
        session.endSession();
        console.log("✅ Webhook fully processed");
        return res.status(200).json({ message: "Webhook processed" });
      } catch (err) {
        await session.abortTransaction();
        session.endSession();

        if (
          err.message?.includes("Write conflict") &&
          attempts < MAX_RETRIES - 1
        ) {
          attempts++;
          console.log(
            `⚠️ Write conflict, retrying... (${attempts}/${MAX_RETRIES})`,
          );
          await new Promise((r) => setTimeout(r, 100 * attempts)); // backoff
          continue;
        }

        throw err;
      }
    }
  } catch (error) {
    console.error("❌ Webhook error:", error.message);
    return res.status(200).send("OK");
  }
};

exports.checkout = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate("items.product")
      .session(session);

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    let totalPrice = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product) {
        throw new Error("Product not found");
      }

      if (product.stock < item.quantity) {
        throw new Error(`${product.name} out of stock`);
      }

      totalPrice += product.price * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,

        productName: product.name,
      });
    }

    const order = await Order.create(
      [
        {
          user: req.user._id,
          orderItems,
          totalPrice,
          shippingAddress: req.body.shippingAddress,
          paymentMethod: req.body.paymentMethod,
          paymentStatus: "pending",
        },
      ],
      { session },
    );
    const createdOrder = order[0];

    if (req.body.paymentMethod === "COD") {
      for (const item of cart.items) {
        const product = item.product;

        product.stock -= item.quantity;
        await product.save({ session });

        const total = product.price * item.quantity;
        const platformFee = total * 0.1;
        const vendorAmount = total - platformFee;

        await VendorTransaction.create(
          [
            {
              vendor: product.vendor._id,
              order: order[0]._id,
              product: product._id,
              productName: product.name,
              productPrice: product.price,
              quantity: item.quantity,
              amount: vendorAmount,
              type: "credit",
            },
          ],
          { session },
        );
      }

      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        message: "COD Order placed successfully",
        order: createdOrder,
      });
    }

    //Online Payment Flow
    if (req.body.paymentMethod !== "COD") {
      //       console.log("APP ID:", process.env.CASHFREE_APP_ID);
      // console.log("SECRET:", process.env.CASHFREE_SECRET_KEY);
      //       console.log("URL:", `${process.env.CASHFREE_BASE_URL}/orders`);
      const cfOrder = await axios.post(
        `${process.env.CASHFREE_BASE_URL}/orders`,
        {
          order_id: createdOrder._id.toString(),
          order_amount: totalPrice,
          order_currency: "INR",
          customer_details: {
            customer_id: req.user._id.toString(),
            customer_email: req.user.email || "test@gmail.com",
            customer_phone: req.user.phone || "9999999999",
          },
          order_meta: {
            notify_url:
              "https://a0a4-2409-40e6-137-1afa-b56e-494e-b8e-8c08.ngrok-free.app/api/paymentRoutes/webhook/cashfree",
            return_url:
              "http://localhost:5173/payment-status?order_id={order_id}",
          },
        },
        {
          headers: {
            "x-client-id": process.env.CASHFREE_APP_ID,
            "x-client-secret": process.env.CASHFREE_SECRET_KEY,
            "x-api-version": "2023-08-01",
            "Content-Type": "application/json",
          },
        },
      );

      //console.log("RAW Cashfree response:", JSON.stringify(cfOrder.data, null, 2))
      //console.log(cfOrder.data);
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        message: "Proceed to payment",
        paymentSessionId: cfOrder.data.payment_session_id,
        orderId: createdOrder._id,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalOrders = await Order.countDocuments({ user: req.user._id });

    const orders = await Order.find({ user: req.user._id })
      .populate("orderItems.product")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      page,
      totalPages: Math.ceil(totalOrders / limit),
      results: orders.length,
      totalOrders,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("orderItems.product")
      .populate("user", "userName email");
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (
      order.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    res.status(200).json({
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    order.orderStatus = status;

    await order.save();

    res.status(200).json({
      message: "Order status updated",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId } = req.params;
    const isAdmin = req.user.role === "admin";
    const order = await Order.findById(orderId)
      .populate("orderItems.product")
      .session(session);

    if (!order) throw new Error("Order not found");

    if (!isAdmin && order.user.toString() !== req.user._id.toString()) {
      throw new Error("Unauthorized");
    }

    if (order.orderStatus !== "processing") {
      throw new Error(
        `Order cannot be cancelled. Current status: ${order.orderStatus}`,
      );
    }
    for (const item of order.orderItems) {
      const product = item.product;
      if (!product) continue;

      product.stock += item.quantity;
      await product.save({ session });
    }

    await VendorTransaction.updateMany(
      { order: order._id },
      { $set: { status: "cancelled" } },
      { session },
    );

    if (order.paymentStatus === "paid" && order.paymentMethod !== "COD") {
      const refundId = `refund_${orderId}_${Date.now()}`;

      try {
        // ✅ Fetch actual paid amount from Cashfree first
        const orderRes = await axios.get(
          `${process.env.CASHFREE_BASE_URL}/orders/${orderId}`,
          {
            headers: {
              "x-client-id": process.env.CASHFREE_APP_ID,
              "x-client-secret": process.env.CASHFREE_SECRET_KEY,
              "x-api-version": "2023-08-01",
            },
          },
        );

        const cfOrder = orderRes.data;
        console.log("💸 Cashfree order:", cfOrder);

        // ✅ Use Cashfree's amount, not your DB totalPrice
        const refundAmount = Math.round(cfOrder.order_amount * 100) / 100;
        console.log(
          "💸 Refund amount:",
          refundAmount,
          "| DB total:",
          order.totalPrice,
        );
        const refundUrl = `${process.env.CASHFREE_BASE_URL}/orders/${orderId}/refunds`;
        console.log("🔗 Refund URL:", refundUrl);
        const refundRes = await axios.post(
          `${process.env.CASHFREE_BASE_URL}/orders/${orderId}/refunds`,
          {
            refund_amount: refundAmount,
            refund_id: refundId,
            refund_note:
              process.env.NODE_ENV === "production"
                ? "Order cancelled by " + (isAdmin ? "admin" : "customer")
                : "SUCCESS",

            cf_payment_id: payment.cf_payment_id,
          },
          {
            headers: {
              "x-client-id": process.env.CASHFREE_APP_ID,
              "x-client-secret": process.env.CASHFREE_SECRET_KEY,
              "x-api-version": "2023-08-01",
              "Content-Type": "application/json",
            },
          },
        );

        console.log("✅ Refund initiated:", refundRes.data);
        order.paymentStatus = "refund_initiated";
        order.refundId = refundId;
      } catch (refundError) {
        console.error("❌ Refund API error:", refundError.response?.data);
        throw new Error(refundError.response?.data?.message || "Refund failed");
      }
    }
    order.orderStatus = "cancelled";
    order.cancelledBy = isAdmin ? "admin" : "user";
    order.cancelledAt = new Date();
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message:
        order.paymentStatus === "refund_initiated"
          ? "Order cancelled and refund initiated"
          : "Order cancelled successfully",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Cancel order error:", error.message);
    return res.status(400).json({ message: error.message });
  }
};

exports.cashfreeRefundWebhook = async (req, res) => {
  try {
    const payload = req.body.toString();
    const data = JSON.parse(payload);

    console.log("💸 Refund Webhook:", JSON.stringify(data, null, 2));

    // ✅ Verify signature
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const expectedSignature = crypto
      .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
      .update(timestamp + payload)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.error("❌ Invalid refund webhook signature");
      return res.status(200).send("OK");
    }

    const eventType = data.type; // "REFUND_SUCCESS_WEBHOOK"
    const refundStatus = data.data?.refund?.refund_status; // "SUCCESS"
    const orderId = data.data?.order?.order_id;

    console.log("Refund event:", eventType, "| Status:", refundStatus);

    if (refundStatus !== "SUCCESS") {
      return res.status(200).json({ message: "Ignored" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      console.error("Order not found:", orderId);
      return res.status(200).send("OK");
    }

    order.paymentStatus = "refunded";
    await order.save();

    console.log("✅ Refund marked as completed for order:", orderId);
    return res.status(200).json({ message: "Refund processed" });
  } catch (error) {
    console.error("❌ Refund webhook error:", error.message);
    return res.status(200).send("OK");
  }
};
