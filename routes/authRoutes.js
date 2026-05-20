const express = require("express");
const authController = require("../controllers/authController");
const { protect,restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/me",protect,authController.getMe);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.patch("/update-me", protect, authController.updateMe);
router.patch("/update-password", protect, authController.updatePassword);
router.post("/logout",protect,authController.logout);
router.post("/register-vendor",authController.registerVendor);
router.post("/refresh-token", authController.refreshToken);
router.patch("/approve-vendor/:id",protect,restrictTo("admin"),authController.approveVendor);

module.exports =router;