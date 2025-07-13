import express from 'express';
import { createCampaign } from '../controllers/campaignController.js';
import { authenticate } from '../middleware/campaignMiddleware.js';

const router = express.Router();

// Campaign routes
router.post('/create', authenticate, createCampaign);

export default router;