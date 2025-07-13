import express from 'express';
import { createCampaign, deleteCampaign, getAllCampaigns, getCampaignById, getUserCampaigns } from '../controllers/campaignController.js';
import { authenticate } from '../middleware/campaignMiddleware.js';

const router = express.Router();

// Campaign routes
router.post('/create', authenticate, createCampaign);
router.get('/all', getAllCampaigns);
router.get('/my-campaigns', authenticate, getUserCampaigns);
router.get('/:id', getCampaignById);
router.delete("/:id", authenticate, deleteCampaign);

export default router;