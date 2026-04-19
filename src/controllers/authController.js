import mongoose from "mongoose";
import User from "../models/User.js";
import OTP from "../models/OTP.js";
import generateToken, { COOKIE_OPTIONS } from "../utils/jwt.js";
import { generateUniqueSlug } from "../utils/userUtils.js";
import { sendOTPEmail, sendResetPasswordEmail } from "../utils/emailUtils.js";
import Notification from "../models/Notification.js";
import { adminAuth } from "../config/firebaseAdmin.js";

// Register
export const register = async (req, res) => {
  try {
    const { uid, name, email, userType } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(name);

    // Create user
    const user = await User.create({
      firebaseUid: uid, // Firebase UID
      name,
      email,
      slug,
      userType: userType || 'donor',
      isEmailVerified: req.body.isEmailVerified || false,
      metrics: {
        totalDonated: 0,
        totalRaised: 0,
        campaignCount: 0,
      },
    });

    const token = generateToken(user._id, 'user'); // Generate JWT token

    res.cookie("jwttoken", token, COOKIE_OPTIONS);
    res.status(201).json({ user });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, uid } = req.body;
    console.log(`🔐 Login attempt: email=${email}, uid=${uid}`);

    let user;
    if (uid) {
      user = await User.findOne({ firebaseUid: uid });
    }
    
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    }

    if (!user) {
      console.log(`❌ Login failed: User not found for email=${email}, uid=${uid}`);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log(`✅ Login successful for user: ${user.email} (ID: ${user._id})`);

    // Check email verification
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        message: "PLEASE_VERIFY_EMAIL", 
        reason: "Your email address is not verified yet. Please complete verification to access your account." 
      });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({ 
        message: "ACCOUNT_SUSPENDED", 
        reason: user.statusMessage || "Your account has been suspended for violating platform policies." 
      });
    }

    const token = generateToken(user._id, 'user'); // Generate JWT token

    res.cookie("jwttoken", token, COOKIE_OPTIONS);
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Send OTP
export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to DB (upsert)
    await OTP.findOneAndUpdate(
      { email },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    // Send Email
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send verification email" });
    }

    res.status(200).json({ message: "Verification code sent to your email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Verify OTP
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    const otpData = await OTP.findOne({ email, otp });
    if (!otpData) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    // Success - delete OTP
    await OTP.deleteOne({ _id: otpData._id });

    // Check if user already exists (for logging in after verification or re-verifying)
    const user = await User.findOne({ email });
    if (user) {
      user.isEmailVerified = true;
      await user.save();
    }

    res.status(200).json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No user found with this email" });
    }

    // Generate Firebase Reset Link
    const actionCodeSettings = {
      url: `${process.env.FRONTEND_URL}/reset-password`,
      handleCodeInApp: true,
    };

    if (!adminAuth) {
      throw new Error("Firebase Admin SDK not initialized. Please check service account configuration.");
    }
    const firebaseResetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

    // Extract oobCode to build a direct link to our frontend
    const urlObj = new URL(firebaseResetLink);
    const oobCode = urlObj.searchParams.get("oobCode");
    const directResetLink = `${process.env.FRONTEND_URL}/reset-password?oobCode=${oobCode}`;

    // Send Custom Email with direct link
    const emailSent = await sendResetPasswordEmail(email, directResetLink);
    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send reset email" });
    }

    res.status(200).json({ success: true, message: "Custom reset link sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Logout route
export const logout = async (req, res) => {
  res.clearCookie("jwttoken", COOKIE_OPTIONS);
  res.status(200).json({ message: "Logged out successfully" });
};

// get user by Firebase UID
export const getUserByFirebaseUid = async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    if (!firebaseUid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = generateToken(user._id, 'user'); // Generate JWT token

    res.cookie("jwttoken", token, COOKIE_OPTIONS);
    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user by Firebase UID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get public profile by slug
export const getPublicProfileBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    let query = { slug, status: 'active' };
    
    // Check if the slug is actually a valid MongoDB ID
    if (mongoose.Types.ObjectId.isValid(slug)) {
      query = { 
        $or: [
          { _id: slug, status: 'active' },
          { slug: slug, status: 'active' }
        ] 
      };
    }

    const user = await User.findOne(query)
      .select('name avatar bio metrics userType identity.isVerified publicProfile createdAt slug');

    if (!user) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Fetch user's active campaigns to return in a single request (Optimization)
    const Campaign = mongoose.model('Campaign');
    const campaigns = await Campaign.find({
      creator: user._id,
      status: 'active'
    }).select('title coverImage category goalAmount currentAmount').sort({ createdAt: -1 });

    res.status(200).json({ 
      user: {
        ...user.toObject(),
        campaigns
      }
    });
  } catch (error) {
    console.error("Error fetching public profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = generateToken(user._id, 'user'); // Generate JWT token

    res.cookie("jwttoken", token, COOKIE_OPTIONS);
    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Check if user exists by Firebase UID
export const checkUserExistsWithJWT = async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    if (!firebaseUid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = generateToken(user._id, 'user'); // Generate JWT token

    res.cookie("jwttoken", token, COOKIE_OPTIONS);
    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user by Firebase UID:", error);
    res.status(500).json({ message: "Server error" });
  }
};