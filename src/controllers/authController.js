import User from "../models/User.js";
import generateToken, { COOKIE_OPTIONS } from "../utils/jwt.js";

// Register
export const register = async (req, res) => {
  try {
    const { uid, name, email } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Create user
    const user = await User.create({
      firebaseUid: uid, // Firebase UID
      name,
      email,
    });

    const token = generateToken(user._id); // Generate JWT token

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
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id); // Generate JWT token

    res.cookie("jwttoken", token, COOKIE_OPTIONS);
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logout route
export const logout = async (req, res) => {
  res.clearCookie("jwttoken", COOKIE_OPTIONS);
  res.status(200).json({ message: "Logged out successfully" });
};
