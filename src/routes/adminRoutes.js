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
  getUserVerificationHistory,
  // New Phase 2 additions
  getAllCampaignsAdmin,
  getPendingUpdates,
  reviewPendingUpdate,
  toggleFeatured,
  postAdminNotice,
  getPlatformSettings,
  updatePlatformSettings,
} from "../controllers/adminController.js";
import { verifyToken, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication + admin/moderator role
router.use(verifyToken);
router.use(isAdmin);

// ── Stats ──────────────────────────────────────────────────────────────────
router.get("/stats",                                    getAdminStats);

// ── Campaign Management ────────────────────────────────────────────────────
router.get("/campaigns",                                getAllCampaignsAdmin);
router.get("/pending-campaigns",                        getPendingCampaigns);
router.patch("/campaigns/:id/review",                   reviewCampaign);
router.patch("/campaigns/:id/featured",                 toggleFeatured);
router.post("/campaigns/:id/notice",                    postAdminNotice);

// ── Pending Mission Updates ────────────────────────────────────────────────
router.get("/pending-updates",                          getPendingUpdates);
router.patch("/campaigns/:campaignId/updates/:updateId/review", reviewPendingUpdate);

// ── User Management ───────────────────────────────────────────────────────
router.get("/users",                                    getAllUsers);
router.patch("/users/:id/toggle-status",                toggleUserStatus);
router.patch("/users/:id/verify",                       manualVerifyUser);
router.get("/users/:id/verification-history",           getUserVerificationHistory);

// ── Verification Requests ─────────────────────────────────────────────────
router.get("/verifications",                            getVerificationRequests);
router.patch("/verifications/:id/review",               reviewVerificationRequest);

// ── Platform Settings ─────────────────────────────────────────────────────
router.get("/settings",                                 getPlatformSettings);
router.patch("/settings",                               updatePlatformSettings);

export default router;
