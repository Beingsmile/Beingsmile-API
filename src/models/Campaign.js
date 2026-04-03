import mongoose from "mongoose";

// ─── Comprehensive Category List (17) ────────────────────────────────────────
export const CAMPAIGN_CATEGORIES = [
  "Education",
  "Health & Medical",
  "Disaster Relief",
  "Poverty & Food",
  "Environment",
  "Animals",
  "Community Development",
  "Arts & Culture",
  "Technology & Innovation",
  "Women Empowerment",
  "Child Welfare",
  "Elderly Care",
  "Mental Health",
  "Sports & Fitness",
  "Religious & Spiritual",
  "Legal Aid",
  "Others",
];

const campaignSchema = new mongoose.Schema(
  {
    // ── Core Details ──────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [10, "Title must be at least 10 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: [120, "Tagline cannot exceed 120 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      minlength: [200, "Description must be at least 200 characters"],
      maxlength: [10000, "Description too long"],
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    creatorUsername: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: CAMPAIGN_CATEGORIES,
    },

    // ── Funding ───────────────────────────────────────────────────────────────
    goalAmount: {
      type: Number,
      required: [true, "Goal amount is required"],
      min: [100, "Goal must be at least ৳100"],
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    withdrawnAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Media ─────────────────────────────────────────────────────────────────
    coverImage: {
      type: String,
      required: [true, "Cover image is required"],
    },
    images: [String], // Additional public images

    // ── Timeline ──────────────────────────────────────────────────────────────
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (endDate) {
          return endDate > this.startDate;
        },
        message: "End date must be after start date",
      },
    },

    // ── Donations ────────────────────────────────────────────────────────────
    donations: [
      {
        donor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: false,
        },
        donorName: String,    // Snapshot at time of donation
        donorEmail: String,   // Snapshot (admin only)
        amount: {
          type: Number,
          required: true,
          min: [100, "Minimum donation is ৳100"],
        },
        platformFee: {
          type: Number,
          default: 0,
        },
        isAnonymous: {
          type: Boolean,
          default: false,     // Anonymous to public but visible to fundraiser & admin
        },
        isAnonymousFromAll: {
          type: Boolean,
          default: false,     // Anonymous even from fundraiser — only admin sees
        },
        donorMessage: {
          type: String,
          maxlength: [500, "Message cannot exceed 500 characters"],
          default: "",
        },
        transactionId: String,
        paymentMethod: { type: String, default: "aamarpay" },
        donatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ── Mission Updates (published) ───────────────────────────────────────────
    updates: [
      {
        title: { type: String, required: true },
        content: { type: String, required: true },
        images: [String],
        postedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ── Pending Updates (awaiting admin approval) ────────────────────────────
    pendingUpdates: [
      {
        title: { type: String, required: true },
        content: { type: String, required: true },
        images: [String],
        submittedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        adminNote: String,
        reviewedAt: Date,
      },
    ],

    // ── Discussion (Comments + Replies) ──────────────────────────────────────
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        name: { type: String, required: true },
        avatar: String,
        text: {
          type: String,
          required: [true, "Comment text is required"],
          maxlength: [1000, "Comment cannot exceed 1000 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        replies: [
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            name: { type: String, required: true },
            avatar: String,
            text: {
              type: String,
              required: true,
              maxlength: [1000, "Reply cannot exceed 1000 characters"],
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],

    // ── Engagement ───────────────────────────────────────────────────────────
    recommendations: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ── Notification Subscribers ─────────────────────────────────────────────
    // Users who opted in to receive updates about this mission
    notificationSubscribers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        email: Boolean,   // Also receive emails
        subscribedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Trending Score ────────────────────────────────────────────────────────
    // Computed periodically: donations*3 + recommendations*2 + comments*1 + recency
    trendingScore: {
      type: Number,
      default: 0,
      index: true,
    },

    // ── Status & Verification ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "active", "completed", "suspended", "needs_info", "halted"],
      default: "pending",
    },
    verificationDetails: {
      documents: [String],   // Admin-only verification documents
      adminNotes: String,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },

    // ── Admin Notice Banner ───────────────────────────────────────────────────
    adminNotice: {
      text: { type: String, default: "" },
      type: {
        type: String,
        enum: ["warning", "info", "danger"],
        default: "warning",
      },
      isActive: { type: Boolean, default: false },
      postedAt: Date,
      postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },

    // ── Featured ─────────────────────────────────────────────────────────────
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// ─── Virtual Fields ───────────────────────────────────────────────────────────
campaignSchema.virtual("recommendationCount").get(function () {
  return this.recommendations?.length || 0;
});
campaignSchema.virtual("donorCount").get(function () {
  return this.donations?.length || 0;
});
campaignSchema.virtual("fundingPercentage").get(function () {
  return this.goalAmount > 0
    ? Math.min(Math.round((this.currentAmount / this.goalAmount) * 100), 100)
    : 0;
});

// ─── Static: Recompute Trending Score ─────────────────────────────────────────
campaignSchema.methods.computeTrendingScore = function () {
  const donationScore = (this.donations?.length || 0) * 3;
  const recommendScore = (this.recommendations?.length || 0) * 2;
  const commentScore = (this.comments?.length || 0) * 1;
  const ageInDays = (Date.now() - new Date(this.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.max(0, 30 - ageInDays); // Boost newer campaigns
  return donationScore + recommendScore + commentScore + recencyBoost;
};

// ─── Indexes ──────────────────────────────────────────────────────────────────
campaignSchema.index({ title: "text", description: "text", tagline: "text" });
campaignSchema.index({ creator: 1 });
campaignSchema.index({ category: 1, status: 1 });
campaignSchema.index({ isFeatured: 1, status: 1 });
campaignSchema.index({ trendingScore: -1, status: 1 });
campaignSchema.index({ createdAt: -1, status: 1 });
campaignSchema.index({ endDate: 1, status: 1 });
campaignSchema.index({ "donations.transactionId": 1 });

campaignSchema.set("toJSON", { virtuals: true });
campaignSchema.set("toObject", { virtuals: true });

export default mongoose.model("Campaign", campaignSchema);
