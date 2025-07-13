import Campaign from '../models/Campaign.js';

// create new campaign
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

// get specific campaign by ID
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id)
      .populate('creator', 'avatar name email') // Optional: include creator's info

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.status(200).json({ campaign });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
