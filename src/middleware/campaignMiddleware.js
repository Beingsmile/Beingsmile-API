import { verifyToken } from '../utils/jwt.js';

export const authenticate = (req, res, next) => {
  const token = req.cookies.jwttoken;

  if (!token) {
    return res.status(401).json({ message: 'No token found in cookies' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  req.uid = decoded.id;
  next();
};
