const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products",
    format: "webp", 
    transformation: [
      { width: 500, height: 500, crop: "fill" },
      { quality: "auto" }, // compress
    ],
  },
});

const upload = multer({ storage });

module.exports = upload;