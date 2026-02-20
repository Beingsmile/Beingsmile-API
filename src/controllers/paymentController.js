import Stripe from "stripe";
import Campaign from "../models/Campaign.js";

const stripe = new Stripe(process.env.STRIPE_SK);

// Create Payment Intent
export const createPaymentIntent = async (req, res) => {
    try {
        const { amount, campaignId } = req.body;

        // Validate input
        if (!amount || amount < 1) {
            return res.status(400).json({ error: "Amount must be at least $1" });
        }

        if (!campaignId) {
            return res.status(400).json({ error: "Campaign ID is required" });
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

        // Create payment intent with metadata
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert dollars to cents
            currency: "usd",
            payment_method_types: ["card"],
            metadata: {
                campaignId: campaignId,
                campaignTitle: campaign.title,
                userId: req.userId || "anonymous", // From auth middleware if available
            },
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({
            error: "Failed to create payment intent",
            details: error.message
        });
    }
};

// Webhook Handler for Stripe Events
export const handleWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case "payment_intent.succeeded":
                await handlePaymentSuccess(event.data.object);
                break;

            case "payment_intent.payment_failed":
                await handlePaymentFailure(event.data.object);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};

// Helper: Handle successful payment
const handlePaymentSuccess = async (paymentIntent) => {
    const { campaignId, userId } = paymentIntent.metadata;
    const amount = paymentIntent.amount / 100; // Convert cents to dollars

    try {
        // Find the campaign
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            console.error(`Campaign not found: ${campaignId}`);
            return;
        }

        // Add donation to campaign
        const donation = {
            donor: userId && userId !== "anonymous" ? userId : null,
            amount: amount,
            isAnonymous: !userId || userId === "anonymous",
            message: paymentIntent.metadata.donorMessage || "",
            donatedAt: new Date(),
            paymentIntentId: paymentIntent.id,
        };

        campaign.donations.push(donation);

        // Update current amount
        campaign.currentAmount += amount;

        // Save campaign
        await campaign.save();

        console.log(`✅ Donation recorded: $${amount} to campaign ${campaignId}`);
    } catch (error) {
        console.error("Error recording donation:", error);
    }
};

// Helper: Handle failed payment
const handlePaymentFailure = async (paymentIntent) => {
    const { campaignId } = paymentIntent.metadata;
    console.log(`❌ Payment failed for campaign ${campaignId}:`, paymentIntent.last_payment_error?.message);
};

// Get User Donations
export const getUserDonations = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware

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
