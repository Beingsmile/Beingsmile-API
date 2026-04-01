import express from "express";
import { register, login, logout, getUserByFirebaseUid, getUserById, checkUserExistsWithJWT, getPublicProfileBySlug, sendOTP, verifyOTP } from "../controllers/authController.js";
import { authRateLimiter, validateInput, verifyJwtOrLogout } from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication routes
router.post("/register", validateInput, authRateLimiter, register);
router.post("/login", validateInput, authRateLimiter, login);
router.post("/logout", logout);
router.get("/me/:id", getUserById);
router.get("/me/firebase/:firebaseUid", verifyJwtOrLogout, getUserByFirebaseUid);
router.get("/user/exist/:firebaseUid", checkUserExistsWithJWT);
router.get("/public/:slug", getPublicProfileBySlug);
router.post("/send-otp", authRateLimiter, sendOTP);
router.post("/verify-otp", authRateLimiter, verifyOTP);

export default router;