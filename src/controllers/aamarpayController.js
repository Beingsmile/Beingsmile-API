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
            // Log initiation in Transaction model
            await Transaction.create({
                transactionId: tran_id,
                campaign: campaignId,
                user: req.userId === 'anonymous' ? null : req.userId,
                amount: amount,
                status: "initiated",
                customerDetails: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                }
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
    const session = await Campaign.startSession();
    session.startTransaction();
    try {
        // 1. Server-to-Server Verification (CRITICAL for Security)
        const verification = await verifyPaymentAPI(mer_txnid);
        
        if (!verification || verification.pay_status !== "Successful") {
            console.error(`[PAYMENT_CRITICAL] Server-side verification failed for TXN: ${mer_txnid}`, verification);
            
            // Log the suspected fraud attempt or failed verification
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

        // Verify that the amount and currency match
        if (parseFloat(verification.amount) !== parseFloat(amount)) {
             console.error(`[PAYMENT_CRITICAL] Amount mismatch! Reported: ${amount}, Verified: ${verification.amount}`);
             return res.redirect(`${process.env.FRONTEND_URL}/payment-failure?error=amount_mismatch`);
        }

        const campaignId = opt_a;
        const userId = opt_b === "anonymous" ? null : opt_b;

        // 2. Idempotency Check: Verify if this transaction has already been processed
        const existingCampaign = await Campaign.findOne({ "donations.transactionId": mer_txnid }).session(session);
        if (existingCampaign) {
            console.warn(`[PAYMENT_WARN] Duplicate callback detected for TXN: ${mer_txnid}. Skipping processing.`);
            await session.commitTransaction();
            session.endSession();
            return res.redirect(`${process.env.FRONTEND_URL}/payment-success?tid=${mer_txnid}&amount=${amount}&duplicate=true`);
        }

        // 3. Atomic Update: Find and update campaign in one go
        const donation = {
            donor: userId,
            amount: parseFloat(amount),
            isAnonymous: !userId || userId === "anonymous",
            message: "",
            donatedAt: new Date(),
            transactionId: mer_txnid,
            paymentGateway: "aamarpay",
        };

        const updatedCampaign = await Campaign.findOneAndUpdate(
            { _id: campaignId },
            { 
                $push: { donations: donation },
                $inc: { currentAmount: parseFloat(amount) }
            },
            { session, new: true }
        );

        if (!updatedCampaign) {
            throw new Error(`Campaign ${campaignId} not found during success callback`);
        }

        // 3. Update User's donation history if logged in
        if (userId) {
            await User.findByIdAndUpdate(
                userId,
                { 
                    $push: { 
                        donatedCampaigns: { 
                            campaign: campaignId, 
                            amount: parseFloat(amount), 
                            donatedAt: new Date() 
                        } 
                    } 
                },
                { session }
            );
        }

        // 4. Trigger Notification
        await notifyDonation(updatedCampaign, donation);

        // 5. Update Transaction record
        await Transaction.findOneAndUpdate(
            { transactionId: mer_txnid },
            { 
                status: "success", 
                gatewayResponse: paymentData,
                netAmount: parseFloat(amount),
                platformFee: 0, // 100% goes to mission as per trust claim
                verificationLevel: "server_confirmed"
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        console.log(`[PAYMENT_SUCCESS] Successfully processed TXN: ${mer_txnid}. Campaign: ${campaignId}, Amount: ${amount}`);

        // Redirect to frontend success page
        res.redirect(`${process.env.FRONTEND_URL}/payment-success?tid=${mer_txnid}&amount=${amount}`);

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`[PAYMENT_CRITICAL] Error processing payment success for TXN: ${req.body.mer_txnid}:`, error);
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
