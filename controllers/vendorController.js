const Product = require("../models/product");
const VendorTransaction = require("../models/vendorTransaction");

const buildDateRangeFilter = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return null;
  }

  const dateFilter = {};

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!Number.isNaN(parsedStart.getTime())) {
      dateFilter.$gte = parsedStart;
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!Number.isNaN(parsedEnd.getTime())) {
      parsedEnd.setHours(23, 59, 59, 999);
      dateFilter.$lte = parsedEnd;
    }
  }

  return Object.keys(dateFilter).length ? dateFilter : null;
};

const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatCurrency = (value) => Number((value || 0).toFixed(2));



exports.getVendorDashboard = async (req, res) => {
  try {
    const vendorId = req.user._id;

    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      transactions,
      recentTransactions,
    ] = await Promise.all([
      Product.countDocuments({ vendor: vendorId }),
      Product.countDocuments({ vendor: vendorId, stock: { $gt: 0 } }),
      Product.find({ vendor: vendorId, stock: { $lte: 5 } })
        .select("name stock category price")
        .sort({ stock: 1, createdAt: -1 })
        .limit(5),
      VendorTransaction.find({ vendor: vendorId })
        .populate("order", "paymentStatus orderStatus createdAt")
        .populate("product", "name category")
        .sort({ createdAt: -1 }),
      VendorTransaction.find({ vendor: vendorId })
        .populate("order", "paymentStatus orderStatus createdAt")
        .populate("product", "name category")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const summary = transactions.reduce(
      (acc, transaction) => {
        const amount = transaction.amount || 0;

        acc.totalOrders += 1;

        if (transaction.type === "credit") {
          acc.totalRevenue += amount;
        } else if (transaction.type === "debit") {
          acc.totalDebits += amount;
        }

        if (transaction.status === "pending") {
          acc.pendingBalance += amount;
        }

        if (transaction.status === "settled") {
          acc.settledBalance += amount;
        }

        if (transaction.status === "cancelled") {
          acc.cancelledTransactions += 1;
        }

        return acc;
      },
      {
        totalOrders: 0,
        totalRevenue: 0,
        totalDebits: 0,
        pendingBalance: 0,
        settledBalance: 0,
        cancelledTransactions: 0,
      },
    );

    const monthlyRevenueMap = new Map();

    transactions.forEach((transaction) => {
      if (transaction.type !== "credit" || transaction.status === "cancelled") {
        return;
      }

      const date = new Date(transaction.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const currentValue = monthlyRevenueMap.get(key) || 0;

      monthlyRevenueMap.set(
        key,
        Number((currentValue + (transaction.amount || 0)).toFixed(2)),
      );
    });

    const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue }));

    return res.status(200).json({
      status: "success",
      dashboard: {
        vendor: {
          id: req.user._id,
          userName: req.user.userName,
          email: req.user.email,
          businessName: req.user.businessName,
        },
        stats: {
          totalProducts,
          activeProducts,
          lowStockCount: lowStockProducts.length,
          totalOrders: summary.totalOrders,
          totalRevenue: Number(summary.totalRevenue.toFixed(2)),
          totalDebits: Number(summary.totalDebits.toFixed(2)),
          pendingBalance: Number(summary.pendingBalance.toFixed(2)),
          settledBalance: Number(summary.settledBalance.toFixed(2)),
          cancelledTransactions: summary.cancelledTransactions,
        },
        monthlyRevenue,
        lowStockProducts,
        recentTransactions,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// controllers/productController.js

exports.getVendorProducts = async (req, res) => {
  try {
    const vendorId = req.user._id;

   
    const {
      page = 1,
      limit = 10,
      search = "",
      category,
      minPrice,
      maxPrice,
      inStock,
      sort = "createdAt", 
      order = "desc",
    } = req.query;

   
    let filter = {
      vendor: vendorId,
    };

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i", 
      };
    }

  
    if (category) {
      filter.category = category;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (inStock === "true") {
      filter.stock = { $gt: 0 };
    }

    const sortOption = {
      [sort]: order === "asc" ? 1 : -1,
    };


    const skip = (Number(page) - 1) * Number(limit);

   
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit)),

      Product.countDocuments(filter),
    ]);

   
    res.status(200).json({
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
    console.error("Vendor products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor products",
    });
  }
};

