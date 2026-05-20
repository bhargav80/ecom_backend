const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const mongoose = require("mongoose");
const Product = require("./models/product");
const generateProducts = require("./utils/generateProduct");

const DB = process.env.DATABASE;
mongoose.connect(DB, {
    family: 4, // Force IPv4
  })
  .then(async () => {
    console.log("DB Connected");

    const vendorId = "699a05f532c932a1f53471e4";

    const products = generateProducts(20, vendorId);

    await Product.insertMany(products);

    console.log("Products inserted");
    process.exit();
  })
  .catch(err => {
    console.log(err);
    process.exit(1);
  });