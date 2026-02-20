import express from "express";
import { 
  initiatePayment, 
  handlePaymentSuccess, 
  handlePaymentFail, 
  handlePaymentCancel,
  getUserDonations 
} from "../controllers/aamarpayController.js";
import { authenticate } from "../middleware/campaignMiddleware.js";

const router = express.Router();

// Aamarpay payment initiation
router.post("/aamarpay/initiate", initiatePayment);

// Aamarpay callback handlers
router.post("/aamarpay/success", handlePaymentSuccess);
router.post("/aamarpay/fail", handlePaymentFail);
router.post("/aamarpay/cancel", handlePaymentCancel);

// Get user's donation history (requires authentication)
router.get("/user-donations", authenticate, getUserDonations);

export default router;
