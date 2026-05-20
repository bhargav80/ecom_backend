const Product = require("../models/product");
const cloudinary = require("../config/cloudinary");
exports.createProduct = async (req, res) => {
  try {
    console.log(req.files);
    console.log(req.body);

    // Match the schema: [{ url, public_id }]
    const imageUrls = req.files?.length
      ? req.files.map(file => ({
          url: file.path,        // Cloudinary gives URL in file.path
          public_id: file.filename, // Cloudinary gives public_id in file.filename
        }))
      : [];

    const product = await Product.create({
      name: req.body.name,
      category: req.body.category,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      description: req.body.description,
      isActive: req.body.isActive === 'true',
      images: imageUrls,
      vendor: req.user._id,
    });

    res.status(201).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const queryObj = { ...req.query };
    const excludedFields = ["page", "sort", "limit", "search"];
    excludedFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
console.log("Query Object:", JSON.parse(queryStr));
    //let query = Product.find(JSON.parse(queryStr));
    const filter = JSON.parse(queryStr);

// Automatically make string filters more flexible
Object.keys(filter).forEach(key => {
  if (typeof filter[key] === 'string') {
    filter[key] = { $regex: `^${filter[key].trim()}$`, $options: 'i' };
  }
});

let query = Product.find(filter);
    
    if (req.query.search) {
      query = query.find({
        name: { $regex: req.query.search, $options: "i" },
      });
    }

    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

     const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);
    const products = await query.populate("vendor", "userName email");
    res.status(200).json({
      results: products.length,
      page,
      data: products,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id).populate(
    "vendor",
    "name email",
  );

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.status(200).json({ data: product });
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  //console.log(req.user._id);
  if (
    req.user.role === "vendor" &&
    product.vendor.toString() != req.user._id.toString()
  ) {
    return res.status(403).json({
      message: "You can only edit your own products",
    });
  }

  if (req.body.removeImages) {
      const removeImages = JSON.parse(req.body.removeImages);

      for (const img of removeImages) {
        if (img.public_id) {
          await cloudinary.uploader.destroy(img.public_id);
        }
      }

      product.images = product.images.filter(
        (img) =>
          !removeImages.some((r) => r.public_id === img.public_id)
      );
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        url: file.path,
        public_id: file.filename,
      }));

      product.images.push(...newImages);
    }

const { name, price, description, category, stock } = req.body;

    if (name) product.name = name;
    if (price) product.price = price;
    if (description) product.description = description;
    if (category) product.category = category;
    if (stock) product.stock = stock;
   const updated = await product.save();
  res.status(200).json({ data: updated });
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (
    req.user.role === "vendor" &&
    product.vendor.toString() != req.user._id.toString()
  ) {
    return res.status(403).json({
      message: "You can only delete your own products",
    });
  }
  await Product.findByIdAndDelete(req.params.id);
  res.status(200).json({ message: "Successfully deleted" });
};
