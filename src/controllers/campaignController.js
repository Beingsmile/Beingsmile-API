import mongoose from "mongoose";
import Campaign from "../models/Campaign.js";
import User from "../models/User.js";

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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    const campaign = await Campaign.findById(id).populate(
      "creator",
      "avatar name email"
    ); // Optional: include creator's info

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
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    if (!req.uid) {
      return res.status(401).json({ message: "Invalid token" });
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
    console.error("Error fetching user campaigns:", err);
    res.status(500).json({ message: "Server error" });
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
      .populate("creator", "name email"); // include creator info

    res.status(200).json({
      campaigns,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete campaign by ID (admin/mod or creator only)
export const deleteCampaign = async (req, res) => {
  const { id: campaignId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

  
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
      return res
        .status(403)
        .json({ message: "Forbidden: You cannot delete this campaign" });
    }
  } catch (err) {
    console.error("Error deleting campaign:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Search and filter campaigns
export const getFilteredCampaigns = async (req, res) => {
  try {
    const {
      category,
      status,
      search,
      goalMin,
      goalMax,
      raisedMin,
      raisedMax,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (goalMin || goalMax) {
      query.goalAmount = {};
      if (goalMin) query.goalAmount.$gte = Number(goalMin);
      if (goalMax) query.goalAmount.$lte = Number(goalMax);
    }

    if (raisedMin || raisedMax) {
      query.currentAmount = {};
      if (raisedMin) query.currentAmount.$gte = Number(raisedMin);
      if (raisedMax) query.currentAmount.$lte = Number(raisedMax);
    }

    if (dateFrom || dateTo) {
      query.startDate = {};
      if (dateFrom) query.startDate.$gte = new Date(dateFrom);
      if (dateTo) query.startDate.$lte = new Date(dateTo);
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Sort by status priority and createdAt
    const campaigns = await Campaign.aggregate([
      { $match: query },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "active"] }, then: 1 },
                { case: { $eq: ["$status", "completed"] }, then: 2 },
                { case: { $eq: ["$status", "suspended"] }, then: 3 },
              ],
              default: 4,
            },
          },
        },
      },
      { $sort: { statusPriority: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
    ]);

    const total = await Campaign.countDocuments(query);

    res.status(200).json({
      campaigns,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add an update to a campaign
export const addCampaignUpdate = async (req, res) => {
  try {
    const { id } = req.params; // Campaign ID 
    const { title, content, images } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    if (!req.uid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // Only creator can post updates
    if (campaign.creator.toString() !== req.uid) {
      return res.status(403).json({ message: "Forbidden: Not the campaign creator" });
    }

    const newUpdate = {
      title,
      content,
      images,
      postedAt: new Date(),
    };

    campaign.updates.unshift(newUpdate); // Add to beginning of the array

    await campaign.save();

    res.status(200).json({ message: "Update added successfully", updates: campaign.updates });
  } catch (err) {
    console.error("Error adding update:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all updates for a specific campaign
export const getCampaignUpdates = async (req, res) => {
  try {
    const { id } = req.params; // Campaign ID 

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.status(200).json({ updates: campaign.updates });
  } catch (err) {
    console.error("Error fetching updates:", err);
    res.status(500).json({ message: "Server error" });
  }
};
