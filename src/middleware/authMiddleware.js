import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

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

// ========================================
// RATE LIMITING for login and registration
// ========================================
export const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  max: 15, // 15 login attempts per IP
  message: 'Too many attempts. Try again later.',
});