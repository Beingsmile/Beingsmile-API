import mongoose from "mongoose";

/**
 * PlatformSettings — Singleton model.
 * Only ONE document ever exists. Use PlatformSettings.getSingleton() to read,
 * and PlatformSettings.findOneAndUpdate({}, ..., { upsert: true }) to write.
 */
const platformSettingsSchema = new mongoose.Schema(
  {
    // ── Donation Fee Configuration ─────────────────────────────────────────
    donationFee: {
      // Mode: how the fee is applied
      //  'none'            — No fee charged
      //  'optional_button' — Donor sees a button to optionally add the fee
      //  'forced'          — Fee is automatically added to the donation total
      mode: {
        type: String,
        enum: ["none", "optional_button", "forced"],
        default: "optional_button",
      },
      // Type: how the fee amount is calculated
      type: {
        type: String,
        enum: ["percent", "fixed"],
        default: "percent",
      },
      percent: {
        type: Number,
        default: 2.5,   // 2.5% platform fee
        min: 0,
        max: 20,
      },
      fixed: {
        type: Number,
        default: 10,    // ৳10 flat fee
        min: 0,
      },
      label: {
        type: String,
        default: "Support BeingSmile Platform", // Shown next to the fee button
      },
    },

    // ── Donation Constraints ───────────────────────────────────────────────
    minimumDonation: {
      type: Number,
      default: 100,      // ৳100 minimum
      min: 1,
    },
    maximumDonation: {
      type: Number,
      default: 500000,   // ৳5,00,000 maximum per transaction
    },

    // ── Payout Policy ─────────────────────────────────────────────────────
    payoutHoldDays: {
      type: Number,
      default: 30,       // 30-day hold after campaign ends before payout
    },
    minimumWithdrawAmount: {
      type: Number,
      default: 500,      // ৳500 minimum withdrawal
    },

    // ── Platform Content ───────────────────────────────────────────────────
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: "BeingSmile is temporarily under maintenance. We'll be back shortly.",
    },

    // ── Tutorial / Help ────────────────────────────────────────────────────
    donationTutorialUrl: {
      type: String,
      default: "",     // YouTube embed URL or external link
    },
  },
  { timestamps: true }
);

// Static helper: always returns the single settings document
platformSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({});
  if (!settings) {
    settings = await this.create({});  // Create with defaults if first time
  }
  return settings;
};

export default mongoose.model("PlatformSettings", platformSettingsSchema);
