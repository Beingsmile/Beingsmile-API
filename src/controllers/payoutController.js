import WithdrawalRequest from "../models/WithdrawalRequest.js";
import Campaign from "../models/Campaign.js";
import Notification from "../models/Notification.js";
import Wallet from "../models/Wallet.js";
import mongoose from "mongoose";
import { uploadImage } from "../utils/cloudinaryUtils.js";

// Get fundraiser's wallet data
export const getMyWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.uid });
    
    // Create wallet if it doesn't exist yet
    if (!wallet) {
      wallet = await Wallet.create({ user: req.uid });
    }

    res.json({ success: true, wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get fundraiser's withdrawal requests
export const getMyWithdrawals = async (req, res) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ user: req.uid })
      .populate("campaign", "title")
      .sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Request a withdrawal (Fundraiser only)
export const requestWithdrawal = async (req, res) => {
  try {
    const { campaignId, amount, bankDetails } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal is ৳100" });
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    // Security: Only creator can withdraw
    if (campaign.creator.toString() !== req.uid) {
      return res.status(403).json({ success: false, message: "Forbidden: Not the campaign creator" });
    }

    // Check available balance in Wallet (Modern way)
    const wallet = await Wallet.findOne({ user: req.uid });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // Check for existing pending requests
    const pendingRequest = await WithdrawalRequest.findOne({ campaign: campaignId, status: "pending" });
    if (pendingRequest) {
      return res.status(400).json({ success: false, message: "You already have a pending withdrawal request for this mission." });
    }

    const request = await WithdrawalRequest.create({
      campaign: campaignId,
      user: req.uid,
      amount,
      bankDetails,
    });

    // Notify all admins about the new request
    const User = mongoose.model("User");
    const admins = await User.find({ role: { $in: ["admin", "moderator"] } }).select("_id");
    await Notification.insertMany(admins.map(a => ({
      recipient: a._id,
      title: "New Payout Requested",
      message: `${req.user?.name || 'A fundraiser'} has requested a payout of ৳${amount} for "${campaign.title}".`,
      type: "payout_update",
      relatedId: request._id,
      link: "/admin/payouts"
    })));

    res.status(201).json({ success: true, message: "Withdrawal request submitted for review", request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get withdrawals for a specific campaign (Fundraiser only)
export const getCampaignWithdrawals = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const withdrawals = await WithdrawalRequest.find({ campaign: campaignId }).sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all pending withdrawals (Admin only)
export const getPendingWithdrawals = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ status: "pending" })
      .populate("campaign", "title currentAmount goalAmount")
      .populate("user", "name email")
      .sort({ createdAt: 1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Review withdrawal request (Admin only)
export const reviewWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body; // status: 'approved' or 'rejected'

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const request = await WithdrawalRequest.findById(id).populate("campaign");
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    request.status = status;
    request.adminNotes = adminNotes;
    request.processedAt = new Date();
    request.processedBy = req.uid;
    await request.save();

    // Notify user
    await Notification.create({
      recipient: request.user,
      title: `Withdrawal ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      message: status === 'approved' 
        ? `Your request for ৳${request.amount} has been approved and is being processed.`
        : `Your request for ৳${request.amount} was rejected. Reason: ${adminNotes}`,
      type: "payout_update",
      link: "/dashboard/my-missions"
    });

    res.json({ success: true, message: `Withdrawal ${status}`, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Complete withdrawal (Mark as paid) (Admin only)
export const completeWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { transactionReference, proofDocument } = req.body;

    const request = await WithdrawalRequest.findById(id).session(session);
    if (!request || !["approved", "pending"].includes(request.status)) {
      return res.status(400).json({ success: false, message: "Request cannot be completed from this state" });
    }

    // Process Proof Document if it is a new Base64 upload
    let finalProofUrl = proofDocument;
    if (proofDocument && proofDocument.startsWith("data:image/")) {
      const r = await uploadImage(proofDocument, `payouts/${Date.now()}_${Math.random()}`);
      finalProofUrl = r.secure_url;
    }

    // 1. Update Campaign's withdrawnAmount (Legacy field) without triggering full validation hooks
    const campaign = await Campaign.findById(request.campaign).session(session);
    await Campaign.updateOne(
      { _id: request.campaign },
      { $inc: { withdrawnAmount: request.amount } },
      { session }
    );

    // 2. Update Wallet balance (Deduction)
    const wallet = await Wallet.findOne({ user: request.user }).session(session);
    if (wallet) {
      wallet.balance -= request.amount;
      wallet.totalWithdrawn += request.amount;
      wallet.transactions.push({
        type: "debit",
        amount: request.amount,
        category: "withdrawal",
        description: `Payout completed for mission: ${campaign.title}`,
        relatedId: request._id,
        campaignId: campaign._id,
        timestamp: new Date()
      });
      await wallet.save({ session });
    }

    // 3. Mark request as completed
    request.status = "completed";
    request.transactionReference = transactionReference;
    request.proofDocument = finalProofUrl; // Save Cloudinary URL
    request.processedAt = new Date();
    await request.save({ session });

    // 4. Notify user
    await Notification.create([{
      recipient: request.user,
      title: "Withdrawal Completed",
      message: `The funds (৳${request.amount}) have been transferred to your account. Ref: ${transactionReference}`,
      type: "payout_processed", 
      link: "/dashboard/wallet"
    }], { session });

    await session.commitTransaction();
    res.json({ success: true, message: "Withdrawal marked as completed", request });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// Get payout logs (completed and rejected) (Admin only)
export const getPayoutLogs = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ status: { $in: ["completed", "rejected"] } })
      .populate("campaign", "title")
      .populate("user", "name email")
      .sort({ processedAt: -1, createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
