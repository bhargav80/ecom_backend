const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const mongoose = require("mongoose");
const Product = require("./models/product");

async function migrateImages() {
  try {
    const DB = process.env.DATABASE;
//console.log("DB:", process.env.DATABASE);
mongoose
  .connect(DB, {
    family: 4, // Force IPv4
  })
  .then(async () => {
    (console.log("DB Connection Successful"));
  })
  .catch((err) => console.log("DB Connection Error:", err));
    console.log("DB connected");

    const products = await Product.find();

    for (const product of products) {
      if (
        product.images &&
        product.images.length > 0 &&
        typeof product.images[0] === "string"
      ) {
        product.images = product.images.map(url => ({
          url,
          public_id: null, // old images don't have this
        }));

        await product.save();
        console.log(`Updated product: ${product._id}`);
      }
    }

    console.log("✅ Migration completed");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrateImages();