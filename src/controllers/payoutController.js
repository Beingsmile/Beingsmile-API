import WithdrawalRequest from "../models/WithdrawalRequest.js";
import Campaign from "../models/Campaign.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

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

    // Check available balance
    const availableBalance = campaign.currentAmount - campaign.withdrawnAmount;
    if (amount > availableBalance) {
      return res.status(400).json({ success: false, message: `Insufficient balance. Available: ৳${availableBalance}` });
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
    const { transactionReference } = req.body;

    const request = await WithdrawalRequest.findById(id).session(session);
    if (!request || request.status !== "approved") {
      return res.status(400).json({ success: false, message: "Request must be approved before completion" });
    }

    // 1. Update Campaign's withdrawnAmount
    const campaign = await Campaign.findById(request.campaign).session(session);
    campaign.withdrawnAmount += request.amount;
    await campaign.save({ session });

    // 2. Mark request as completed
    request.status = "completed";
    request.transactionReference = transactionReference;
    request.processedAt = new Date();
    await request.save({ session });

    // 3. Notify user
    await Notification.create([{
      recipient: request.user,
      title: "Withdrawal Completed",
      message: `The funds (৳${request.amount}) have been transferred to your account. Ref: ${transactionReference}`,
      type: "payout_complete",
      link: "/dashboard/my-missions"
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
