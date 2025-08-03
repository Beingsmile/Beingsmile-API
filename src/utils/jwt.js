import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// generate jwt token
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' }); // jwt expires in 7 days
};

// generate uid from jwt token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

export const COOKIE_OPTIONS = {
  httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
  secure: true, // Use secure cookies in production
  sameSite: 'None', 
  maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
  path: '/',
}

export default generateToken;