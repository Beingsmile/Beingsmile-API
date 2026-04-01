import Campaign from "../models/Campaign.js";
import User from "../models/User.js";
import VerificationRequest from "../models/VerificationRequest.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import Notification from "../models/Notification.js";
import { notifyCampaignStatus } from "../utils/notificationUtils.js";
import { hashIdentityNumber } from "../utils/userUtils.js";
import mongoose from "mongoose";

// Get platform statistics
export const getAdminStats = async (req, res) => {
  try {
    const totalDonations = await Campaign.aggregate([
      { $unwind: "$donations" },
      { $group: { _id: null, total: { $sum: "$donations.amount" } } }
    ]);

    const stats = {
      totalUsers: await User.countDocuments(),
      totalDonors: await User.countDocuments({ userType: 'donor' }),
      totalFundraisers: await User.countDocuments({ userType: 'fundraiser' }),
      totalCampaigns: await Campaign.countDocuments(),
      pendingCampaigns: await Campaign.countDocuments({ status: 'pending' }),
      activeCampaigns: await Campaign.countDocuments({ status: 'active' }),
      totalRaised: totalDonations[0]?.total || 0,
      totalPayouts: await Campaign.aggregate([
        { $group: { _id: null, total: { $sum: "$withdrawnAmount" } } }
      ]).then(res => res[0]?.total || 0),
      pendingVerifications: await VerificationRequest.countDocuments({ status: 'pending' }),
      pendingWithdrawals: await WithdrawalRequest.countDocuments({ status: 'pending' }),
    };

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get pending campaigns for review
export const getPendingCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ status: 'pending' })
      .populate('creator', 'name email avatar isVerified')
      .sort({ createdAt: 1 });
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Approve or Reject a campaign
export const reviewCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body; // status: 'active' (approve), 'needs_info', 'suspended'

    if (!['active', 'needs_info', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    campaign.status = status;
    campaign.verificationDetails.adminNotes = adminNotes;
    campaign.verificationDetails.verifiedAt = new Date();
    campaign.verificationDetails.verifiedBy = req.uid;

    await campaign.save();

    // Trigger Notification
    await notifyCampaignStatus(campaign, status);

    res.json({ success: true, message: `Campaign ${status === 'active' ? 'approved' : status}`, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all users for management
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Toggle user status (suspend/activate)
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { message: adminStatusMessage } = req.body;
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    user.status = newStatus;
    user.statusMessage = adminStatusMessage || '';
    await user.save();

    // If suspended, halt all user's campaigns
    if (newStatus === 'suspended') {
      await Campaign.updateMany(
        { creator: user._id, status: 'active' },
        { status: 'suspended' }
      );
    }

    // Notify user
    await Notification.create({
      recipient: user._id,
      title: `Account ${newStatus === 'suspended' ? 'Suspended' : 'Activated'}`,
      message: adminStatusMessage || `Your account has been ${newStatus}. ${newStatus === 'suspended' ? 'All your active campaigns have been put on hold.' : ''}`,
      type: "account_suspension",
      link: "/dashboard/account-status"
    });

    res.json({ success: true, message: `User ${newStatus}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all verification requests
export const getVerificationRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const requests = await VerificationRequest.find(filter)
      .populate('user', 'name email avatar userType')
      .sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Review verification request
export const reviewVerificationRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { status, adminMessage } = req.body; // status: 'approved', 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const request = await VerificationRequest.findById(id).populate('user');
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }


    request.status = status;
    request.adminMessage = adminMessage;
    request.reviewedBy = req.uid; // This comes from auth middleware
    request.reviewedAt = new Date();
    await request.save({ session });

    if (status === 'approved') {
      const user = await User.findById(request.user._id);
      
      // Identity Cross-Check
      const idHash = hashIdentityNumber(request.identityNumber);
      const duplicateIdentity = await User.findOne({ 
          "identity.idHash": idHash, 
          _id: { $ne: user._id } 
      });

      if (duplicateIdentity) {
          throw new Error("Critical: This identity is already verified to another account.");
      }

      user.identity = {
        idNumber: request.identityNumber,
        idHash: idHash,
        idType: request.identityType,
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.uid
      };
      user.userType = request.userType;
      await user.save({ session });
    } else {
      // If rejected, ensure isVerified is false (for re-reviewing an approved one)
      const user = await User.findById(request.user._id);
      user.identity.isVerified = false;
      await user.save({ session });
    }

    // Create Notification for user
    await Notification.create([{
      recipient: request.user._id,
      title: `Verification ${status === 'approved' ? 'Successful' : 'Rejected'}`,
      message: status === 'approved' 
        ? `Congratulations! Your identity has been verified. You are now a verified ${request.userType}.`
        : `Your verification request was rejected. Reason: ${adminMessage}`,
      type: "verification_update",
      relatedId: request._id,
      link: "/dashboard/verification-status"
    }], { session });

    await session.commitTransaction();
    res.json({ success: true, message: `Verification ${status}` });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// Manual verification (Admin override)
export const manualVerifyUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, userType } = req.body;
    
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.identity.isVerified = isVerified;
    if (userType) user.userType = userType;
    if (isVerified) {
      user.identity.verifiedAt = new Date();
      user.identity.verifiedBy = req.uid;
    }
    
    await user.save();
    
    // Notify user
    await Notification.create({
      recipient: user._id,
      title: `Verification ${isVerified ? 'Successful' : 'Revoked'}`,
      message: isVerified 
        ? "An admin has manually verified your identity. You now have full access to platform features." 
        : "Your verification status has been revoked by an administrator.",
      type: "verification_update",
      link: "/dashboard/verification-status"
    });

    res.json({ success: true, message: `User verification ${isVerified ? 'approved' : 'revoked'}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get verification history for a specific user
export const getUserVerificationHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await VerificationRequest.find({ user: id })
      .populate('reviewedBy', 'name email avatar')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
