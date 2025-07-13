import express from 'express';
import { createCampaign, getCampaignById } from '../controllers/campaignController.js';
import { authenticate } from '../middleware/campaignMiddleware.js';

const router = express.Router();

// Campaign routes
router.post('/create', authenticate, createCampaign);
router.get('/:id', getCampaignById);

export default router;