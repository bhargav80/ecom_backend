const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const seedAdmin = require("./utils/seedAdmin");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const adminRoutes = require("./routes/adminRoutes");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

const app = express();

app.use(
  "/api/paymentRoutes/webhook/cashfree",
  express.raw({ type: "application/json" })
);
app.use(
  "/api/orders/webhook/cashfree/refund",
  express.raw({ type: "application/json" }),
  orderRoutes
);
app.use(cookieParser());
// app.use(
//   cors({
//     origin: ["http://localhost:5173", process.env.FRONTEND_URL],
//     credentials: true,
//     allowedHeaders: ["Content-Type", "Authorization"],
//   }),
// );

const allowedOrigins = [
  'http://localhost:3000',                  // Local React
  'http://localhost:5173',                  // Local Vite
  'https://ecom-frontend-gamma-ten.vercel.app' // Your Production Vercel Frontend
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true, // Crucial for passing HttpOnly cookies
  optionsSuccessStatus: 200 // Fixes preflight issues on older browsers/gateways
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("query parser", "extended");

const DB = process.env.DATABASE;
//console.log("DB:", process.env.DATABASE);
mongoose
  .connect(DB, {
    family: 4, // Force IPv4
  })
  .then(async () => {
    (console.log("DB Connection Successful"), await seedAdmin());
  })
  .catch((err) => console.log("DB Connection Error:", err));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/cart",cartRoutes);
app.use("/api/orders",orderRoutes);
app.use("/api/paymentRoutes",paymentRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/admin",adminRoutes);
app.get("/", (req, res) => {
  res.send("Backend Running");
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});
