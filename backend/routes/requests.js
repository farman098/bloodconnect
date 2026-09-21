import express from "express";
import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
import Response from "../models/Response.js";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import { formatUrgency, getDonationEligibility, urgencyLevelWeight, urgencyWeight } from "../utils/eligibility.js";
import { acceptRequest, cancelAcceptance, completeRequest, getMatchedContact, sendThankYou } from "../controllers/requestActions.js";

const router = express.Router();
const bloodTypes = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
const requestFields = ["patientName", "bloodType", "units", "hospital", "city", "urgencyLevel", "urgency"];

const cleanText = (value, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : value;

function serializeFeedRequest(request, donor, response) {
    return {
        id: request._id,
        patientName: request.patientName,
        bloodType: request.bloodType,
        hospital: request.hospital,
        city: request.city,
        urgencyLevel: request.urgencyLevel || (urgencyLevelWeight(request.urgency) ? "Emergency" : "Normal"),
        urgency: request.urgency,
        urgencyLabel: formatUrgency(request.urgency),
        units: request.units,
        status: request.status,
        createdAt: request.createdAt,
        responseStatus: response?.status || null,
        eligibility: getDonationEligibility(donor.lastDonationDate),
    };
}

const requestContact = (user) => ({ name: user.name, email: user.email, city: user.city || null });

router.get("/", requireAuth, async (req, res) => {
    try {
        if (req.user.role !== "donor") return res.status(403).json({ message: "Only donors can view the donor request feed." });
        const donor = await User.findById(req.user.id).select("bloodType city lastDonationDate").lean();
        if (!donor) return res.status(404).json({ message: "Donor profile not found." });
        const { bloodType = "mine", sort = "newest" } = req.query;
        const filter = { status: { $in: ["Open", "Pending"] } };
        if (bloodType === "mine") filter.bloodType = donor.bloodType;
        else if (bloodType !== "all") {
            if (!bloodTypes.has(bloodType)) return res.status(400).json({ message: "Invalid blood group filter." });
            filter.bloodType = bloodType;
        }
        const requests = await BloodRequest.aggregate([
            { $match: filter },
            { $addFields: { urgencyPriority: { $cond: [{ $or: [{ $eq: ["$urgencyLevel", "Emergency"] }, { $in: ["$urgency", ["Urgent", "Critical"]] }] }, 1, 0] } } },
            { $sort: { urgencyPriority: -1, createdAt: -1 } },
            { $limit: 100 },
        ]);
        const responses = await Response.find({ donorId: donor._id, requestId: { $in: requests.map((item) => item._id) } }).lean();
        const responseByRequest = new Map(responses.map((item) => [String(item.requestId), item]));
        const feed = requests.map((request) => serializeFeedRequest(request, donor, responseByRequest.get(String(request._id))));
        feed.sort((left, right) => {
            if (sort === "urgent") return urgencyLevelWeight(right.urgencyLevel, right.urgency) - urgencyLevelWeight(left.urgencyLevel, left.urgency) || urgencyWeight(right.urgency) - urgencyWeight(left.urgency) || new Date(right.createdAt) - new Date(left.createdAt);
            if (sort === "nearest") return urgencyLevelWeight(right.urgencyLevel, right.urgency) - urgencyLevelWeight(left.urgencyLevel, left.urgency) || (left.city === donor.city ? -1 : 1) - (right.city === donor.city ? -1 : 1) || new Date(right.createdAt) - new Date(left.createdAt);
            return urgencyLevelWeight(right.urgencyLevel, right.urgency) - urgencyLevelWeight(left.urgencyLevel, left.urgency) || new Date(right.createdAt) - new Date(left.createdAt);
        });
        res.json(feed);
    } catch (error) {
        console.error("Request feed error:", error.message);
        res.status(500).json({ message: "Unable to load blood requests." });
    }
});

router.get("/mine", requireAuth, async (req, res) => {
    try {
        if (req.user.role !== "requester") return res.status(403).json({ message: "Only requesters can view their blood requests." });
        const requests = await BloodRequest.find({ createdBy: req.user.id }).populate("matchedDonorId", "name email phone city").sort({ createdAt: -1 }).limit(100).lean();
        res.json(requests);
    } catch (error) {
        console.error("Requester requests error:", error.message);
        res.status(500).json({ message: "Unable to load your blood requests." });
    }
});

router.get("/activity", requireAuth, async (req, res) => {
    try {
        if (req.user.role !== "donor") return res.status(403).json({ message: "Only donors can view donor activity." });
        const [donor, responses] = await Promise.all([
            User.findById(req.user.id).select("lastDonationDate donationHistory").lean(),
            Response.find({ donorId: req.user.id }).populate({ path: "requestId", select: "patientName bloodType units unitsStillNeeded hospital city urgency urgencyLevel status matchedDonorId confirmedDate completedDate createdBy", populate: { path: "createdBy", select: "name email phone city" } }).sort({ updatedAt: -1 }).lean(),
        ]);
        res.json({ totalDonations: donor?.donationHistory?.length || 0, lastDonationDate: donor?.lastDonationDate || null, acceptedRequests: responses });
    } catch (error) {
        console.error("Donor activity error:", error.message);
        res.status(500).json({ message: "Unable to load donor activity." });
    }
});

router.get("/notifications", requireAuth, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user.id }).sort({ createdAt: -1 }).limit(30).lean();
        res.json(notifications);
    } catch {
        res.status(500).json({ message: "Unable to load notifications." });
    }
});

