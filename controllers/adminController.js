const User = require("../models/user");
const Product = require("../models/product");
const Order = require("../models/orderModel");
const VendorTransaction = require("../models/vendorTransaction");

const buildDateRangeFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return null;

  const filter = {};

  if (startDate) {
    const parsedStart = new Date(startDate);

    if (!Number.isNaN(parsedStart.getTime())) {
      filter.$gte = parsedStart;
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);

    if (!Number.isNaN(parsedEnd.getTime())) {
      parsedEnd.setHours(23, 59, 59, 999);

      filter.$lte = parsedEnd;
    }
  }

  return Object.keys(filter).length ? filter : null;
};

const formatCurrency = (value) =>
  Number((value || 0).toFixed(2));


exports.getAdminDashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      totalVendors,
      totalProducts,
      totalOrders,
      lowStockProducts,
      recentOrders,
      transactions,
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),

      User.countDocuments({ role: "vendor" }),

      Product.countDocuments(),

      Order.countDocuments(),

      Product.find({ stock: { $lte: 5 } })
        .select("name stock category price")
        .limit(10)
        .sort({ stock: 1 }),

      Order.find()
        .populate("user", "userName email")
        .sort({ createdAt: -1 })
        .limit(10),

      VendorTransaction.find({
        status: { $ne: "cancelled" },
      }),
    ]);

    let totalRevenue = 0;
    let pendingPayouts = 0;

    const monthlyRevenueMap = new Map();

    transactions.forEach((transaction) => {
      const amount = transaction.amount || 0;

      totalRevenue += amount;

      if (transaction.status === "pending") {
        pendingPayouts += amount;
      }

      const date = new Date(transaction.createdAt);

      const month = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      monthlyRevenueMap.set(
        month,
        (monthlyRevenueMap.get(month) || 0) + amount
      );
    });

    const monthlyRevenue = Array.from(
      monthlyRevenueMap.entries()
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, revenue]) => ({
        month,
        revenue: formatCurrency(revenue),
      }));

    return res.status(200).json({
      success: true,

      stats: {
        totalUsers,
        totalVendors,
        totalProducts,
        totalOrders,
        totalRevenue: formatCurrency(totalRevenue),
        pendingPayouts: formatCurrency(pendingPayouts),
      },

      monthlyRevenue,

      lowStockProducts,

      recentOrders,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard",
    });
  }
};



exports.getAllVendors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
    } = req.query;

    const filter = {
      role: "vendor",
    };

    if (search) {
      filter.$or = [
        {
          userName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          businessName: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (status === "approved") {
      filter.isApproved = true;
    }

    if (status === "pending") {
      filter.isApproved = false;
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const [vendors, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,

      vendors,

      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get vendors error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendors",
    });
  }
};

exports.updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      isApproved,
      isBlocked,
    } = req.body;

    const vendor = await User.findById(id);

    if (!vendor || vendor.role !== "vendor") {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    if (typeof isApproved === "boolean") {
      vendor.isApproved =
        isVendorApproved;
    }

    if (typeof isBlocked === "boolean") {
      vendor.isBlocked =
        isBlocked;
    }

    await vendor.save();

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      vendor,
    });
  } catch (error) {
    console.error("Update vendor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update vendor",
    });
  }
};



exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category,
      approvalStatus,
    } = req.query;

    const filter = {};

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i",
      };
    }

    if (category) {
      filter.category = category;
    }

    if (approvalStatus) {
      filter.approvalStatus =
        approvalStatus;
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const [products, total] =
      await Promise.all([
        Product.find(filter)
          .populate(
            "vendor",
            "userName businessName email"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),

        Product.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,

      products,

      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};



exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await product.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};



exports.getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      orderStatus,
      paymentStatus,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus) {
      filter.paymentStatus =
        paymentStatus;
    }

    const createdAtFilter =
      buildDateRangeFilter(
        startDate,
        endDate
      );

    if (createdAtFilter) {
      filter.createdAt =
        createdAtFilter;
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const [orders, total] =
      await Promise.all([
        Order.find(filter)
          .populate(
            "user",
            "userName email"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),

        Order.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,

      orders,

      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

exports.updateOrderStatus = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const {
      orderStatus,
      paymentStatus,
    } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (orderStatus) {
      order.orderStatus =
        orderStatus;
    }

    if (paymentStatus) {
      order.paymentStatus =
        paymentStatus;
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order,
    });
  } catch (error) {
    console.error(
      "Update order status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update order",
    });
  }
};

