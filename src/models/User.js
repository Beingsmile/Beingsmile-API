import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Firebase UID
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
      validate: {
        validator: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        message: 'Invalid email format',
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // Other fields
    avatar: String,
    bio: String,
    donatedCampaigns: [
      {
        campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
        amount: Number,
        donatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);