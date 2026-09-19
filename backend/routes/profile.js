import express from "express";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";

const router = express.Router();

const publicProfile = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    bloodType: user.bloodType,
    city: user.city,
    age: user.age,
    eligibility: user.eligibility,
    availability: user.availability,
    lastDonationDate: user.lastDonationDate,
    donationHistory: user.donationHistory || [],
});

router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ message: "Profile not found." });
        res.json(publicProfile(user));
    } catch {
        res.status(500).json({ message: "Unable to load profile." });
    }
});

router.patch("/me", requireAuth, async (req, res) => {
    try {
        const allowed = ["name", "bloodType", "city", "phone", "age", "eligibility", "availability", "lastDonationDate"];
        const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
        if (updates.age !== undefined) updates.age = Number(updates.age);
        const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true }).select("-password");
        res.json(publicProfile(user));
    } catch {
        res.status(400).json({ message: "Please provide valid profile details." });
    }
});

router.post("/me/donations", requireAuth, async (req, res) => {
    try {
        const { date, location, units = 1 } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { lastDonationDate: date, $push: { donationHistory: { date, location, units } } },
            { new: true, runValidators: true },
        ).select("-password");
        res.status(201).json(publicProfile(user));
    } catch {
        res.status(400).json({ message: "Please provide a valid donation record." });
    }
});

export default router;
