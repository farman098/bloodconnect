import cron from "node-cron";
import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { notifyUser } from "../utils/notifications.js";

function tomorrowWindow() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}

export async function sendTomorrowReminders() {
    const { start, end } = tomorrowWindow();
    const requests = await BloodRequest.find({ status: "Matched", confirmedDate: { $gte: start, $lt: end } }).populate("matchedDonorId", "name email").lean();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const request of requests) {
        if (!request.matchedDonorId) continue;
        const existing = await Notification.findOne({ recipientId: request.matchedDonorId._id, requestId: request._id, type: "reminder", createdAt: { $gte: today } });
        if (existing) continue;
        const time = new Date(request.confirmedDate).toLocaleString();
        await notifyUser({
            recipientId: request.matchedDonorId._id,
            recipient: request.matchedDonorId,
            requestId: request._id,
            type: "reminder",
            message: `Reminder: Your blood donation is scheduled for tomorrow at ${request.hospital} (${time}).`,
            subject: "BloodConnect donation reminder",
        });
    }
}

export function startReminderJob() {
    const expression = process.env.REMINDER_CRON || "0 9 * * *";
    return cron.schedule(expression, () => sendTomorrowReminders().catch((error) => console.error("Reminder job error:", error.message)), {
        timezone: process.env.REMINDER_TIMEZONE || "UTC",
    });
}
