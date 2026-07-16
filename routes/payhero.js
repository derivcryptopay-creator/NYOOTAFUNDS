const express = require("express");
const axios = require("axios");

const router = express.Router();

const PAYHERO_BASE_URL = "https://backend.payhero.co.ke/api/v2";

const {
    PAYHERO_API_USERNAME,
    PAYHERO_API_PASSWORD,
    PAYHERO_CHANNEL_ID
} = process.env;

// Generate Basic Auth token (runs once at startup)
const authToken = Buffer.from(`${PAYHERO_API_USERNAME}:${PAYHERO_API_PASSWORD}`).toString('base64');

router.post("/stk-push", async(req, res) => {
    try {
        const { phone_number, amount } = req.body;

        // Validate required fields
        if (!phone_number || !amount) {
            return res.status(400).json({
                success: false,
                message: "Phone number and amount are required"
            });
        }

        // Normalize phone number: 07XX -> 2547XX, +2547XX -> 2547XX
        let cleanPhone = String(phone_number).replace(/^0+/, '').replace(/^\+254/, '');
        if (cleanPhone.length === 9) cleanPhone = '254' + cleanPhone;

        const payload = {
            amount: Number(amount),
            phone_number: cleanPhone,
            channel_id: Number(PAYHERO_CHANNEL_ID),
            provider: "m-pesa",
            external_reference: `TXN-${Date.now()}`,
            callback_url: "https://yourdomain.com/api/payhero-callback"
        };

        console.log("Sending to PayHero:", JSON.stringify(payload, null, 2));

        const response = await axios.post(
            `${PAYHERO_BASE_URL}/payments`,
            payload, {
                headers: {
                    'Authorization': `Basic ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("PayHero Response:", response.status, JSON.stringify(response.data, null, 2));

        return res.json({
            success: true,
            message: "STK Push sent successfully",
            data: response.data
        });

    } catch (error) {
        // Detailed error logging
        console.error("=== STK PUSH ERROR ===");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Headers:", JSON.stringify(error.response.headers, null, 2));
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error("No response received:", error.message);
        } else {
            console.error("Error:", error.message);
        }

        const errorMessage =
            error.response &&
            error.response.data &&
            (error.response.data.message || error.response.data.error || JSON.stringify(error.response.data));

        return res.status(500).json({
            success: false,
            message: errorMessage || "Payment initiation failed",
            error: error.response ? error.response.data : error.message
        });
    }
});

router.post("/payhero-callback", async(req, res) => {
    console.log("PayHero Callback:", JSON.stringify(req.body, null, 2));
    // Log the transaction result to your database here
    res.sendStatus(200);
});

module.exports = router;