const express = require("express");
const orderController = require("../controllers/orderController");

const router = express.Router();
router.post("/webhook/cashfree",
    express.raw({ type: "application/json" }),orderController.cashfreeWebhook);
module.exports = router;