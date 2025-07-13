import express from 'express';
import { createCampaign, deleteCampaign, getAllCampaigns, getCampaignById, getUserCampaigns, getFilteredCampaigns, addCampaignUpdate, getCampaignUpdates } from '../controllers/campaignController.js';
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
router.delete("/:id", authenticate, deleteCampaign);

export default router;