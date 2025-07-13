import express from 'express';
import { createCampaign, deleteCampaign, getAllCampaigns, getCampaignById, getUserCampaigns, getFilteredCampaigns, addCampaignUpdate, getCampaignUpdates, suspendCampaign, autoCompleteCampaigns } from '../controllers/campaignController.js';
import { authenticate } from '../middleware/campaignMiddleware.js';

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
router.delete("/:id", authenticate, deleteCampaign);
router.patch('/auto-complete', autoCompleteCampaigns);

export default router;