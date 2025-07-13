import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// generate jwt token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};



export const COOKIE_OPTIONS = {
  httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
  secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
  sameSite: 'Strict', // Helps prevent CSRF attacks
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
}

export default generateToken;