/* =========================================================
    PAYOUT MANAGEMENT
========================================================= */

exports.getAllPayouts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const [payouts, total] =
      await Promise.all([
        VendorTransaction.find(filter)
          .populate(
            "vendor",
            "userName businessName email"
          )
          .populate(
            "order",
            "paymentStatus orderStatus"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),

        VendorTransaction.countDocuments(
          filter
        ),
      ]);

    return res.status(200).json({
      success: true,

      payouts,

      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get payouts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payouts",
    });
  }
};

exports.settlePayout = async (req, res) => {
  try {
    const { id } = req.params;

    const payout =
      await VendorTransaction.findById(id);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found",
      });
    }

    payout.status = "settled";

    await payout.save();

    return res.status(200).json({
      success: true,
      message: "Payout settled successfully",
      payout,
    });
  } catch (error) {
    console.error("Settle payout error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to settle payout",
    });
  }
};

/* =========================================================
   6. USER MANAGEMENT
========================================================= */

exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

    const filter = {
      role: "customer",
    };

    if (search) {
      filter.$or = [
        {
          userName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const [users, total] =
      await Promise.all([
        User.find(filter)
          .select("-password")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),

        User.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,

      users,

      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

exports.toggleUserBlock = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isBlocked = !user.isBlocked;

    await user.save();

    return res.status(200).json({
      success: true,
      message: `User ${
        user.isBlocked
          ? "blocked"
          : "unblocked"
      } successfully`,
      user,
    });
  } catch (error) {
    console.error(
      "Toggle user block error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

/* =========================================================
   7. PLATFORM ANALYTICS
========================================================= */

exports.getAdminAnalytics = async (
  req,
  res
) => {
  try {
    const { range = "all" } = req.query;

    const transactionFilter = {};

    if (range !== "all") {
      const now = new Date();

      let months = 0;

      if (range === "3m") months = 3;
      if (range === "6m") months = 6;
      if (range === "12m") months = 12;

      if (months > 0) {
        const startDate = new Date();

        startDate.setMonth(
          now.getMonth() - months
        );

        transactionFilter.createdAt = {
          $gte: startDate,
          $lte: now,
        };
      }
    }

    const transactions =
      await VendorTransaction.find(
        transactionFilter
      )
        .populate("product", "category")
        .populate(
          "order",
          "orderStatus"
        );

    let totalRevenue = 0;
    let totalOrders = 0;

    const monthlyRevenueMap = new Map();
    const categoryMap = new Map();
    const orderStatusMap = new Map();

    const orderIds = new Set();

    transactions.forEach((transaction) => {
      if (
        transaction.status === "cancelled"
      ) {
        return;
      }

      const amount =
        transaction.amount || 0;

      totalRevenue += amount;

      if (transaction.order?._id) {
        orderIds.add(
          transaction.order._id.toString()
        );

        const status =
          transaction.order.orderStatus ||
          "processing";

        orderStatusMap.set(
          status,
          (orderStatusMap.get(status) || 0) +
            1
        );
      }

      const month = new Date(
        transaction.createdAt
      ).toLocaleString("default", {
        month: "short",
      });

      monthlyRevenueMap.set(
        month,
        (monthlyRevenueMap.get(month) || 0) +
          amount
      );

      const category =
        transaction.product?.category;

      if (category) {
        categoryMap.set(
          category,
          (categoryMap.get(category) || 0) +
            amount
        );
      }
    });

    totalOrders = orderIds.size;

    const revenueTrend = Array.from(
      monthlyRevenueMap.entries()
    ).map(([month, revenue]) => ({
      month,
      revenue: formatCurrency(revenue),
    }));

    const categoryPerformance =
      Array.from(categoryMap.entries()).map(
        ([name, revenue]) => ({
          name,
          revenue: formatCurrency(revenue),
        })
      );

    const orderMix = Array.from(
      orderStatusMap.entries()
    ).map(([status, value]) => ({
      status,
      value,
    }));

    return res.status(200).json({
      success: true,

      stats: {
        totalRevenue:
          formatCurrency(totalRevenue),

        totalOrders,
      },

      revenueTrend,

      categoryPerformance,

      orderMix,
    });
  } catch (error) {
    console.error(
      "Admin analytics error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch admin analytics",
    });
  }
};