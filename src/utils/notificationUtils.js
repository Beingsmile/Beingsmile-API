import Notification from "../models/Notification.js";

/**
 * Service to handle creation of notifications
 */
export const createNotification = async ({ recipient, sender, title, message, type, relatedId }) => {
  try {
    const notification = await Notification.create({
      recipient,
      sender,
      title,
      message,
      type,
      relatedId,
    });
    
    // In a real app, you might also trigger a Socket.io event here
    // or send an email through a service like SendGrid.
    console.log(`[NOTIFICATION_CREATED] To: ${recipient}, Title: ${title}`);
    
    return notification;
  } catch (error) {
    console.error("[NOTIFICATION_ERROR] Failed to create notification:", error);
  }
};

/**
 * Specifically for donation alerts
 */
export const notifyDonation = async (campaign, donation) => {
  const fundraiserId = campaign.creator;
  const donorName = donation.isAnonymous ? "Someone" : "A generous donor";
  
  await createNotification({
    recipient: fundraiserId,
    sender: donation.donor,
    title: "New Donation Received",
    message: `${donorName} just donated ৳${donation.amount} to your campaign "${campaign.title}".`,
    type: "donation",
    relatedId: campaign._id,
  });
};

/**
 * Specifically for campaign status updates
 */
export const notifyCampaignStatus = async (campaign, status) => {
  let title = "Campaign Update";
  let message = `Your campaign "${campaign.title}" status has changed to ${status}.`;

  if (status === 'active') {
    title = "Campaign Approved";
    message = `Congratulations! Your campaign "${campaign.title}" has been approved and is now live.`;
  } else if (status === 'needs_info') {
    title = "Information Required";
    message = `The admin has requested more information for your campaign "${campaign.title}". Please check admin notes.`;
  }

  await createNotification({
    recipient: campaign.creator,
    title,
    message,
    type: "campaign_status",
    relatedId: campaign._id,
  });
};
