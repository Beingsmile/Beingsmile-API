import express from "express";
import { register, login } from "../controllers/authController.js";
import { authRateLimiter, validateInput } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", validateInput, authRateLimiter, register);
router.post("/login", validateInput, authRateLimiter, login);

export default router;