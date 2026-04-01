import express from "express";
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead 
} from "../controllers/notificationController.js";
import { verifyJwtOrLogout } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyJwtOrLogout, getNotifications);
router.get("/unread-count", verifyJwtOrLogout, getUnreadCount);
router.patch("/:id/read", verifyJwtOrLogout, markAsRead);
router.patch("/read-all", verifyJwtOrLogout, markAllAsRead);

export default router;
