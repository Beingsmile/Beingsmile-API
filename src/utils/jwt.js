import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

export const COOKIE_OPTIONS = {
  httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
  secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
  sameSite: 'Strict', // Helps prevent CSRF attacks
  maxAge: 1 * 60 * 1000, // 15 minutes
  path: '/',
}

export default generateToken;