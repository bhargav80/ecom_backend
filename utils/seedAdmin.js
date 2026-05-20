const User = require("../models/user");

const seedAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log("✅ Admin already exists");
      return;
    }

    await User.create({
      userName: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      passwordConfirm: process.env.ADMIN_PASSWORD,
      role: "admin",
    });

    console.log("🔥 Admin seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding admin:", error.message);
  }
};

module.exports = seedAdmin;