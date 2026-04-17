import mongoose from 'mongoose';
import axios from 'axios';
import crypto from 'crypto';
import Campaign from "../models/Campaign.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { notifyDonation } from "../utils/notificationUtils.js";

const VERIFY_URL = process.env.AAMARPAY_MODE === 'sandbox' 
    ? "https://sandbox.aamarpay.com/api/v1/trxcheck/request.php"
    : "https://secure.aamarpay.com/api/v1/trxcheck/request.php";

// Helper to verify payment with Aamarpay API
const verifyPaymentAPI = async (mer_txnid) => {
    try {
        const response = await axios.get(VERIFY_URL, {
            params: {
                request_id: mer_txnid,
                store_id: process.env.AAMARPAY_STORE_ID,
                signature_key: process.env.AAMARPAY_SIGNATURE_KEY,
                type: "json"
            }
        });
        return response.data;
    } catch (error) {
        console.error("Aamarpay verification API error:", error);
        return null;
    }
};

// Initialize payment with Aamarpay
export const initiatePayment = async (req, res) => {
    try {
        const { amount, campaignId, customerName, customerEmail, customerPhone, isAnonymous, isAnonymousFromAll, donorMessage, platformFee } = req.body;

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
            opt_b: req.uid || "anonymous",
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
            // Log initiation in Transaction model
            await Transaction.create({
                transactionId: tran_id,
                campaign: campaignId,
                user: req.uid === 'anonymous' ? null : req.uid,
                amount: amount,
                status: "initiated",
                customerDetails: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                },
                isAnonymous: isAnonymous || false,
                isAnonymousFromAll: isAnonymousFromAll || false,
                donorMessage: donorMessage || "",
                platformFee: platformFee || 0,
            });

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
        const { mer_txnid, amount } = paymentData;

        // 1. Server-to-Server Verification (CRITICAL for Security)
        const verification = await verifyPaymentAPI(mer_txnid);
        
        if (!verification || verification.pay_status !== "Successful") {
            console.error(`[PAYMENT_CRITICAL] Server-side verification failed for TXN: ${mer_txnid}`, verification);
            
            await Transaction.findOneAndUpdate(
                { transactionId: mer_txnid },
                { 
                    status: "failed", 
                    errorMessage: "Server-side verification failed. Suspected spoofing or bank-level failure.",
                    gatewayResponse: paymentData 
                }
            );
            
            return res.redirect(`${process.env.FRONTEND_URL}/payment-failure?error=verification_failed`);
        }

        // Verify that the amount matches
        if (parseFloat(verification.amount) !== parseFloat(amount)) {
             console.error(`[PAYMENT_CRITICAL] Amount mismatch! Reported: ${amount}, Verified: ${verification.amount}`);
             return res.redirect(`${process.env.FRONTEND_URL}/payment-failure?error=amount_mismatch`);
        }

        // 2. Use the centralized atomic processor
        const { processDonationSequence } = await import("../utils/donationUtils.js");
        const result = await processDonationSequence(mer_txnid, paymentData, "aamarpay");

        console.log(`[PAYMENT_SUCCESS] Success callback handled for TXN: ${mer_txnid}. Campaign: ${result.campaign?._id}`);

        // Redirect to frontend success page
        res.redirect(`${process.env.FRONTEND_URL}/payment-success?tid=${mer_txnid}&amount=${amount}${result.alreadyProcessed ? '&duplicate=true' : ''}`);

    } catch (error) {
        console.error(`[PAYMENT_CRITICAL] Error processing AamarPay success for TXN: ${req.body?.mer_txnid}:`, error);
        res.redirect(`${process.env.FRONTEND_URL}/payment-failure?error=processing_error`);
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

        // Log failure in Transaction model
        await Transaction.findOneAndUpdate(
            { transactionId: mer_txnid },
            { 
                status: "failed", 
                gatewayResponse: paymentData,
                errorMessage: reason || pay_status 
            }
        );

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
        const userId = req.uid;

        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Find all campaigns where user has donated
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const campaigns = await Campaign.find({
            "donations.donor": userObjectId,
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
                        platformFee: donation.platformFee || 0,
                        totalAmount: (donation.amount || 0) + (donation.platformFee || 0),
                        donorName: donation.donorName,
                        donorEmail: donation.donorEmail,
                        donorPhone: donation.donorPhone,
                        donatedAt: donation.donatedAt,
                        paymentMethod: donation.paymentMethod || "unknown",
                        transactionId: donation.transactionId || "N/A",
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

// Get single transaction details by TID (Public Receipt Access)
export const getTransactionByTid = async (req, res) => {
    try {
        const { tid } = req.params;
        const transaction = await Transaction.findOne({ transactionId: tid })
            .populate("campaign", "title");

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        res.json({ 
            success: true, 
            transaction: {
                tid: transaction.transactionId,
                amount: transaction.amount,
                netAmount: transaction.netAmount,
                platformFee: transaction.platformFee,
                customerName: transaction.customerDetails?.name,
                customerEmail: transaction.customerDetails?.email,
                customerPhone: transaction.customerDetails?.phone,
                campaignTitle: transaction.campaign?.title,
                donatedAt: transaction.createdAt,
                paymentMethod: transaction.gatewayResponse?.card_type || "Aamarpay Secure"
            } 
        });
    } catch (error) {
        console.error("Error fetching transaction details:", error);
        res.status(500).json({ error: "Server error" });
    }
};
