import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        requestId: { type: mongoose.Schema.Types.ObjectId, ref: "BloodRequest" },
        type: { type: String, enum: ["new-request", "accepted", "cancelled", "completed", "reminder", "thank-you"], required: true },
        message: { type: String, required: true, trim: true, maxlength: 300 },
        readAt: { type: Date, default: null },
    },
    { timestamps: true },
);

export default mongoose.model("Notification", notificationSchema);