exports.getVendorOrders = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const skip = (page - 1) * limit;
    const { search = "", orderStatus, paymentStatus, status, startDate, endDate } =
      req.query;

    const filter = { vendor: vendorId };
    const transactionStatus =
      status && ["pending", "settled", "cancelled"].includes(status)
        ? status
        : null;
    const createdAtFilter = buildDateRangeFilter(startDate, endDate);

    if (transactionStatus) {
      filter.status = transactionStatus;
    }

    if (createdAtFilter) {
      filter.createdAt = createdAtFilter;
    }

    const transactions = await VendorTransaction.find(filter)
      .populate({
        path: "order",
        select:
          "user totalPrice shippingAddress paymentMethod paymentStatus orderStatus createdAt updatedAt",
        populate: {
          path: "user",
          select: "userName email",
        },
      })
      .populate("product", "name category images")
      .sort({ createdAt: -1 });

    const groupedOrders = new Map();

    transactions.forEach((transaction) => {
      if (!transaction.order) {
        return;
      }

      const orderId = transaction.order._id.toString();
      const existingOrder = groupedOrders.get(orderId);

      if (!existingOrder) {
        groupedOrders.set(orderId, {
          _id: transaction.order._id,
          orderId: transaction.order._id,
          customer: transaction.order.user || null,
          shippingAddress: transaction.order.shippingAddress,
          paymentMethod: transaction.order.paymentMethod,
          paymentStatus: transaction.order.paymentStatus,
          orderStatus: transaction.order.orderStatus,
          totalPrice: transaction.order.totalPrice,
          vendorRevenue: 0,
          vendorQuantity: 0,
          itemCount: 0,
          transactionStatusCounts: {
            pending: 0,
            settled: 0,
            cancelled: 0,
          },
          items: [],
          createdAt: transaction.order.createdAt,
          updatedAt: transaction.order.updatedAt,
        });
      }

      const currentOrder = groupedOrders.get(orderId);

      currentOrder.vendorRevenue += transaction.amount || 0;
      currentOrder.vendorQuantity += transaction.quantity || 0;
      currentOrder.itemCount += 1;

      if (currentOrder.transactionStatusCounts[transaction.status] !== undefined) {
        currentOrder.transactionStatusCounts[transaction.status] += 1;
      }

      currentOrder.items.push({
        transactionId: transaction._id,
        product: transaction.product,
        productName: transaction.productName,
        productPrice: transaction.productPrice,
        quantity: transaction.quantity,
        amount: formatCurrency(transaction.amount || 0),
        type: transaction.type,
        status: transaction.status,
        createdAt: transaction.createdAt,
      });
    });

    let orders = Array.from(groupedOrders.values()).map((order) => ({
      ...order,
      vendorRevenue: formatCurrency(order.vendorRevenue),
    }));

    if (orderStatus) {
      orders = orders.filter((order) => order.orderStatus === orderStatus);
    }

    if (paymentStatus) {
      orders = orders.filter((order) => order.paymentStatus === paymentStatus);
    }

    if (search) {
      const query = search.trim().toLowerCase();
      orders = orders.filter((order) => {
        const searchableValues = [
          order._id?.toString(),
          order.customer?.userName,
          order.customer?.email,
          ...order.items.map((item) => item.productName),
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        return searchableValues.some((value) => value.includes(query));
      });
    }

    const total = orders.length;
    const paginatedOrders = orders.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      orders: paginatedOrders,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error("Vendor orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendor orders",
    });
  }
};

