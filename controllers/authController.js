const User = require("../models/user");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");
const crypto = require("crypto");

exports.register = async (req, res) => {
  try {
    const { userName, email, password, passwordConfirm } = req.body;
    const exisitngUser = await User.findOne({ email });
    if (exisitngUser)
      return res.status(400).json({ message: "Email already registered" });
    const user = await User.create({userName, email, password, passwordConfirm });
    const accessToken = authMiddleware.generateAccessToken(user);
    const refreshToken = authMiddleware.generateRefreshToken(user);
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    user.refreshToken = hashedRefreshToken;
    await user.save({ validateBeforeSave: false });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      //secure: process.env.NODE_ENV === "production",
      secure:"true",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: "true",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 15 min
    });
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      //accessToken,
      //refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        message: "Incorrect email or password",
      });
    }

    if (user.role === "vendor" && !user.isApproved) {
      return res.status(403).json({
        message: "Vendor account is not approved",
      });
    }

    const accessToken = authMiddleware.generateAccessToken(user);
    const refreshToken = authMiddleware.generateRefreshToken(user);
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    user.refreshToken = hashedRefreshToken;
    await user.save({ validateBeforeSave: false });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure:  "true",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure:  "true",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    // 5. Send response
    res.status(200).json({
      status: "success",
      accessToken, //refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        username: user.userName,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Login failed",
      error: err.message,
    });
  }
};

exports.registerVendor = async (req, res) => {
  try {
    const {
      userName,
      email,
      password,
      passwordConfirm,
      businessName,
      businessAddress,
    } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    const vendor = await User.create({
      userName:name,
      email,
      password,
      passwordConfirm,
      role: "vendor",
      isApproved: false,
      businessName,
      businessAddress,
    });

    res.status(201).json({
      message: "Vendor application submitted. Await admin approval.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveVendor = async (req, res) => {
  const vendor = await User.findById(req.params.id);
  if (!vendor || vendor.role !== "vendor") {
    return res.status(404).json({ message: "Vendor not found" });
  }

  vendor.isApproved = true;
  await vendor.save();

  res.json({ message: "Vendor approved successfully" });
};

exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token" });
  }

  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    _id: decoded.id,
    refreshToken: hashedToken,
  });

  if (!user) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const newAccessToken = authController.generateAccessToken(user);

  res.cookie("accessToken", newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 15 * 60 * 1000,
  });

  res.status(200).json({ status: "success" });
};

exports.logout = async (req, res) => {
  const user = await User.findById(req.user.id);
  user.refreshToken = undefined;
  await user.save({ validateBeforeSave: false });

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.status(200).json({ message: "Logged out successfully" });
};


exports.getMe = async (req, res) => {
  const user = req.user;
  res.json({ user });
};

exports.updateMe = async(req,res)=>{
  try {
    const {userName,email} = req.body;
  if (req.body.password || req.body.passwordConfirm) {
      return res.status(400).json({
        message: "This route is not for password updates. Please use updatePassword.",
      });
    }
const updatedUser = await User.findByIdAndUpdate(
 
      req.user.id || req.user._id,
      { userName, email },
      {
        new: true, 
        runValidators: true, 
      }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        userName: updatedUser.userName,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
  
}



exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, password, passwordConfirm } = req.body;

    if (!currentPassword || !password || !passwordConfirm) {
      return res.status(400).json({
        message: "Please provide currentPassword, password, and passwordConfirm",
      });
    }

    
    const user = await User.findById(req.user.id || req.user._id).select("+password");

    // 2. Check if the submitted current password matches the database
    if (!(await user.correctPassword(currentPassword, user.password))) {
      return res.status(401).json({ message: "Your current password is incorrect" });
    }

   
    user.password = password;
    user.passwordConfirm = passwordConfirm;
    await user.save();

  
    const accessToken = authMiddleware.generateAccessToken(user);
    const refreshToken = authMiddleware.generateRefreshToken(user);
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    user.refreshToken = hashedRefreshToken;
    await user.save({ validateBeforeSave: false });

  
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
      accessToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};