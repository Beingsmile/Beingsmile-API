import User from "../models/User.js";

// Update user profile info
export const updateUserProfile = async (req, res) => {
    try {
        const { name, bio, phoneNumber } = req.body;

        // The userId should be attached to req by the auth middleware
        if (!req.uid) {
            return res.status(401).json({ error: "Unauthorized: No user ID found" });
        }

        const user = await User.findByIdAndUpdate(
            req.uid,
            {
                $set: {
                    name,
                    bio,
                    phoneNumber
                }
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                bio: user.bio,
                phoneNumber: user.phoneNumber,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ error: error.message || "Failed to update profile" });
    }
};

// Update user avatar
export const updateUserAvatar = async (req, res) => {
    try {
        const { avatarUrl } = req.body;

        if (!req.uid) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!avatarUrl) {
            return res.status(400).json({ error: "Avatar URL is required" });
        }

        const user = await User.findByIdAndUpdate(
            req.uid,
            { $set: { avatar: avatarUrl } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            success: true,
            message: "Avatar updated successfully",
            avatar: user.avatar
        });
    } catch (error) {
        console.error("Update avatar error:", error);
        res.status(500).json({ error: error.message || "Failed to update avatar" });
    }
};

// Get current user profile (alternative to /api/auth/me)
export const getMyProfile = async (req, res) => {
    try {
        if (!req.uid) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = await User.findById(req.uid);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
