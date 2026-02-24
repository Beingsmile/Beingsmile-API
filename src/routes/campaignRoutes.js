import express from 'express';
import { createCampaign, deleteCampaign, getAllCampaigns, getCampaignById, getUserCampaigns, getFilteredCampaigns, addCampaignUpdate, getCampaignUpdates, suspendCampaign, updateCampaign } from '../controllers/campaignController.js';
import { authenticate } from '../middleware/campaignMiddleware.js';
import { addComment, addReply, getComments } from "../controllers/campaignController.js";
import { verifyJwtOrLogout } from '../middleware/authMiddleware.js';

const router = express.Router();

// Campaign routes
router.post('/create', authenticate, createCampaign);
router.get('/all', getAllCampaigns);
router.get('/my-campaigns', authenticate, getUserCampaigns);
router.get('/search', getFilteredCampaigns);
router.get('/:id', getCampaignById);
router.get("/:id/updates", getCampaignUpdates);
router.post("/:id/updates", authenticate, addCampaignUpdate);
router.patch('/:id/suspend', authenticate, suspendCampaign);
router.patch('/:id', authenticate, updateCampaign);
router.delete("/:id", authenticate, deleteCampaign);
router.post('/:id/comments', verifyJwtOrLogout, addComment);
router.post('/:campaignId/comments/:commentId/replies', verifyJwtOrLogout, addReply);
router.get('/:id/comments', verifyJwtOrLogout, getComments);

export default router;