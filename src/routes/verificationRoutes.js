import express from "express";
import { submitVerificationRequest, getMyRequests } from "../controllers/verificationController.js";
import { authenticate } from "../middleware/campaignMiddleware.js";

const router = express.Router();

router.post("/submit", authenticate, submitVerificationRequest);
router.get("/my-requests", authenticate, getMyRequests);

export default router;
