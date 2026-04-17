import mongoose from "mongoose";

const withdrawalRequestSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [100, "Minimum withdrawal is ৳100"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      branchName: String,
      routingNumber: String,
      mobileMoneyNumber: String, // For bKash/Nagad
      mobileMoneyType: { type: String, enum: ["bkash", "nagad", "rocket"] },
    },
    adminNotes: String,
    transactionReference: String, // Actual bank transfer ID
    proofDocument: String, // URL/Path to the payment transcript or receipt image
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

withdrawalRequestSchema.index({ campaign: 1 });
withdrawalRequestSchema.index({ user: 1 });
withdrawalRequestSchema.index({ status: 1 });

export default mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
