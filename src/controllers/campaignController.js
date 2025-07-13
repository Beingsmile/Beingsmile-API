import Campaign from '../models/Campaign.js';
import User from '../models/User.js';

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

// Get campaigns by creator ID with pagination
export const getUserCampaigns = async (req, res) => {
  try {
    const token = req.cookies?.jwttoken;

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    if (!req.uid) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get page number from query, default = 1
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get total count of campaigns by user (for frontend pagination)
    const total = await Campaign.countDocuments({ creator: req.uid });

    // Fetch paginated campaigns
    const campaigns = await Campaign.find({ creator: req.uid })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      campaigns,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Error fetching user campaigns:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all campaigns 
export const getAllCampaigns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const total = await Campaign.countDocuments();

    const campaigns = await Campaign.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // newest first
      .populate('creator', 'name email'); // include creator info

    res.status(200).json({
      campaigns,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete campaign by ID (admin/mod or creator only)
export const deleteCampaign = async (req, res) => {
  const { id: campaignId } = req.params;

  try {
    // Find the campaign
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // Check if user is admin/moderator
    const user = await User.findById(req.uid);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const isAdminOrMod = user.role === "admin" || user.role === "moderator";

    // Allow if user is admin/mod or campaign creator
    if (isAdminOrMod || campaign.creator.toString() === req.uid) {
      await Campaign.findByIdAndDelete(campaignId);
      return res.status(200).json({ message: "Campaign deleted successfully" });
    } else {
      return res.status(403).json({ message: "Forbidden: You cannot delete this campaign" });
    }

  } catch (err) {
    console.error("Error deleting campaign:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
