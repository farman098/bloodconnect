import BloodRequest from "../models/BloodRequest.js";
import Response from "../models/Response.js";
import User from "../models/User.js";
import { getDonationEligibility } from "../utils/eligibility.js";
import { notifyUser } from "../utils/notifications.js";

const contactDetails = (user) => ({
    name: user.name,
    firstName: user.name?.split(/\s+/)[0] || user.name,
    email: user.email,
    phone: user.phone || null,
    city: user.city || null,
});

const parseConfirmedDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const remainingUnits = (request) => request.unitsStillNeeded ?? request.units;

const requestSummary = (request) => ({
    id: request._id,
    patientName: request.patientName,
    bloodType: request.bloodType,
    hospital: request.hospital,
    city: request.city,
    units: request.units,
    unitsStillNeeded: remainingUnits(request),
    urgencyLevel: request.urgencyLevel,
    status: request.status,
    matchedDonorId: request.matchedDonorId,
    confirmedDate: request.confirmedDate,
});

export async function acceptRequest(req, res) {
    try {
        if (req.user.role !== "donor") return res.status(403).json({ message: "Only donors can accept blood requests." });
        const confirmedDate = parseConfirmedDate(req.body.confirmedDate);
        if (!confirmedDate || confirmedDate < new Date()) return res.status(400).json({ message: "Choose a valid future donation date and time." });

        const [donor, request] = await Promise.all([
            User.findById(req.user.id).select("name email phone bloodType city lastDonationDate").lean(),
            BloodRequest.findById(req.params.id),
        ]);
        if (!donor || !request) return res.status(404).json({ message: "Blood request not found." });
        if (request.bloodType !== donor.bloodType) return res.status(403).json({ message: "Your blood group does not match this request." });
        if (!['Open', 'Pending'].includes(request.status) || request.matchedDonorId) return res.status(409).json({ message: "This request is no longer available." });
        if (remainingUnits(request) < 1) return res.status(409).json({ message: "This request has already received enough donors." });

        const eligibility = getDonationEligibility(donor.lastDonationDate);
        if (!eligibility.eligible) return res.status(403).json({ message: `You are not eligible to donate yet. Eligible on ${eligibility.eligibleOn.toISOString().slice(0, 10)}.` });

        const requester = await User.findById(request.createdBy).select("name email phone city").lean();
        const nextUnits = remainingUnits(request) - 1;
        request.unitsStillNeeded = nextUnits;
        request.matchedDonorId = donor._id;
        request.confirmedDate = confirmedDate;
        request.status = "Matched";
        await request.save();

        const response = await Response.findOneAndUpdate(
            { requestId: request._id, donorId: donor._id },
            { status: "accepted", respondedAt: new Date(), confirmedDate },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        await notifyUser({
            recipientId: request.createdBy,
            recipient: requester,
            requestId: request._id,
            type: "accepted",
            message: `${donor.name?.split(/\s+/)[0] || donor.name} has accepted your blood request!`,
            subject: "A donor accepted your BloodConnect request",
        });

        res.json({
            response,
            request: requestSummary(request),
            requester: requester ? contactDetails(requester) : null,
            donor: contactDetails(donor),
        });
    } catch (error) {
        console.error("Accept request error:", error.message);
        res.status(500).json({ message: "Failed to confirm acceptance. Please try again." });
    }
}

export async function cancelAcceptance(req, res) {
    try {
        if (req.user.role !== "donor") return res.status(403).json({ message: "Only donors can cancel an acceptance." });
        const request = await BloodRequest.findOne({ _id: req.params.id, matchedDonorId: req.user.id, status: "Matched" });
        if (!request) return res.status(404).json({ message: "No active acceptance found for this request." });

        const response = await Response.findOneAndUpdate(
            { requestId: request._id, donorId: req.user.id, status: "accepted" },
            { status: "cancelled", respondedAt: new Date(), confirmedDate: null },
            { new: true },
        );
        if (!response) return res.status(404).json({ message: "No active acceptance found for this request." });

        request.status = "Pending";
        request.matchedDonorId = null;
        request.confirmedDate = null;
        request.unitsStillNeeded = Math.min(request.units, remainingUnits(request) + 1);
        await request.save();

        const requester = await User.findById(request.createdBy).select("name email phone city").lean();
        if (requester) await notifyUser({
            recipientId: requester._id,
            recipient: requester,
            requestId: request._id,
            type: "cancelled",
            message: "Your matched donor is no longer available. We're finding you another donor.",
            subject: "Your BloodConnect donor is no longer available",
        });
        res.json({ response, request: requestSummary(request) });
    } catch (error) {
        console.error("Cancel request error:", error.message);
        res.status(500).json({ message: "Failed to cancel acceptance. Please try again." });
    }
}

export async function completeRequest(req, res) {
    try {
        if (!['requester', 'admin'].includes(req.user.role)) return res.status(403).json({ message: "Only the requester or an admin can complete this request." });
        const request = await BloodRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: "Blood request not found." });
        if (req.user.role === "requester" && String(request.createdBy) !== String(req.user.id)) return res.status(403).json({ message: "You can only complete your own requests." });
        if (request.status !== "Matched" || !request.matchedDonorId || !request.confirmedDate) return res.status(409).json({ message: "This request is not ready to be completed." });
        if (new Date(request.confirmedDate) > new Date()) return res.status(400).json({ message: "This request can be completed after the donation date." });

        const donor = await User.findById(request.matchedDonorId).select("name email phone city totalDonations badgeLevel lastDonationDate");
        if (!donor) return res.status(404).json({ message: "Matched donor not found." });
        const nextTotal = (donor.totalDonations || 0) + 1;
        donor.totalDonations = nextTotal;
        donor.lastDonationDate = new Date();
        donor.badgeLevel = nextTotal >= 25 ? "Gold" : nextTotal >= 10 ? "Silver" : "Bronze";
        donor.donationHistory.push({ date: new Date(), location: request.hospital, units: 1 });
        await donor.save();

        request.status = "Completed";
        request.completedDate = new Date();
        await request.save();
        await Response.findOneAndUpdate({ requestId: request._id, donorId: donor._id }, { status: "completed" }, { new: true });
        await notifyUser({ recipientId: donor._id, recipient: donor, requestId: request._id, type: "completed", message: `Your donation at ${request.hospital} has been marked completed. Thank you!`, subject: "BloodConnect donation completed" });
        res.json({ request: requestSummary(request), donor: { totalDonations: donor.totalDonations, badgeLevel: donor.badgeLevel } });
    } catch (error) {
        console.error("Complete request error:", error.message);
        res.status(500).json({ message: "Failed to mark this request completed." });
    }
}

export async function sendThankYou(req, res) {
    try {
        if (req.user.role !== "requester") return res.status(403).json({ message: "Only requesters can send thank-you messages." });
        const message = typeof req.body.message === "string" ? req.body.message.trim().slice(0, 500) : "";
        if (!message) return res.status(400).json({ message: "Please enter a thank-you message." });
        const request = await BloodRequest.findOne({ _id: req.params.id, createdBy: req.user.id, status: "Completed" });
        if (!request || !request.matchedDonorId) return res.status(404).json({ message: "Completed matched request not found." });
        const donor = await User.findById(request.matchedDonorId).select("name email").lean();
        request.thankYouMessage = message;
        await request.save();
        await notifyUser({ recipientId: donor._id, recipient: donor, requestId: request._id, type: "thank-you", message: `The requester sent you a thank-you message: ${message}`, subject: "A requester thanked you" });
        res.json({ message: "Thank-you message sent." });
    } catch (error) {
        console.error("Thank-you error:", error.message);
        res.status(500).json({ message: "Unable to send the thank-you message." });
    }
}
