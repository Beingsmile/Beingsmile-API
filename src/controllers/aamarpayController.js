import axios from 'axios';
import crypto from 'crypto';
import Campaign from "../models/Campaign.js";

// Initialize payment with Aamarpay
export const initiatePayment = async (req, res) => {
    try {
        const { amount, campaignId, customerName, customerEmail, customerPhone } = req.body;

        // Validate input
        if (!amount || amount < 1) {
            return res.status(400).json({ error: "Amount must be at least 1 BDT" });
        }

        if (!campaignId) {
            return res.status(400).json({ error: "Campaign ID is required" });
        }

        if (!customerName || !customerEmail || !customerPhone) {
            return res.status(400).json({ error: "Customer name, email, and phone are required" });
        }

        // Verify campaign exists
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        // Check if campaign is active
        if (campaign.status !== "active") {
            return res.status(400).json({ error: "Campaign is not accepting donations" });
        }

        // Check if campaign hasn't ended
        const now = new Date();
        if (campaign.endDate < now) {
            return res.status(400).json({ error: "Campaign deadline has passed" });
        }

        // Generate unique transaction ID
        const tran_id = `TRAN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Prepare Aamarpay request payload
        const paymentPayload = {
            store_id: process.env.AAMARPAY_STORE_ID,
            signature_key: process.env.AAMARPAY_SIGNATURE_KEY,
            tran_id: tran_id,
            amount: amount.toString(),
            currency: process.env.AAMARPAY_CURRENCY || "BDT",
            desc: `Donation to ${campaign.title}`,
            cus_name: customerName,
            cus_email: customerEmail,
            cus_phone: customerPhone,
            cus_add1: "N/A",
            cus_add2: "N/A",
            cus_city: "Online",
            cus_state: "Online",
            cus_country: "BD",
            success_url: `${process.env.API_URL}/api/payment/aamarpay/success`,
            fail_url: `${process.env.API_URL}/api/payment/aamarpay/fail`,
            cancel_url: `${process.env.API_URL}/api/payment/aamarpay/cancel`,
            // Optional parameters to track the campaign and user
            opt_a: campaignId,
            opt_b: req.userId || "anonymous",
            opt_c: campaign.title,
            opt_d: new Date().toISOString(),
            type: "json",
        };

        // Call Aamarpay API
        const response = await axios.post(
            process.env.AAMARPAY_API_URL,
            paymentPayload,
            { headers: { "Content-Type": "application/json" } }
        );

        if (response.data && response.data.result === "true" && response.data.payment_url) {
            console.log(`✅ Payment initiated: ${tran_id} for campaign ${campaignId}`);
            res.json({
                success: true,
                payment_url: response.data.payment_url,
                tran_id: tran_id,
                message: "Payment initiated successfully"
            });
        } else {
            console.error("❌ Aamarpay API error:", response.data);
            res.status(400).json({
                success: false,
                error: "Failed to initiate payment with Aamarpay",
                details: response.data
            });
        }
    } catch (error) {
        console.error("Error initiating Aamarpay payment:", error);
        res.status(500).json({
            success: false,
            error: "Failed to initiate payment",
            details: error.message
        });
    }
};

// Handle payment success callback
export const handlePaymentSuccess = async (req, res) => {
    try {
        const paymentData = req.body;
        const { status_code, amount, mer_txnid, cus_email, cus_name, opt_a, opt_b } = paymentData;

        console.log("✅ Payment Success Callback Received:", paymentData);

        // Verify payment (status_code 2 = successful)
        if (status_code !== "2") {
            console.error("Invalid status code:", status_code);
            return res.redirect(`${process.env.FRONTEND_URL}/payment-failure`);
        }

        const campaignId = opt_a;
        const userId = opt_b === "anonymous" ? null : opt_b;

        // Find and update campaign
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            console.error(`Campaign not found: ${campaignId}`);
            return res.redirect(`${process.env.FRONTEND_URL}/payment-failure`);
        }

        // Add donation record
        const donation = {
            donor: userId,
            amount: parseFloat(amount),
            isAnonymous: !userId || userId === "anonymous",
            message: "",
            donatedAt: new Date(),
            transactionId: mer_txnid,
            paymentGateway: "aamarpay",
        };

        campaign.donations.push(donation);
        campaign.currentAmount += parseFloat(amount);
        await campaign.save();

        console.log(`✅ Donation recorded: ${amount} BDT to campaign ${campaignId}`);

        // Redirect to frontend success page
        res.redirect(`${process.env.FRONTEND_URL}/payment-success?tid=${mer_txnid}&amount=${amount}`);

    } catch (error) {
        console.error("Error processing payment success:", error);
        res.redirect(`${process.env.FRONTEND_URL}/payment-failure`);
    }
};

// Handle payment failure callback
export const handlePaymentFail = async (req, res) => {
    try {
        const paymentData = req.body;
        const { status_code, pay_status, amount, mer_txnid, cus_email, cus_name, reason } = paymentData;

        console.error("❌ Payment Failed:", paymentData);

        // Log failure for debugging
        console.log(`Payment failed for transaction ${mer_txnid}: ${pay_status} - ${reason}`);

        // Redirect to frontend failure page
        res.redirect(`${process.env.FRONTEND_URL}/payment-failure?tid=${mer_txnid}&reason=${encodeURIComponent(reason || pay_status)}`);

    } catch (error) {
        console.error("Error processing payment failure:", error);
        res.redirect(`${process.env.FRONTEND_URL}/payment-failure`);
    }
};

// Handle payment cancellation
export const handlePaymentCancel = async (req, res) => {
    try {
        const paymentData = req.body;
        const { mer_txnid, cus_name, amount } = paymentData;

        console.log("❌ Payment Cancelled:", paymentData);

        // Redirect to frontend cancelled page
        res.redirect(`${process.env.FRONTEND_URL}/payment-cancelled?tid=${mer_txnid}`);

    } catch (error) {
        console.error("Error processing payment cancellation:", error);
        res.redirect(`${process.env.FRONTEND_URL}/payment-cancelled`);
    }
};

// Get user donations
export const getUserDonations = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Find all campaigns where user has donated
        const campaigns = await Campaign.find({
            "donations.donor": userId,
        }).select("title donations currentAmount goalAmount");

        // Extract user's donations from each campaign
        const userDonations = [];
        campaigns.forEach((campaign) => {
            campaign.donations.forEach((donation) => {
                if (donation.donor && donation.donor.toString() === userId) {
                    userDonations.push({
                        campaignTitle: campaign.title,
                        campaignId: campaign._id,
                        amount: donation.amount,
                        message: donation.message,
                        donatedAt: donation.donatedAt,
                        paymentGateway: donation.paymentGateway || "unknown",
                    });
                }
            });
        });

        // Sort by date (newest first)
        userDonations.sort((a, b) => b.donatedAt - a.donatedAt);

        res.json({ donations: userDonations });
    } catch (error) {
        console.error("Error fetching user donations:", error);
        res.status(500).json({ error: "Failed to fetch donations" });
    }
};
