import express from "express";
import { 
  initiatePayment, 
  handlePaymentSuccess, 
  handlePaymentFail, 
  handlePaymentCancel,
  getUserDonations 
} from "../controllers/aamarpayController.js";
import { authenticate } from "../middleware/campaignMiddleware.js";
import { optionalVerifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Aamarpay payment initiation
router.post("/aamarpay/initiate", optionalVerifyToken, initiatePayment);

// Aamarpay callback handlers
router.post("/aamarpay/success", handlePaymentSuccess);
router.post("/aamarpay/fail", handlePaymentFail);
router.post("/aamarpay/cancel", handlePaymentCancel);

// Get transaction details for receipt (public via TID)
router.get("/transaction/:tid", (req, res, next) => {
    import("../controllers/aamarpayController.js").then(ctrl => ctrl.getTransactionByTid(req, res)).catch(next);
});

// Get user's donation history (requires authentication)
router.get("/user-donations", authenticate, getUserDonations);

export default router;
