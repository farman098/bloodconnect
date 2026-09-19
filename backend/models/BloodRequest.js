import mongoose from "mongoose";

const bloodRequestSchema = new mongoose.Schema(
    {
        patientName: { type: String, required: true, trim: true },
        bloodType: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], required: true },
        units: { type: Number, required: true, min: 1, max: 20 },
        unitsStillNeeded: { type: Number, min: 0, default: function () { return this.units; } },
        hospital: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        urgencyLevel: { type: String, enum: ["Normal", "Emergency"], default: "Normal", required: true },
        urgency: { type: String, enum: ["Normal", "Urgent", "Critical", "Scheduled"], default: "Urgent" },
        status: { type: String, enum: ["Open", "Pending", "Matched", "Completed"], default: "Open" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        matchedDonorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        confirmedDate: { type: Date, default: null },
        completedDate: { type: Date, default: null },
        thankYouMessage: { type: String, trim: true, maxlength: 500, default: null },
        donorResponses: [{
            donor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            response: { type: String, enum: ["Accepted", "Declined"] },
            respondedAt: { type: Date, default: Date.now },
        }],
    },
    { timestamps: true },
);

bloodRequestSchema.index({ urgencyLevel: -1, createdAt: -1 });

export default mongoose.model("BloodRequest", bloodRequestSchema);
