import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "BDT",
    },
    status: {
      type: String,
      enum: ["initiated", "success", "failed", "cancelled"],
      default: "initiated",
    },
    gatewayResponse: {
      type: Object,
    },
    customerDetails: {
      name: String,
      email: String,
      phone: String,
    },
    errorMessage: String,
    platformFee: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      default: 0,
    },
    verificationLevel: {
      type: String,
      enum: ["unverified", "server_confirmed", "manual_audit"],
      default: "unverified",
    },
  },
  { timestamps: true }
);

transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ campaign: 1 });

export default mongoose.model("Transaction", transactionSchema);