router.get("/my-responses", requireAuth, async (req, res) => {
    try {
        const responses = await Response.find({ donorId: req.user.id }).populate({ path: "requestId", select: "patientName bloodType units hospital city urgency urgencyLevel status matchedDonorId confirmedDate completedDate createdBy", populate: { path: "createdBy", select: "name email phone city" } }).sort({ respondedAt: -1 });
        res.json(responses);
    } catch {
        res.status(500).json({ message: "Unable to load your responses." });
    }
});

router.post("/:id/accept", requireAuth, acceptRequest);
router.post("/:id/cancel", requireAuth, cancelAcceptance);
router.get("/:id/contact", requireAuth, getMatchedContact);
router.post("/:id/complete", requireAuth, completeRequest);
router.post("/:id/thank-you", requireAuth, sendThankYou);

router.patch("/:id/respond", requireAuth, async (req, res) => {
    if (req.body.response === "Accepted") return res.status(410).json({ message: "Use the acceptance confirmation flow." });
    try {
        await Response.findOneAndUpdate({ requestId: req.params.id, donorId: req.user.id }, { status: "declined", respondedAt: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
        res.json({ message: "Request declined." });
    } catch {
        res.status(500).json({ message: "Unable to save your response." });
    }
});

router.post("/", requireAuth, async (req, res) => {
    try {
        if (req.user.role !== "requester") return res.status(403).json({ message: "Only requesters can create blood requests." });
        const values = Object.fromEntries(requestFields.map((field) => [field, req.body[field]]));
        values.patientName = cleanText(values.patientName, 100);
        values.hospital = cleanText(values.hospital, 150);
        values.city = cleanText(values.city, 100);
        values.bloodType = cleanText(values.bloodType, 3);
        values.units = Number(values.units);
        values.urgencyLevel = values.urgencyLevel || (values.urgency === "Urgent" || values.urgency === "Critical" ? "Emergency" : "Normal");
        if (!["Normal", "Emergency"].includes(values.urgencyLevel)) return res.status(400).json({ message: "Please provide a valid urgency level." });
        if (!values.patientName || !values.hospital || !values.city || !bloodTypes.has(values.bloodType) || !Number.isInteger(values.units) || values.units < 1 || values.units > 20) return res.status(400).json({ message: "Please provide valid blood request details." });
        const request = await BloodRequest.create({ ...values, createdBy: req.user.id });
        const donorFilter = { role: "donor", bloodType: request.bloodType, availability: "Available" };
        if (request.urgencyLevel !== "Emergency") donorFilter.$or = [{ city: request.city }, { city: { $exists: false } }];
        const donors = await User.find(donorFilter).select("_id lastDonationDate").lean();
        const eligibleDonors = donors.filter((donor) => getDonationEligibility(donor.lastDonationDate).eligible);
        if (eligibleDonors.length) await Notification.insertMany(eligibleDonors.map((donor) => ({ recipientId: donor._id, requestId: request._id, type: "new-request", message: request.urgencyLevel === "Emergency" ? `Emergency: a ${request.bloodType} blood request needs help in ${request.city}.` : `A new ${request.bloodType} blood request is available in ${request.city}.` })));
        res.status(201).json(request);
    } catch (error) {
        console.error("Create request error:", error.message);
        res.status(400).json({ message: "Please provide valid request details." });
    }
});

export default router;
