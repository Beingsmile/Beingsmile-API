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
        // Existing types
        "donation",
        "campaign_update",
        "campaign_status",
        "system",
        "verification_update",
        "account_suspension",
        "new_verification_request",  // Admin

        // New types — Phase 8
        "mission_recommended",           // Creator: someone recommended their mission
        "mission_update_approved",       // Creator: admin approved their update
        "mission_update_rejected",       // Creator: admin rejected their update
        "mission_notice_posted",         // Creator: admin posted a notice on their mission
        "mission_update_published",      // Subscriber: new update published on a mission they follow
        "pending_mission_update",        // Admin: creator submitted an update for review
        "campaign_featured",             // Creator: their campaign was featured by admin
        "campaign_unfeatured",           // Creator: their campaign was unfeatured
        "new_subscriber",                // Creator: someone subscribed to mission notifications
        "comment_reply",                 // User: someone replied to their comment
        "new_comment",                   // Creator: someone commented on their campaign
        "payout_processed",              // Creator: their withdrawal was processed
        "payout_rejected",               // Creator: their withdrawal was rejected
      ],
      default: "system",
    },
    relatedId: {
      type: String,   // ID of Campaign, Donation, VerificationRequest, etc.
    },
    link: {
      type: String,   // Deep link URL
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
