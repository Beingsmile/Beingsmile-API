import cron from 'node-cron';
import Campaign from '../models/Campaign.js';

// complete campaigns that have ended
export const autoCompleteCampaignsJob = async () => {
  const now = new Date();

  const result = await Campaign.updateMany(
    { status: 'active', endDate: { $lte: now } },
    { $set: { status: 'completed' } }
  );

  return result;
};

// Run every 1 minutes
cron.schedule('*/1 * * * *', async () => {
  try {
    console.log('⏰ Running completed campaigns cron job...');

    const updated = await autoCompleteCampaignsJob();

    console.log(`✅ Auto-completed ${updated.modifiedCount} campaigns.`);
  } catch (error) {
    console.error('❌ Error in auto-complete job:', error);
  }
});
