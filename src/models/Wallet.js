import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },
    transactions: [
      {
        type: {
          type: String,
          enum: ["credit", "debit"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        category: {
          type: String,
          enum: ["donation", "withdrawal", "refund", "adjustment"],
          required: true,
        },
        description: String,
        relatedId: {
          type: String, // Transaction ID or WithdrawalRequest ID
        },
        campaignId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Campaign",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Indexes
walletSchema.index({ user: 1 });
walletSchema.index({ "transactions.timestamp": -1 });

export default mongoose.model("Wallet", walletSchema);
