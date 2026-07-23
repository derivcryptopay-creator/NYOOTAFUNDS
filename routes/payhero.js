const express = require("express");
const axios = require("axios");

const router = express.Router();

const PAYNEXUS_BASE_URL = "https://paynexus.co.ke/api";

const {
    PAYNEXUS_SECRET_KEY, // sk_... from PayNexus dashboard
    PAYNEXUS_PUBLIC_KEY // pk_... from PayNexus dashboard (optional, for status checks)
} = process.env;

// ==========================================
// INITIATE STK PUSH via PayNexus
// ==========================================
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

        // PayNexus auto-normalizes phone numbers, but we send a clean format anyway
        // 07XX..., +2547XX..., 2547XX... all work — PayNexus handles it

        const payload = {
            amount: Number(amount),
            phone: phone_number,
            description: `Processing Fee - NYOTA Loan`
        };

        console.log("Sending to PayNexus:", JSON.stringify(payload, null, 2));

        const response = await axios.post(
            `${PAYNEXUS_BASE_URL}/mpesa/payment/initiate`,
            payload, {
                headers: {
                    'X-API-Key': PAYNEXUS_SECRET_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("PayNexus Response:", response.status, JSON.stringify(response.data, null, 2));

        if (response.data && response.data.success) {
            return res.json({
                success: true,
                message: "STK Push sent successfully",
                data: {
                    reference: response.data.data.reference,
                    checkout_request_id: response.data.data.checkout_request_id,
                    amount: response.data.data.amount,
                    phone: response.data.data.phone,
                    status: response.data.data.status
                }
            });
        } else {
            return res.status(500).json({
                success: false,
                message: response.data.message || "Payment initiation failed",
                data: response.data
            });
        }

    } catch (error) {
        console.error("=== STK PUSH ERROR ===");
        if (error.response) {
            console.error("Status:", error.response.status);
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

// ==========================================
// CHECK PAYMENT STATUS via PayNexus
// ==========================================
router.post("/check-payment-status", async(req, res) => {
    try {
        const { reference, checkout_request_id } = req.body;

        if (!reference && !checkout_request_id) {
            return res.status(400).json({
                success: false,
                message: "Payment reference or checkout request ID is required"
            });
        }

        let response;

        if (reference) {
            // Check by reference
            response = await axios.get(
                `${PAYNEXUS_BASE_URL}/payments/${reference}`, {
                    headers: {
                        'X-API-Key': PAYNEXUS_PUBLIC_KEY || PAYNEXUS_SECRET_KEY
                    }
                }
            );
        } else {
            // Check by checkout request ID
            response = await axios.post(
                `${PAYNEXUS_BASE_URL}/payments/status-by-checkout-id`, { checkout_request_id }, {
                    headers: {
                        'X-API-Key': PAYNEXUS_PUBLIC_KEY || PAYNEXUS_SECRET_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
        }

        return res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error("=== PAYMENT STATUS CHECK ERROR ===");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        }

        return res.status(500).json({
            success: false,
            message: "Failed to check payment status",
            error: error.response ? error.response.data : error.message
        });
    }
});

// ==========================================
// PAYNEXUS WEBHOOK — receives payment notifications
// ==========================================
router.post("/paynexus-callback", async(req, res) => {
    console.log("PayNexus Callback:", JSON.stringify(req.body, null, 2));
    // Log the transaction result to your database here
    // PayNexus sends events like: payment.completed, payment.failed
    res.sendStatus(200);
});

module.exports = router;
