import express from "express";
import { 
  requestWithdrawal, 
  getCampaignWithdrawals, 
  getPendingWithdrawals, 
  reviewWithdrawal, 
  completeWithdrawal 
} from "../controllers/payoutController.js";
import { verifyToken, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Fundraiser Routes
router.post("/request", verifyToken, requestWithdrawal);
router.get("/campaign/:campaignId", verifyToken, getCampaignWithdrawals);

// Admin Routes
router.get("/pending", verifyToken, isAdmin, getPendingWithdrawals);
router.patch("/review/:id", verifyToken, isAdmin, reviewWithdrawal);
router.patch("/complete/:id", verifyToken, isAdmin, completeWithdrawal);

export default router;
