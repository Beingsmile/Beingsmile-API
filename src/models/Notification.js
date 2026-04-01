import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "donation", 
        "campaign_update", 
        "campaign_status", 
        "system", 
        "verification_update", 
        "account_suspension",
        "new_verification_request" // For admins
      ],
      default: "system",
    },
    relatedId: {
      type: String, // ID of Campaign, Donation, VerificationRequest, etc.
    },
    link: {
      type: String, // Destination URL for deep linking
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1 });

export default mongoose.model("Notification", notificationSchema);
