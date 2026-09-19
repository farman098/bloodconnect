import nodemailer from "nodemailer";
import Notification from "../models/Notification.js";

let transporter;

function getTransporter() {
    if (transporter !== undefined) return transporter;
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        transporter = null;
        return transporter;
    }
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
    return transporter;
}

export async function notifyUser({ recipientId, recipient, requestId, type, message, subject = "BloodConnect update" }) {
    const notification = await Notification.create({ recipientId, requestId, type, message });
    const mailer = getTransporter();
    if (mailer && recipient?.email) {
        try {
            await mailer.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: recipient.email,
                subject,
                text: message,
            });
        } catch (error) {
            console.error("Optional email notification failed:", error.message);
        }
    }
    return notification;
}
