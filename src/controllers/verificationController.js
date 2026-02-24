import VerificationRequest from "../models/VerificationRequest.js";
import User from "../models/User.js";

export const submitVerificationRequest = async (req, res) => {
    try {
        const { reason, documents } = req.body;

        if (!req.uid) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Check if there's already a pending request
        const existingRequest = await VerificationRequest.findOne({
            user: req.uid,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({ error: "You already have a pending verification request." });
        }

        const newRequest = await VerificationRequest.create({
            user: req.uid,
            reason,
            documents: documents || []
        });

        res.status(201).json({
            success: true,
            message: "Verification request submitted successfully",
            request: newRequest
        });
    } catch (error) {
        console.error("Submit verification error:", error);
        res.status(500).json({ error: error.message || "Failed to submit request" });
    }
};

export const getMyRequests = async (req, res) => {
    try {
        const requests = await VerificationRequest.find({ user: req.uid }).sort({ createdAt: -1 });
        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
