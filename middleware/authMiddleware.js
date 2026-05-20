const jwt = require("jsonwebtoken");
const User = require("../models/user");

exports.generateAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

exports.generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// exports.protect = async (req, res, next) => {
//   try {
//     let token;

//     if (
//       req.headers.authorization &&
//       req.headers.authorization.startsWith("Bearer")
//     ) {
//       token = req.headers.authorization.split(" ")[1];
//     }
//     if (!token && req.cookies.accessToken) {
//       token = req.cookies.accessToken;
//     }

//     if (!token) {
//       return res.status(401).json({
//         message: "You are not logged in",
//       });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const currentUser = await User.findById(decoded.id);
//     if (!currentUser) {
//       return res.status(401).json({
//         message: "User no longer exists",
//       });
//     }
//     if (currentUser.role === "vendor" && !currentUser.isApproved) {
//       return res.status(403).json({
//         message: "Vendor account not approved",
//       });
//     }

//     if (
//       currentUser.passwordChangedAt &&
//       decoded.iat * 1000 < currentUser.passwordChangedAt.getTime()
//     ) {
//       return res.status(401).json({
//         message: "Password recently changed. Please log in again.",
//       });
//     }

//     req.user = currentUser;
//     next();
//   } catch (err) {
//     res.status(401).json({
//       message: "Invalid or expired token",
//     });
//   }
// };

exports.protect = async (req, res, next) => {
  try {
    // 🔥 ONLY read from cookies
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return res.status(401).json({
        message: "User no longer exists",
      });
    }

    if (currentUser.role === "vendor" && !currentUser.isApproved) {
      return res.status(403).json({
        message: "Vendor account not approved",
      });
    }

    if (
      currentUser.passwordChangedAt &&
      decoded.iat * 1000 < currentUser.passwordChangedAt.getTime()
    ) {
      return res.status(401).json({
        message: "Password recently changed. Please log in again.",
      });
    }

    req.user = currentUser;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};


exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};
