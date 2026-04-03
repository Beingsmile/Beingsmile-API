import mongoose from "mongoose";
import Campaign, { CAMPAIGN_CATEGORIES } from "../models/Campaign.js";
import User from "../models/User.js";
import PlatformSettings from "../models/PlatformSettings.js";
import Notification from "../models/Notification.js";
import { uploadImage } from '../utils/cloudinaryUtils.js';

// ─── Helper: Send notification safely ────────────────────────────────────────
const notify = async (data) => {
  try { await Notification.create(data); } catch (e) { console.error("Notify error:", e.message); }
};

// ─── Helper: Update trending score ───────────────────────────────────────────
const refreshTrendingScore = async (campaign) => {
  campaign.trendingScore = campaign.computeTrendingScore();
  await campaign.save();
};

// ══════════════════════════════════════════════════════════════════
// CREATE CAMPAIGN
// ══════════════════════════════════════════════════════════════════
export const createCampaign = async (req, res) => {
  try {
    const {
      title, tagline, description, category, goalAmount,
      coverImage, images, endDate, location, verificationDocuments,
    } = req.body;

    const user = await User.findById(req.uid).select('name identity');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.identity?.isVerified) {
      return res.status(403).json({ success: false, message: 'Only verified fundraisers can launch missions. Please complete your identity verification first.' });
    }
    if (!CAMPAIGN_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `Invalid category. Valid options: ${CAMPAIGN_CATEGORIES.join(', ')}` });
    }
    if (Number(goalAmount) < 100) {
      return res.status(400).json({ success: false, message: 'Goal amount must be at least ৳100' });
    }

    const uploadedCover = await uploadImage(coverImage, `campaign_covers/${Date.now()}`);
    const uploadedImages = [];
    if (images?.length) {
      for (const img of images) {
        const r = await uploadImage(img, `campaign_images/${Date.now()}_${Math.random()}`);
        uploadedImages.push(r.secure_url);
      }
    }
    const uploadedDocs = [];
    if (verificationDocuments?.length) {
      for (const doc of verificationDocuments) {
        const r = await uploadImage(doc, `campaign_docs/${Date.now()}_${Math.random()}`);
        uploadedDocs.push(r.secure_url);
      }
    }

    const newCampaign = await Campaign.create({
      title, tagline, description, category, goalAmount, location,
      coverImage: uploadedCover.secure_url,
      images: uploadedImages,
      creatorUsername: user.name,
      endDate, creator: req.uid,
      status: 'pending',
      verificationDetails: { documents: uploadedDocs },
      isFeatured: false,
    });

    // Notify admins about new pending campaign
    const admins = await User.find({ role: { $in: ['admin', 'moderator'] } }).select('_id');
    await Notification.insertMany(admins.map(a => ({
      recipient: a._id,
      title: 'New Mission Pending Review',
      message: `"${title}" has been submitted for review by ${user.name}.`,
      type: 'campaign_status',
      relatedId: newCampaign._id.toString(),
      link: `/admin/review`,
    })));

    res.status(201).json({ success: true, campaign: newCampaign });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET CAMPAIGN BY ID
// ══════════════════════════════════════════════════════════════════
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    const campaign = await Campaign.findById(id)
      .populate("creator", "avatar name email slug")
      .populate("donations.donor", "name avatar")
      .populate("comments.user", "name avatar")
      .populate("comments.replies.user", "name avatar");

    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const isAdmin = req.role === 'admin' || req.role === 'moderator';
    const isCreator = req.uid && campaign.creator?._id.toString() === req.uid;

    // Redact admin-only fields from public response
    const campaignObj = campaign.toObject({ virtuals: true });

    if (!isAdmin && !isCreator) {
      campaignObj.verificationDetails = { adminNotes: campaign.verificationDetails?.adminNotes };
      campaignObj.pendingUpdates = []; // Hide pending updates from public
      // Redact fully-anonymous donations
      campaignObj.donations = campaignObj.donations.map(d => {
        if (d.isAnonymousFromAll) {
          return { ...d, donor: null, donorName: "Anonymous", donorEmail: undefined };
        }
        if (d.isAnonymous) {
          return { ...d, donorEmail: undefined };
        }
        return { ...d, donorEmail: undefined };
      });
    } else if (isCreator && !isAdmin) {
      // Creator can see public-anonymous names but not fully-anonymous ones
      campaignObj.donations = campaignObj.donations.map(d => {
        if (d.isAnonymousFromAll) {
          return { ...d, donor: null, donorName: "Anonymous (Hidden)", donorEmail: undefined };
        }
        return { ...d, donorEmail: undefined };
      });
    }

    // Check if current user has recommended / saved this campaign
    if (req.uid) {
      campaignObj.isRecommendedByMe = campaign.recommendations.some(
        r => r.user?.toString() === req.uid
      );
      campaignObj.isSavedByMe = campaign.savedBy.some(
        s => s?.toString() === req.uid
      );
      campaignObj.isSubscribed = campaign.notificationSubscribers.some(
        s => s.user?.toString() === req.uid
      );
    }

    res.status(200).json({ campaign: campaignObj });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET USER'S OWN CAMPAIGNS
