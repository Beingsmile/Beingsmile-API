import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
});

export const sendOTPEmail = async (email, otp) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
     console.error("❌ EMAIL_USER or EMAIL_PASS not found in .env. Skipping email sending.");
     return false;
  }
  const mailOptions = {
    from: `"Beingsmile Team" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Beingsmile Verification Code",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 10px solid #f0f0f0; border-radius: 20px;">
        <h2 style="color: #2D6A4F; text-align: center; text-transform: uppercase; font-weight: 900;">Verify Your Identity</h2>
        <p style="color: #666; text-align: center; font-size: 14px;">Welcome to the Beingsmile family. Please use the following code to complete your registration.</p>
        <div style="background: #EDFAF3; padding: 30px; border-radius: 15px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2D6A4F; font-size: 48px; letter-spacing: 12px; margin: 0;">${otp}</h1>
        </div>
        <p style="color: #999; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">This code will expire in 5 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; text-align: center; font-size: 10px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return true;
  } catch (error) {
    console.error("Error sending email: ", error);
    return false;
  }
};

export const sendDonationReceiptEmail = async (email, donation) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
     console.error("❌ EMAIL_USER or EMAIL_PASS not found. Skipping receipt email.");
     return false;
  }

  const { 
    campaignTitle, 
    amount, 
    platformFee, 
    totalAmount, 
    transactionId, 
    donatedAt, 
    donorName,
    donorPhone,
    paymentMethod 
  } = donation;

  const mailOptions = {
    from: `"BeingSmile Foundation" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Receipt: Your donation to "${campaignTitle}"`,
    html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 40px; color: #1a1a1a; background: #ffffff; border-radius: 24px; border: 1px solid #e5f0ea;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: #2D6A4F; width: 60px; height: 60px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <span style="color: white; font-size: 32px;">❤</span>
          </div>
          <h1 style="color: #2D6A4F; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -1px;">BeingSmile</h1>
          <p style="color: #6a6a6a; text-transform: uppercase; font-size: 10px; tracking: 0.2em; font-weight: 700; margin-top: 5px;">Humanitarian Foundation</p>
        </div>

        <div style="background: #f8fdfb; border-radius: 20px; padding: 30px; margin-bottom: 30px; border: 1px dashed #2D6A4F40;">
          <p style="margin: 0; font-size: 14px; font-weight: 500;">Official Donation Receipt</p>
          <p style="font-size: 16px; line-height: 1.6; margin-top: 10px;">Dear ${donorName}, thank you for your generous contribution. This receipt confirms your support for our humanitarian mission.</p>
          
          <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5f0ea;">
            <!-- Contributor Info -->
            <div style="margin-bottom: 20px;">
               <p style="color: #6a6a6a; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 5px;">Contributor Details</p>
               <p style="font-size: 13px; font-weight: 700; margin: 2px 0;">${donorName}</p>
               <p style="font-size: 12px; color: #6a6a6a; margin: 2px 0;">${email} | ${donorPhone || 'N/A'}</p>
            </div>

            <!-- Transaction Info -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #6a6a6a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Mission</span>
              <span style="font-size: 13px; font-weight: 800; text-align: right;">${campaignTitle}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #6a6a6a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Transaction ID</span>
              <span style="font-size: 13px; font-weight: 800; font-family: monospace;">${transactionId}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #6a6a6a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Method</span>
              <span style="font-size: 13px; font-weight: 800; text-transform: uppercase;">${paymentMethod}</span>
            </div>

            <!-- Financial Breakdown -->
            <div style="margin-top: 20px; background: white; padding: 15px; border-radius: 12px; border: 1px solid #e5f0ea;">
               <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                 <span style="color: #6a6a6a; font-size: 12px;">Mission Gift</span>
                 <span style="font-size: 13px; font-weight: 700;">৳${amount.toLocaleString()}</span>
               </div>
               <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                 <span style="color: #6a6a6a; font-size: 12px;">Platform Support Fee</span>
                 <span style="font-size: 13px; font-weight: 700;">৳${platformFee.toLocaleString()}</span>
               </div>
               <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #2D6A4F;">
                 <span style="color: #2D6A4F; font-size: 15px; font-weight: 900; text-transform: uppercase;">Total Paid</span>
                 <span style="color: #2D6A4F; font-size: 20px; font-weight: 900;">৳${totalAmount.toLocaleString()}</span>
               </div>
            </div>
          </div>
        </div>

        <div style="text-align: center;">
          <p style="color: #6a6a6a; font-size: 11px; line-height: 1.6;">BeingSmile is a registered non-profit. All contributions directly support field operations. You can download a tax-ready PDF from your dashboard.</p>
          <a href="${process.env.FRONTEND_URL}/dashboard/donations" style="display: inline-block; background: #2D6A4F; color: white; padding: 15px 35px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 12px; text-transform: uppercase; margin-top: 20px; box-shadow: 0 10px 20px rgba(45,106,79,0.2);">Dashboard Access</a>
        </div>

        <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f0f0f0; padding-top: 30px;">
          <p style="color: #a0a0a0; font-size: 10px; text-transform: uppercase; font-weight: 800;">Receipt issued on ${new Date(donatedAt).toLocaleDateString()}</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("❌ Receipt Email Error:", error);
    return false;
  }
};
