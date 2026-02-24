import express from "express";
import { updateUserProfile, updateUserAvatar, getMyProfile } from "../controllers/userController.js";
import { authenticate } from "../middleware/campaignMiddleware.js";

const router = express.Router();

// All user routes require authentication
router.get("/me", authenticate, getMyProfile);
router.put("/profile/update", authenticate, updateUserProfile);
router.put("/profile/avatar", authenticate, updateUserAvatar);

export default router;
