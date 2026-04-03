import express from 'express';
import {
  createCampaign,
  deleteCampaign,
  getAllCampaigns,
  getCampaignById,
  getUserCampaigns,
  getFilteredCampaigns,
  getCampaignUpdates,
  submitPendingUpdate,
  addCampaignUpdate,
  suspendCampaign,
  updateCampaign,
  getFeaturedCampaigns,
  getTrendingCampaigns,
  getNewestCampaigns,
  toggleRecommend,
  toggleSave,
  getSavedCampaigns,
  toggleSubscribe,
  uploadAdditionalDocuments,
  addComment,
  addReply,
  getComments,
  getPublicPlatformSettings,
  deletePendingUpdate,
} from '../controllers/campaignController.js';
import { authenticate } from '../middleware/campaignMiddleware.js';
import { verifyJwtOrLogout, optionalVerifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Public discovery ──────────────────────────────────────────────────────────
router.get('/featured',          getFeaturedCampaigns);
router.get('/trending',          getTrendingCampaigns);
router.get('/newest',            getNewestCampaigns);
router.get('/all',               getAllCampaigns);
router.get('/search',            getFilteredCampaigns);
router.get('/platform-settings', getPublicPlatformSettings);

// ── Authenticated user routes ─────────────────────────────────────────────────
router.get('/my-campaigns',      authenticate, getUserCampaigns);
router.get('/saved',             authenticate, getSavedCampaigns);
router.post('/create',           authenticate, createCampaign);

// ── Single campaign (optionalAuth so we can flag isRecommendedByMe etc.) ──────
router.get('/:id',               optionalVerifyToken, getCampaignById);

// ── Mission updates ───────────────────────────────────────────────────────────
router.get('/:id/updates',                               getCampaignUpdates);
router.post('/:id/updates',      authenticate,           submitPendingUpdate);
router.delete('/:id/updates/:updateId', authenticate,    deletePendingUpdate);

// ── Mission settings (creator) ────────────────────────────────────────────────
router.patch('/:id',             authenticate,           updateCampaign);
router.delete('/:id',            authenticate,           deleteCampaign);
router.post('/:id/documents',    authenticate,           uploadAdditionalDocuments);

// ── Admin actions ─────────────────────────────────────────────────────────────
router.patch('/:id/suspend',     authenticate,           suspendCampaign);

// ── Engagement ────────────────────────────────────────────────────────────────
router.post('/:id/recommend',    authenticate,           toggleRecommend);
router.post('/:id/save',         authenticate,           toggleSave);
router.post('/:id/subscribe',    authenticate,           toggleSubscribe);

// ── Discussion ────────────────────────────────────────────────────────────────
router.get('/:id/comments',                              optionalVerifyToken, getComments);
router.post('/:id/comments',     verifyJwtOrLogout,      addComment);
router.post('/:campaignId/comments/:commentId/replies', verifyJwtOrLogout, addReply);

export default router;