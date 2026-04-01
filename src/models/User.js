import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Firebase UID - Primary Auth Key
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        message: 'Invalid email format',
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: '', // Cloudinary URL
    },
    bio: {
      type: String,
      trim: true,
      default: '',
    },

    // Core Categorization
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
    },
    userType: {
      type: String,
      enum: ['donor', 'fundraiser'],
      required: true,
      default: 'donor',
    },

    // Identity Verification (Cross-Check Support)
    identity: {
      idNumber: { 
        type: String, 
        select: false // Only admins should see this by default
      }, 
      idHash: { 
        type: String, 
        unique: true, 
        sparse: true // Allows multiple unverified users (null) but keeps verified IDs unique
      },
      idType: { type: String, enum: ['NID', 'Passport', 'Driving License', 'Other'] },
      isVerified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },

    // System Status
    status: {
      type: String,
      enum: ['active', 'suspended', 'pending_deletion'],
      default: 'active',
    },
    statusMessage: {
      type: String, // Reason for suspension/activation
      default: '',
    },
    
    // Security (2FA)
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      twoFactorSecret: { type: String, select: false },
      last2faCheck: Date,
    },

    // Public Profile Configuration
    publicProfile: {
      isVisible: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: false },
      showDonations: { type: Boolean, default: true },
      socialLinks: {
        facebook: String,
        twitter: String,
        linkedin: String,
        website: String,
      },
    },

    // Metrics & History (Denormalized for performance)
    metrics: {
      totalDonated: { type: Number, default: 0 },
      totalRaised: { type: Number, default: 0 },
      campaignCount: { type: Number, default: 0 },
    },
    
    lastLogin: Date,
  },
  { timestamps: true }
);

// Indexes for performance & integrity
userSchema.index({ slug: 1 });
userSchema.index({ 'identity.idHash': 1 }, { unique: true, sparse: true });

export default mongoose.model('User', userSchema);