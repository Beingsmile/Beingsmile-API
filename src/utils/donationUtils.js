import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import Campaign from "../models/Campaign.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { notifyDonation } from "./notificationUtils.js";

/**
 * Atomically processes a successful donation sequence.
 * 
 * @param {string} transactionId - gateway transaction ID (mer_txnid or stripe intent)
 * @param {Object} gatewayData - full response from gateway
 * @param {string} method - 'aamarpay' | 'stripe'
 */
export const processDonationSequence = async (transactionId, gatewayData, method = "aamarpay") => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch the initiated local transaction
    const localTrx = await Transaction.findOne({ transactionId }).session(session);
    if (!localTrx) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    // Idempotency: skip if already success
    if (localTrx.status === "success") {
      console.warn(`[DONATION] Transaction ${transactionId} already processed.`);
      await session.commitTransaction();
      return { success: true, alreadyProcessed: true };
    }

    const { campaign: campaignId, user: donorId, amount: totalAmount, platformFee: feeRaw, isAnonymous, isAnonymousFromAll, donorMessage } = localTrx;
    const fee = feeRaw || 0;
    const netDonation = totalAmount - fee;

    // 2. Update Campaign
    const donationEntry = {
      donor: donorId,
      donorName: localTrx.customerDetails?.name || (isAnonymous ? "Anonymous" : "Kind Soul"),
      donorEmail: localTrx.customerDetails?.email,
      donorPhone: localTrx.customerDetails?.phone,
      amount: netDonation, // Actual donation to the mission
      platformFee: fee, // Recorded separately
      isAnonymous: isAnonymous || false,
      isAnonymousFromAll: isAnonymousFromAll || false,
      donorMessage: donorMessage || "",
      donatedAt: new Date(),
      transactionId: transactionId,
      paymentMethod: method,
    };

    const campaign = await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $push: { donations: donationEntry },
        $inc: { currentAmount: netDonation },
      },
      { session, new: true }
    ).populate("creator");

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // 3. Update Fundraiser Wallet
    const fundraiserId = campaign.creator._id;
    let wallet = await Wallet.findOne({ user: fundraiserId }).session(session);
    
    // Create wallet if it doesn't exist (safety for legacy users)
    if (!wallet) {
      wallet = new Wallet({ user: fundraiserId });
    }

    const walletEntry = {
      type: "credit",
      amount: netDonation,
      category: "donation",
      description: `Donation received for "${campaign.title}"`,
      relatedId: transactionId,
      campaignId: campaignId,
      timestamp: new Date(),
    };

    wallet.balance += netDonation;
    wallet.totalEarnings += netDonation;
    wallet.transactions.push(walletEntry);
    await wallet.save({ session });

    // 4. Update Fundraiser Metrics in User Model
    await User.findByIdAndUpdate(
      fundraiserId,
      { $inc: { "metrics.totalRaised": netDonation } },
      { session }
    );

    // 5. Update Donor Metrics (if logged in)
    if (donorId) {
      await User.findByIdAndUpdate(
        donorId,
        { $inc: { "metrics.totalDonated": netDonation } },
        { session }
      );
    }

    // 6. Update Local Transaction Record
    localTrx.status = "success";
    localTrx.gatewayResponse = gatewayData;
    localTrx.netAmount = netDonation;
    localTrx.verificationLevel = "server_confirmed";
    
    // Store secondary gateway ID if available (pg_txnid for aamarpay)
    if (method === 'aamarpay' && gatewayData.pg_txnid) {
      localTrx.gatewayTransactionId = gatewayData.pg_txnid;
    } else if (method === 'stripe' && gatewayData.id) {
       localTrx.gatewayTransactionId = gatewayData.id;
    }
    
    await localTrx.save({ session });

    // 7. Commit everything
    await session.commitTransaction();
    console.log(`[DONATION_ATOMIC] Success! TXN: ${transactionId}, Campaign: ${campaignId}, Net: ${netDonation}`);

    // 8. Notifications & Receipts (Out-of-band/Async)
    const { sendDonationReceiptEmail } = await import("./emailUtils.js");
    
    // Notify users
    notifyDonation(campaign, donationEntry).catch(e => console.error("Notification error:", e));

    // Send Email Receipt to donor
    if (donationEntry.donorEmail) {
      sendDonationReceiptEmail(donationEntry.donorEmail, {
        campaignTitle: campaign.title,
        amount: netDonation, // Subtotal
        platformFee: fee,    // Fee
        totalAmount: totalAmount, // Total
        transactionId: transactionId,
        donatedAt: donationEntry.donatedAt,
        donorName: donationEntry.donorName,
        donorPhone: donationEntry.donorPhone,
        paymentMethod: method === 'aamarpay' ? (gatewayData.card_type || 'aamarpay') : method
      }).catch(e => console.error("Email receipt error:", e));
    }

    return { success: true, campaign, donation: donationEntry };
  } catch (error) {
    await session.abortTransaction();
    console.error(`[DONATION_ATOMIC] FAILED for TXN: ${transactionId}`, error);
    throw error;
  } finally {
    session.endSession();
  }
};
