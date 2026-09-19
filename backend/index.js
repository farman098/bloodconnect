import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./connection.js";
import authRoutes from "./routes/auth.js";
import requestRoutes from "./routes/requests.js";
import profileRoutes from "./routes/profile.js";
import contactRoutes from "./routes/contact.js";
import adminRoutes from "./routes/admin.js";
import homeRoutes from "./routes/home.js";
import ratingRoutes from "./routes/ratings.js";
import { startReminderJob } from "./jobs/reminders.js";

dotenv.config();
dotenv.config({ path: "./atlas-credentials.env" });

const app = express();

const databaseConnected = await connectDB();
if (!databaseConnected) process.exit(1);
app.use(cors({
    origin: (origin, callback) => {
        const isLocalOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        callback(isLocalOrigin ? null : new Error("Origin is not allowed."), isLocalOrigin);
    },
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/ratings", ratingRoutes);

app.get("/", (req, res) => {
    res.send("welcome to blood connecty");
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
    startReminderJob();
});