import express from "express";
import { register, login, logout, getUserByFirebaseUid, getUserById } from "../controllers/authController.js";
import { authRateLimiter, validateInput, verifyJwtOrLogout } from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication routes
router.post("/register", validateInput, authRateLimiter, register);
router.post("/login", validateInput, authRateLimiter, login);
router.post("/logout", logout);
router.get("/me/:id", getUserById);
router.get("/me/firebase/:firebaseUid", verifyJwtOrLogout, getUserByFirebaseUid);

export default router;