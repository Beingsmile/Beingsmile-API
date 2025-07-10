import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    // Core Campaign Details
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [5000, 'Description too long'],
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['education', 'health', 'environment', 'animals', 'community', 'art', 'technology', 'other'],
    },

    // Funding Goals
    goalAmount: {
      type: Number,
      required: [true, 'Goal amount is required'],
      min: [1, 'Goal must be at least $1'],
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Media
    coverImage: {
      type: String,
      required: [true, 'Cover image is required'],
    },
    images: [String], // Additional images/videos

    // Timelines
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function (endDate) {
          return endDate > this.startDate;
        },
        message: 'End date must be after start date',
      },
    },

    // Donations & Engagement
    donations: [
      {
        donor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: [1, 'Minimum donation is $1'],
        },
        isAnonymous: {
          type: Boolean,
          default: false,
        },
        message: String,
        donatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    updates: [
      {
        title: String,
        content: String,
        postedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Status
    status: {
      type: String,
      enum: ['active', 'completed', 'suspended'],
      default: 'active',
    },
  },
  { timestamps: true } // Adds createdAt, updatedAt
);

// Indexes for faster queries
campaignSchema.index({ title: 'text', description: 'text' }); // Full-text search
campaignSchema.index({ creator: 1 }); // Faster creator lookups
campaignSchema.index({ category: 1, status: 1 }); // Filter by category/status

export default mongoose.model('Campaign', campaignSchema);