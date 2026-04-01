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
        <h2 style="color: #ff3366; text-align: center; text-transform: uppercase; font-weight: 900;">Verify Your Identity</h2>
        <p style="color: #666; text-align: center; font-size: 14px;">Welcome to the Beingsmile family. Please use the following code to complete your registration.</p>
        <div style="background: #fdf2f8; padding: 30px; border-radius: 15px; text-align: center; margin: 20px 0;">
          <h1 style="color: #ff3366; font-size: 48px; letter-spacing: 12px; margin: 0;">${otp}</h1>
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
