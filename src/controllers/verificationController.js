import VerificationRequest from "../models/VerificationRequest.js";
import User from "../models/User.js";
import { hashIdentityNumber } from "../utils/userUtils.js";
import Notification from "../models/Notification.js";
import { uploadImage } from "../utils/cloudinaryUtils.js";

export const submitVerificationRequest = async (req, res) => {
    try {
        const { 
            reason, 
            documents, 
            identityType, 
            identityNumber, 
            userType 
        } = req.body;

        if (!req.uid) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = await User.findById(req.uid);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if there's already a pending request
        const existingRequest = await VerificationRequest.findOne({
            user: req.uid,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({ error: "You already have a pending verification request." });
        }

        // Hash identity for cross-check
        const idHash = hashIdentityNumber(identityNumber);

        // Cross-check if this identity is already verified to another account
        const duplicateIdentity = await User.findOne({ 
            "identity.idHash": idHash, 
            _id: { $ne: req.uid } 
        });

        if (duplicateIdentity) {
            return res.status(400).json({ error: "This identity is already verified to another account." });
        }

        // Upload documents if they are sent as base64
        const uploadedDocs = [];
        if (documents && Array.isArray(documents)) {
            for (const doc of documents) {
                if (doc.base64) {
                    const result = await uploadImage(doc.base64, `user_verifications/${Date.now()}_${Math.random()}`);
                    uploadedDocs.push({
                        type: doc.type,
                        url: result.secure_url
                    });
                } else if (doc.url) {
                    uploadedDocs.push(doc); // Already uploaded
                }
            }
        }

        const newRequest = await VerificationRequest.create({
            user: req.uid,
            userType: userType || user.userType,
            identityType,
            identityNumber: identityNumber, // Raw number for admin review, hashed on approval
            reason,
            documents: uploadedDocs
        });

        // Notify Admins
        const admins = await User.find({ role: 'admin' });
        
        if (admins.length > 0) {
            const notifications = admins.map(admin => ({
                recipient: admin._id,
                title: "New Verification Request",
                message: `User ${user.name} has submitted a verification request for ${userType || user.userType} role.`,
                type: "new_verification_request",
                relatedId: newRequest._id,
                link: "/admin/verifications"
            }));
            await Notification.insertMany(notifications);
        }

        res.status(201).json({
            success: true,
            message: "Verification request submitted successfully. Our admin will review it shortly.",
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