exports.getVendorAnalytics = async (req, res) => {
  try {
    const vendorId = req.user._id;
    
    const { range = "all" } = req.query;
   

    const filter = { vendor: vendorId };

   if (range !== "all") {
      const now = new Date();

      let months = 0;

      if (range === "3m") months = 3;
      if (range === "6m") months = 6;
      if (range === "12m") months = 12;

      if (months > 0) {
        const startDate = new Date();

        startDate.setMonth(now.getMonth() - months);

        filter.createdAt = {
          $gte: startDate,
          $lte: now,
        };
      }
    }

    const [transactions, totalProducts] = await Promise.all([
      VendorTransaction.find(filter)
        .populate("order", "paymentStatus orderStatus createdAt")
        .populate("product", "name category"),
      Product.countDocuments({ vendor: vendorId }),
    ]);

    let totalRevenue = 0;
    let totalOrders = 0;
    let totalItemsSold = 0;
    let repeatOrders = 0;

    const orderIds = new Set();
    const customerOrders = new Map();
    const monthlyRevenueMap = new Map();
    const categoryMap = new Map();
    const productSalesMap = new Map();
    const orderStatusMap = new Map();

    transactions.forEach((transaction) => {
      const amount = Number(transaction.amount || 0);
      const quantity = Number(transaction.quantity || 0);

      const order = transaction.order;
      const product = transaction.product;

      totalItemsSold += quantity;

      
      if (transaction.status !== "cancelled") {
        totalRevenue += amount;
      }

    
      if (order?._id) {
        const orderId = order._id.toString();

        if (!orderIds.has(orderId)) {
          orderIds.add(orderId);

         
          const status = order.orderStatus || "processing";

          orderStatusMap.set(
            status,
            (orderStatusMap.get(status) || 0) + 1
          );
        }
      }

    
      const date = order?.createdAt || transaction.createdAt;

      if (date && transaction.status !== "cancelled") {
        const month = new Date(date).toLocaleString("default", {
          month: "short",
        });

        const existing = monthlyRevenueMap.get(month) || {
          label: month,
          revenue: 0,
          orders: 0,
        };

        existing.revenue += amount;
        existing.orders += 1;

        monthlyRevenueMap.set(month, existing);
      }

     
      if (product?.category && transaction.status !== "cancelled") {
        const category = product.category;

        categoryMap.set(
          category,
          (categoryMap.get(category) || 0) + amount
        );
      }

     
      if (product) {
        const productId = product._id.toString();

        const existingProduct = productSalesMap.get(productId) || {
          name: product.name,
          revenue: 0,
          sold: 0,
        };

        if (transaction.status !== "cancelled") {
          existingProduct.revenue += amount;
        }

        existingProduct.sold += quantity;

        productSalesMap.set(productId, existingProduct);
      }

      const customerId = transaction.customer?.toString();

      if (customerId) {
        customerOrders.set(
          customerId,
          (customerOrders.get(customerId) || 0) + 1
        );
      }
    });

    totalOrders = orderIds.size;

    customerOrders.forEach((count) => {
      if (count > 1) {
        repeatOrders++;
      }
    });

    const repeatCustomerRate =
      customerOrders.size > 0
        ? Number(
            ((repeatOrders / customerOrders.size) * 100).toFixed(1)
          )
        : 0;

    const averageOrderValue =
      totalOrders > 0
        ? Number((totalRevenue / totalOrders).toFixed(2))
        : 0;

    
    const revenueTrend = Array.from(monthlyRevenueMap.values());

   
    const categoryPerformance = Array.from(categoryMap.entries()).map(
      ([name, revenue]) => ({
        name,
        revenue,
        share:
          totalRevenue > 0
            ? Number(((revenue / totalRevenue) * 100).toFixed(1))
            : 0,
      })
    );

   
    const orderMix = Array.from(orderStatusMap.entries()).map(
      ([status, value], index) => {
        const tones = ["blue", "emerald", "amber", "rose"];

        return {
          label: status,
          value,
          tone: tones[index % tones.length],
        };
      }
    );

  
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return res.status(200).json({
      stats: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        repeatCustomerRate,
        fulfillmentRate: 94,
        conversionRate: 3.8,
        totalProducts,
        totalItemsSold,
      },

      revenueTrend,
      categoryPerformance,
      orderMix,
      topProducts,
    });
  } catch (error) {
    console.error("Vendor analytics error:", error);

    return res.status(500).json({
      message: "Failed to fetch vendor analytics",
    });
  }
};