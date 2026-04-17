import express from "express";
import { 
  getMyWallet,
  getMyWithdrawals,
  requestWithdrawal, 
  getCampaignWithdrawals, 
  getPendingWithdrawals, 
  reviewWithdrawal, 
  completeWithdrawal,
  getPayoutLogs
} from "../controllers/payoutController.js";
import { verifyToken, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Fundraiser Routes
router.get("/wallet", verifyToken, getMyWallet);
router.get("/my-requests", verifyToken, getMyWithdrawals);
router.post("/request", verifyToken, requestWithdrawal);
router.get("/campaign/:campaignId", verifyToken, getCampaignWithdrawals);

// Admin Routes
router.get("/pending", verifyToken, isAdmin, getPendingWithdrawals);
router.get("/logs", verifyToken, isAdmin, getPayoutLogs);
router.patch("/review/:id", verifyToken, isAdmin, reviewWithdrawal);
router.patch("/complete/:id", verifyToken, isAdmin, completeWithdrawal);

export default router;
