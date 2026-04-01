import express from "express";
import { 
  getAdminStats, 
  getPendingCampaigns, 
  reviewCampaign, 
  getAllUsers, 
  toggleUserStatus,
  getVerificationRequests,
  reviewVerificationRequest,
  manualVerifyUser,
  getUserVerificationHistory
} from "../controllers/adminController.js";
import { verifyToken, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes here require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

router.get("/stats", getAdminStats);
router.get("/pending-campaigns", getPendingCampaigns);
router.patch("/campaigns/:id/review", reviewCampaign);
router.get("/users", getAllUsers);
router.patch("/users/:id/toggle-status", toggleUserStatus);
router.get("/verifications", getVerificationRequests);
router.patch("/verifications/:id/review", reviewVerificationRequest);
router.patch("/users/:id/verify", manualVerifyUser);
router.get("/users/:id/verification-history", getUserVerificationHistory);

export default router;
