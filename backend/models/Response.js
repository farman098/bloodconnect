import mongoose from "mongoose";

const responseSchema = new mongoose.Schema(
    {
        requestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BloodRequest",
            required: [true, "requestId is required"],
        },
        donorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "donorId is required"],
        },
        status: {
            type: String,
            enum: {
                values: ["pending", "accepted", "declined", "cancelled", "completed"],
                message: "{VALUE} is not a valid response status",
            },
            default: "pending",
        },
        message: {
            type: String,
            trim: true,
            maxlength: [300, "Message cannot exceed 300 characters"],
        },
        respondedAt: {
            type: Date,
            default: Date.now,
        },
        confirmedDate: { type: Date, default: null },
    },
    { timestamps: true },
);

export default mongoose.model("Response", responseSchema);
