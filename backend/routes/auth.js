import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

const createToken = (user) =>
    jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || "development-secret",
        { expiresIn: "7d" },
    );

router.post("/register", async (req, res) => {
    try {
        const { name, email, password, bloodType, age, city, phone, eligibility, role = "donor" } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();

        if (!name || !normalizedEmail || !password || !bloodType) {
            return res.status(400).json({ message: "Please fill all required fields." });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ message: "An account with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            bloodType,
            city: city?.trim(),
            phone: phone?.trim(),
            age: age ? Number(age) : undefined,
            eligibility: eligibility || "Needs review",
            role: role === "requester" ? "requester" : "donor",
        });

        return res.status(201).json({
            message: "Account created successfully.",
            token: createToken(user),
            user: { id: user._id, name: user.name, email: user.email, phone: user.phone, bloodType: user.bloodType, city: user.city, age: user.age, eligibility: user.eligibility, availability: user.availability, role: user.role },
        });
    } catch (error) {
        console.error("Register error:", error.message);
        return res.status(503).json({ message: "Database unavailable. Add your IP in MongoDB Atlas Network Access." });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user || !(await bcrypt.compare(password || "", user.password))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        return res.json({
            message: "Login successful.",
            token: createToken(user),
            user: { id: user._id, name: user.name, email: user.email, phone: user.phone, bloodType: user.bloodType, city: user.city, age: user.age, eligibility: user.eligibility, availability: user.availability, role: user.role },
        });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(503).json({ message: "Database unavailable. Add your IP in MongoDB Atlas Network Access." });
    }
});

export default router;