// ══════════════════════════════════════════════════════════════════
export const getUserCampaigns = async (req, res) => {
  try {
    if (!req.uid) return res.status(401).json({ message: "Invalid token" });

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const total = await Campaign.countDocuments({ creator: req.uid });

    const campaigns = await Campaign.find({ creator: req.uid })
      .select("title coverImage goalAmount currentAmount withdrawnAmount endDate creatorUsername category status isFeatured adminNotice trendingScore recommendations donations")
      .skip(skip).limit(limit).sort({ createdAt: -1 });

    res.status(200).json({ campaigns, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET ALL CAMPAIGNS (paginated)
// ══════════════════════════════════════════════════════════════════
export const getAllCampaigns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const total = await Campaign.countDocuments({ status: "active" });
    const campaigns = await Campaign.find({ status: "active" })
      .select("title coverImage goalAmount currentAmount endDate creatorUsername category status isFeatured recommendations donations")
      .skip(skip).limit(limit).sort({ createdAt: -1 })
      .populate("creator", "name");

    res.status(200).json({ campaigns, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ══════════════════════════════════════════════════════════════════
// SEARCH / FILTER CAMPAIGNS
// ══════════════════════════════════════════════════════════════════
export const getFilteredCampaigns = async (req, res) => {
  try {
    const {
      category, status, search, goalMin, goalMax,
      sort = "newest", page = 1, limit = 6,
    } = req.query;

    const query = {};
    if (category) query.category = category;
    query.status = status || "active";
    if (search) query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tagline: { $regex: search, $options: "i" } },
    ];
    if (goalMin || goalMax) {
      query.goalAmount = {};
      if (goalMin) query.goalAmount.$gte = Number(goalMin);
      if (goalMax) query.goalAmount.$lte = Number(goalMax);
    }

    // Sort logic
    let sortObj = {};
    switch (sort) {
      case "trending":    sortObj = { trendingScore: -1 }; break;
      case "recommended": sortObj = { "recommendations.length": -1, trendingScore: -1 }; break;
      case "ending_soon": sortObj = { endDate: 1 }; break;
      case "close_to_goal":
        // Handled via aggregation below
        break;
      case "oldest":      sortObj = { createdAt: 1 }; break;
      default:            sortObj = { createdAt: -1 }; // newest
    }

    const skip = (Number(page) - 1) * Number(limit);

    let campaigns;
    if (sort === "close_to_goal" || sort === "recommended") {
      campaigns = await Campaign.aggregate([
        { $match: query },
        {
          $addFields: {
            fundingPercent: { $cond: [{ $gt: ["$goalAmount", 0] }, { $divide: ["$currentAmount", "$goalAmount"] }, 0] },
            recommendCount: { $size: { $ifNull: ["$recommendations", []] } },
          }
        },
        { $sort: sort === "close_to_goal" ? { fundingPercent: -1 } : { recommendCount: -1, trendingScore: -1 } },
        { $skip: skip },
        { $limit: Number(limit) },
        { $project: { title: 1, coverImage: 1, goalAmount: 1, currentAmount: 1, endDate: 1, creatorUsername: 1, category: 1, status: 1, isFeatured: 1, recommendations: 1, donations: 1, tagline: 1, trendingScore: 1 } },
      ]);
    } else {
      campaigns = await Campaign.find(query)
        .select("title coverImage goalAmount currentAmount endDate creatorUsername category status isFeatured recommendations donations tagline trendingScore")
        .sort(sortObj).skip(skip).limit(Number(limit));
    }

    const total = await Campaign.countDocuments(query);

    res.status(200).json({ campaigns, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET FEATURED CAMPAIGNS
// ══════════════════════════════════════════════════════════════════
export const getFeaturedCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ isFeatured: true, status: "active" })
      .select("title coverImage goalAmount currentAmount endDate creatorUsername category status recommendations donations tagline")
      .limit(6).sort({ updatedAt: -1 });
    res.status(200).json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET TRENDING CAMPAIGNS
// ══════════════════════════════════════════════════════════════════
export const getTrendingCampaigns = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const campaigns = await Campaign.find({ status: "active" })
      .select("title coverImage goalAmount currentAmount endDate creatorUsername category status recommendations donations tagline trendingScore")
      .sort({ trendingScore: -1 }).limit(limit);
    res.status(200).json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET NEWEST CAMPAIGNS
// ══════════════════════════════════════════════════════════════════
export const getNewestCampaigns = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const campaigns = await Campaign.find({ status: "active" })
      .select("title coverImage goalAmount currentAmount endDate creatorUsername category status recommendations donations tagline")
      .sort({ createdAt: -1 }).limit(limit);
    res.status(200).json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// TOGGLE RECOMMEND
// ══════════════════════════════════════════════════════════════════
export const toggleRecommend = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const alreadyRecommended = campaign.recommendations.some(
      r => r.user?.toString() === req.uid
    );

    if (alreadyRecommended) {
      campaign.recommendations = campaign.recommendations.filter(
        r => r.user?.toString() !== req.uid
      );
    } else {
      campaign.recommendations.push({ user: req.uid });
      // Notify creator (if not self)
      if (campaign.creator.toString() !== req.uid) {
        const actor = await User.findById(req.uid).select('name');
        await notify({
          recipient: campaign.creator,
          sender: req.uid,
          title: 'Someone recommended your mission!',
          message: `${actor?.name || 'A user'} recommended "${campaign.title}".`,
          type: 'mission_recommended',
          relatedId: campaign._id.toString(),
          link: `/campaigns/${campaign._id}`,
        });
      }
    }

    await refreshTrendingScore(campaign);

    res.status(200).json({
      success: true,
      recommended: !alreadyRecommended,
      count: campaign.recommendations.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// TOGGLE SAVE
// ══════════════════════════════════════════════════════════════════
export const toggleSave = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id).select('savedBy title');
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const isSaved = campaign.savedBy.some(s => s?.toString() === req.uid);

    if (isSaved) {
      campaign.savedBy = campaign.savedBy.filter(s => s?.toString() !== req.uid);
    } else {
      campaign.savedBy.push(req.uid);
    }

    await campaign.save();
    res.status(200).json({ success: true, saved: !isSaved, count: campaign.savedBy.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET SAVED CAMPAIGNS
// ══════════════════════════════════════════════════════════════════
export const getSavedCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ savedBy: req.uid, status: { $ne: 'suspended' } })
      .select("title coverImage goalAmount currentAmount endDate creatorUsername category status recommendations donations tagline")
      .sort({ updatedAt: -1 });
    res.status(200).json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// SUBSCRIBE TO CAMPAIGN NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════
export const toggleSubscribe = async (req, res) => {
  try {
    const { id } = req.params;
    const { email = false } = req.body;

    const campaign = await Campaign.findById(id).select('notificationSubscribers creator title');
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const existingIdx = campaign.notificationSubscribers.findIndex(
      s => s.user?.toString() === req.uid
    );

    if (existingIdx > -1) {
      campaign.notificationSubscribers.splice(existingIdx, 1);
      await campaign.save();
      return res.status(200).json({ success: true, subscribed: false });
    }

    campaign.notificationSubscribers.push({ user: req.uid, email });
    await campaign.save();

    // Notify creator
    if (campaign.creator.toString() !== req.uid) {
      const actor = await User.findById(req.uid).select('name');
      await notify({
        recipient: campaign.creator,
        title: 'New mission follower',
        message: `${actor?.name || 'Someone'} is now following updates for "${campaign.title}".`,
        type: 'new_subscriber',
        relatedId: campaign._id.toString(),
        link: `/campaigns/${campaign._id}`,
      });
    }

    res.status(200).json({ success: true, subscribed: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// SUBMIT PENDING UPDATE (creator → needs admin approval)
// ══════════════════════════════════════════════════════════════════
export const submitPendingUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, images } = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.creator.toString() !== req.uid) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const uploadedImages = [];
    if (images?.length) {
      for (const img of images) {
        if (img.startsWith('data:')) {
          const r = await uploadImage(img, `update_images/${Date.now()}_${Math.random()}`);
          uploadedImages.push(r.secure_url);
        } else {
          uploadedImages.push(img); // Already a URL
        }
      }
    }

    campaign.pendingUpdates.push({ title, content, images: uploadedImages, status: 'pending' });
    await campaign.save();

    // Notify admins
    const admins = await User.find({ role: { $in: ['admin', 'moderator'] } }).select('_id');
    await Notification.insertMany(admins.map(a => ({
      recipient: a._id,
      title: 'New Mission Update Pending Review',
      message: `Creator of "${campaign.title}" submitted an update for review.`,
      type: 'pending_mission_update',
      relatedId: campaign._id.toString(),
      link: `/admin/pending-updates`,
    })));

    res.status(200).json({ success: true, message: "Update submitted for admin review." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// DELETE PENDING UPDATE (creator can retract before admin review)
// ══════════════════════════════════════════════════════════════════
export const deletePendingUpdate = async (req, res) => {
  try {
    const { id, updateId } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.creator.toString() !== req.uid) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Pull from pendingUpdates where _id matches updateId
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      id,
      { $pull: { pendingUpdates: { _id: updateId } } },
      { new: true }
    );

    res.status(200).json({ success: true, message: "Pending update retracted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET CAMPAIGN UPDATES (published)
// ══════════════════════════════════════════════════════════════════
export const getCampaignUpdates = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id).select('updates');
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.status(200).json({ updates: campaign.updates });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Keep backward-compat alias (direct post by creator, still used in some places)
export const addCampaignUpdate = submitPendingUpdate;

// ══════════════════════════════════════════════════════════════════
// ADD COMMENT
// ══════════════════════════════════════════════════════════════════
export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text?.trim()) return res.status(400).json({ message: "Comment text required" });

    const userDoc = await User.findById(req.uid).select('name avatar');
    if (!userDoc) return res.status(404).json({ message: "User not found" });

    const campaign = await Campaign.findByIdAndUpdate(
      id,
      { $push: { comments: { user: req.uid, name: userDoc.name, avatar: userDoc.avatar, text } } },
      { new: true }
    ).populate('comments.user', 'name avatar');

    // Notify creator (if commenter is not creator)
    if (campaign.creator.toString() !== req.uid) {
      await notify({
        recipient: campaign.creator,
        sender: req.uid,
        title: 'New comment on your mission',
        message: `${userDoc.name} commented: "${text.slice(0, 80)}..."`,
        type: 'new_comment',
        relatedId: campaign._id.toString(),
        link: `/campaigns/${campaign._id}#discussion`,
      });
    }

    await refreshTrendingScore(campaign);

    res.status(200).json(campaign.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// ADD REPLY TO COMMENT
// ══════════════════════════════════════════════════════════════════
export const addReply = async (req, res) => {
  try {
    const { campaignId, commentId } = req.params;
    const { text } = req.body;

    if (!text?.trim()) return res.status(400).json({ message: "Reply text required" });

    const userDoc = await User.findById(req.uid).select('name avatar');
    if (!userDoc) return res.status(404).json({ message: "User not found" });

    const campaign = await Campaign.findOneAndUpdate(
      { _id: campaignId, 'comments._id': commentId },
      {
        $push: {
          'comments.$.replies': { user: req.uid, name: userDoc.name, avatar: userDoc.avatar, text }
        }
      },
      { new: true }
    ).populate('comments.replies.user', 'name avatar');

    // Find original commenter to notify
    const originalComment = campaign.comments.id(commentId);
    if (originalComment && originalComment.user?.toString() !== req.uid) {
      await notify({
        recipient: originalComment.user,
        sender: req.uid,
        title: 'New reply to your comment',
        message: `${userDoc.name} replied to your comment.`,
        type: 'comment_reply',
        relatedId: campaign._id.toString(),
        link: `/campaigns/${campaign._id}#discussion`,
      });
    }

    res.status(200).json(campaign.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET COMMENTS
// ══════════════════════════════════════════════════════════════════
export const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const campaign = await Campaign.findById(id)
      .populate('comments.user', 'name avatar')
      .populate('comments.replies.user', 'name avatar')
      .select('comments');

    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const sorted = [...campaign.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = sorted.length;
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    res.status(200).json({ comments: paginated, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// UPDATE CAMPAIGN (creator → pending admin approval)
// ══════════════════════════════════════════════════════════════════
export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, goalAmount, endDate, tagline, location } = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.creator.toString() !== req.uid) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Campaigns in pending state can be updated directly
    // Active campaigns need admin approval for sensitive changes
    if (campaign.status === 'active') {
      // Store the updates as a pending update request with special flag
      campaign.pendingUpdates.push({
        title: `[EDIT REQUEST] ${title || campaign.title}`,
        content: JSON.stringify({ title, description, category, goalAmount: Number(goalAmount), endDate, tagline, location }),
        status: 'pending',
      });
      await campaign.save();
      return res.status(200).json({ success: true, message: "Edit request submitted for admin approval.", pendingApproval: true });
    }

    // Direct update for pending campaigns
    if (title) campaign.title = title;
    if (description) campaign.description = description;
    if (category && CAMPAIGN_CATEGORIES.includes(category)) campaign.category = category;
    if (goalAmount && Number(goalAmount) >= 100) campaign.goalAmount = Number(goalAmount);
    if (endDate) campaign.endDate = endDate;
    if (tagline !== undefined) campaign.tagline = tagline;
    if (location !== undefined) campaign.location = location;

    await campaign.save();
    res.status(200).json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// UPLOAD MORE DOCUMENTS (creator, always needs admin review)
// ══════════════════════════════════════════════════════════════════
export const uploadAdditionalDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { documents } = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.creator.toString() !== req.uid) return res.status(403).json({ message: "Forbidden" });

    const uploadedDocs = [];
    if (documents?.length) {
      for (const doc of documents) {
        if (doc.startsWith('data:')) {
          const r = await uploadImage(doc, `campaign_docs/${Date.now()}_${Math.random()}`);
          uploadedDocs.push(r.secure_url);
        } else {
          uploadedDocs.push(doc);
        }
      }
    }

    campaign.verificationDetails.documents.push(...uploadedDocs);
    await campaign.save();

    const admins = await User.find({ role: { $in: ['admin', 'moderator'] } }).select('_id');
    await Notification.insertMany(admins.map(a => ({
      recipient: a._id,
      title: 'New Documents Uploaded',
      message: `Creator of "${campaign.title}" uploaded additional verification documents.`,
      type: 'campaign_status',
      relatedId: campaign._id.toString(),
      link: `/admin/review`,
    })));

    res.status(200).json({ success: true, documents: campaign.verificationDetails.documents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════
// DELETE CAMPAIGN
// ══════════════════════════════════════════════════════════════════
export const deleteCampaign = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid ID" });

  try {
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const user = await User.findById(req.uid);
    const isAdminOrMod = user?.role === "admin" || user?.role === "moderator";
    if (isAdminOrMod || campaign.creator.toString() === req.uid) {
      await Campaign.findByIdAndDelete(id);
      return res.status(200).json({ message: "Campaign deleted" });
    }
    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ══════════════════════════════════════════════════════════════════
// SUSPEND CAMPAIGN (admin/mod)
// ══════════════════════════════════════════════════════════════════
export const suspendCampaign = async (req, res) => {
  const { id } = req.params;
  try {
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const user = await User.findById(req.uid);
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    campaign.status = 'suspended';
    campaign.isFeatured = false;
    await campaign.save();

    await notify({
      recipient: campaign.creator,
      title: 'Mission Suspended',
      message: `Your mission "${campaign.title}" has been suspended by an administrator.`,
      type: 'campaign_status',
      relatedId: campaign._id.toString(),
      link: `/campaigns/${campaign._id}`,
    });

    res.status(200).json({ message: 'Campaign suspended', campaign });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ══════════════════════════════════════════════════════════════════
// PLATFORM SETTINGS (public read — for donation form)
// ══════════════════════════════════════════════════════════════════
export const getPublicPlatformSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.getSingleton();
    res.json({
      donationFee: settings.donationFee,
      minimumDonation: settings.minimumDonation,
      maximumDonation: settings.maximumDonation,
      donationTutorialUrl: settings.donationTutorialUrl,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};