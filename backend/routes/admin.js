import express from "express";
import requireAuth from "../middleware/auth.js";
import User from "../models/User.js";
import BloodRequest from "../models/BloodRequest.js";
import ContactMessage from "../models/ContactMessage.js";
import { completeRequest } from "../controllers/requestActions.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required." });
    next();
};

router.use(requireAuth, requireAdmin);

router.get("/overview", async (req, res) => {
    try {
        const [users, requests, messages] = await Promise.all([
            User.find().select("name email bloodType role availability createdAt").sort({ createdAt: -1 }).limit(100).lean(),
            BloodRequest.find().sort({ createdAt: -1 }).limit(100).lean(),
            ContactMessage.find().sort({ createdAt: -1 }).limit(100).lean(),
        ]);

        res.json({
            stats: {
                users: await User.countDocuments(),
                requests: await BloodRequest.countDocuments(),
                openRequests: await BloodRequest.countDocuments({ status: "Open" }),
                messages: await ContactMessage.countDocuments(),
                newMessages: await ContactMessage.countDocuments({ status: "New" }),
            },
            users,
            requests,
            messages,
        });
    } catch {
        res.status(500).json({ message: "Unable to load admin data." });
    }
});

router.patch("/messages/:id", async (req, res) => {
    try {
        const { status } = req.body;
        if (!["New", "Read", "Resolved"].includes(status)) {
            return res.status(400).json({ message: "Invalid message status." });
        }

        const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!message) return res.status(404).json({ message: "Message not found." });
        res.json(message);
    } catch {
        res.status(400).json({ message: "Unable to update message." });
    }
});

router.patch("/requests/:id", async (req, res) => {
    try {
        const { status } = req.body;
        if (!["Open", "Matched", "Completed"].includes(status)) {
            return res.status(400).json({ message: "Invalid request status." });
        }

        if (status === "Completed") return completeRequest(req, res);
        const request = await BloodRequest.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!request) return res.status(404).json({ message: "Blood request not found." });
        res.json(request);
    } catch {
        res.status(400).json({ message: "Unable to update blood request." });
    }
});

export default router;
