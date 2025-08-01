import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

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

export const verifyJwtOrLogout = (req, res, next) => {
  const token = req.cookies.jwttoken;

  if (!token) {
    return res.status(401).json({ message: "Authentication token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // attach user info to request
    next(); // token is valid, continue
  } catch (err) {
    // Token expired or invalid
    res.clearCookie("jwttoken", COOKIE_OPTIONS);
    return res.status(200).json({ message: "Logged out successfully" });
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