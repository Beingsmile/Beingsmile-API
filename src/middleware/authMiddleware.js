import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware for validating user input during registration and login
export const validateInput = [
  body('email').isEmail().normalizeEmail(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax",
  path: "/",
};

export const verifyToken = (req, res, next) => {
  const token = req.cookies.jwttoken;

  if (!token) {
    return res.status(401).json({ message: "Authentication token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.uid = decoded.id; // Map decoded.id to req.uid (consistent with campaignController)
    req.role = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.uid);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: "Server error during authorization" });
  }
};

export const verifyJwtOrLogout = (req, res, next) => {
  const token = req.cookies.jwttoken;

  if (!token) {
    return res.status(401).json({ message: "Authentication token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.uid = decoded.id; 
    next();
  } catch (err) {
    res.clearCookie("jwttoken", COOKIE_OPTIONS);
    return res.status(200).json({ message: "Logged out successfully" });
  }
};

export const optionalVerifyToken = (req, res, next) => {
  const token = req.cookies.jwttoken;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.uid = decoded.id;
    req.role = decoded.role;
    next();
  } catch (err) {
    // If token is invalid, just proceed as guest
    next();
  }
};

// ========================================
// RATE LIMITING for login and registration
// ========================================
export const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  max: 15, // 15 login attempts per IP
  message: 'Too many attempts. Try again later.',
});