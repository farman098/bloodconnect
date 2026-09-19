import express from "express";
import BloodRequest from "../models/BloodRequest.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const [donorCount, totalRequests, openRequests, recentRequests] = await Promise.all([
            User.countDocuments({ role: "donor" }),
            BloodRequest.countDocuments(),
            BloodRequest.countDocuments({ status: "Open" }),
            BloodRequest.find({ status: { $in: ["Open", "Matched"] } })
                .sort({ urgencyLevel: -1, createdAt: -1 })
                .limit(6)
                .select("patientName bloodType hospital city urgencyLevel urgency status createdAt")
                .lean(),
        ]);

        res.json({
            stats: [
                { value: `${donorCount}+`, label: "Verified donors" },
                { value: `${totalRequests}`, label: "Total requests" },
                { value: `${openRequests}`, label: "Open requests" },
                { value: "24/7", label: "Response window" },
            ],
            recentRequests: recentRequests.map((request) => ({
                id: request._id,
                patientName: request.patientName,
                bloodType: request.bloodType,
                hospital: request.hospital,
                city: request.city,
                urgencyLevel: request.urgencyLevel || (request.urgency === "Urgent" || request.urgency === "Critical" ? "Emergency" : "Normal"),
                urgency: request.urgency,
                status: request.status,
            })),
        });
    } catch {
        res.status(500).json({ message: "Unable to load home data." });
    }
});

export default router;
