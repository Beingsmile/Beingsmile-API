import Campaign from '../models/Campaign.js';

export const createCampaign = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      goalAmount,
      coverImage,
      images,
      endDate,
    } = req.body;

    const newCampaign = await Campaign.create({
      title,
      description,
      category,
      goalAmount,
      coverImage,
      images,
      endDate,
      creator: req.uid, // From JWT middleware
    });

    res.status(201).json({ success: true, campaign: newCampaign });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
