import express from "express";
import { register, login, logout } from "../controllers/authController.js";
import { authRateLimiter, validateInput } from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication routes
router.post("/register", validateInput, authRateLimiter, register);
router.post("/login", validateInput, authRateLimiter, login);
router.post("/logout", logout);

export default router;