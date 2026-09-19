import { useEffect, useState } from "react";
import "./app.css";
import { apiRequest, clearSession, getSession, goTo } from "./api.js";
import {
    AuthPage,
    DashboardPage,
    ProfilePage,
    RequestPage,
    RequesterDashboard,
} from "./pages.jsx";
import AdminPage from "./AdminPage.jsx";
import AnimatedBackground from "./AnimatedBackground.jsx";

const navLinks = [
    ["Why BloodConnect", "why-bloodconnect"],
    ["Impact", "impact"],
    ["Donors", "donors"],
    ["Resources", "resources"],
    ["Contact", "contact"],
];

const steps = [
    "Create a request with blood type and urgency details.",
    "Match with verified donors and local responders.",
    "Coordinate safely and receive support without delay.",
];

function HomePage() {
    const [stats, setStats] = useState([]);
    const [recentRequests, setRecentRequests] = useState([]);
    const [ratings, setRatings] = useState({ ratings: [], average: 0, count: 0 });
    const [loading, setLoading] = useState(true);
    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [requestForm, setRequestForm] = useState({
        patientName: "",
        bloodType: "O+",
        units: 1,
        hospital: "",
        city: "Lahore",
        urgencyLevel: "Normal",
    });
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [requestMessage, setRequestMessage] = useState("");
    const [contactMessage, setContactMessage] = useState("");
    const [ratingMessage, setRatingMessage] = useState("");

    const handleLoginChange = (event) => {
        const { name, value } = event.target;
        setLoginForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleRequestChange = (event) => {
        const { name, value } = event.target;
        setRequestForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleLoginSubmit = (event) => {
        event.preventDefault();
        if (loginForm.email && loginForm.password) {
            setIsLoggedIn(true);
        }
    };

    useEffect(() => {
        const loadHomeData = async () => {
            try {
                const [homeData, ratingData] = await Promise.all([apiRequest("/home"), apiRequest("/ratings")]);
                setStats(homeData.stats || []);
                setRecentRequests(homeData.recentRequests || []);
                setRatings(ratingData || { ratings: [], average: 0, count: 0 });
            } catch (error) {
                setStats([]);
                setRecentRequests([]);
            } finally {
                setLoading(false);
            }
        };
        loadHomeData();
    }, []);

    const handleRatingSubmit = async (event) => {
        event.preventDefault();
        const { token } = getSession();
        if (!token) {
            setRatingMessage("Please log in before submitting a rating.");
            goTo("/login.html");
            return;
        }
        const form = event.currentTarget;
        try {
            await apiRequest("/ratings", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
            });
            form.reset();
            setRatingMessage("Thanks. Your rating is now visible on the homepage.");
        } catch (error) {
            setRatingMessage(error.message || "Unable to submit your rating.");
        }
    };

    const handleRequestSubmit = async (event) => {
        event.preventDefault();
        const { token, user } = getSession();
        if (!token) {
            goTo("/login.html?next=/request.html");
            return;
        }
        if (user?.role !== "requester") {
            clearSession();
            goTo("/login.html?next=/request.html");
            return;
        }

        setRequestMessage("Submitting request...");
        try {
            await apiRequest("/requests", {
                method: "POST",
                body: JSON.stringify(requestForm),
            });
            const data = await apiRequest("/home");
            setStats(data.stats || []);
            setRecentRequests(data.recentRequests || []);
            setRequestForm({ patientName: "", bloodType: "O+", units: 1, hospital: "", city: "Lahore", urgencyLevel: "Normal" });
            setRequestMessage("Blood request submitted. Admins and donors can now see it.");
        } catch (error) {
            setRequestMessage(error.message || "Unable to submit the blood request.");
        }
    };

    const handleContactSubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setContactMessage("Sending your message...");
        try {
            await apiRequest("/contact", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
            });
            setContactMessage("Thanks for reaching out. Our team will get back to you shortly.");
            form.reset();
        } catch (error) {
            setContactMessage(error.message || "Unable to send your message. Please try again.");
        }
    };

    return (
        <div className="app-shell">
            <header className="navbar">
                <div className="brand" aria-label="BloodConnect brand">
                    <span className="bloodconnect-icon" aria-hidden="true" />
                    BloodConnect
                </div>

                <nav aria-label="Main navigation">
                    { navLinks.map(([label, target]) => (
                        <a href={ `#${target}` } key={ label }>
                            { label }
                        </a>
                    )) }
                </nav>

                <div className="nav-actions">
                    <a href="/login.html" className="login">
                        Login
                    </a>
                    <a href="/register.html" className="nav-cta">
                        Book a donor
                    </a>
                </div>
            </header>

            <main>
                <section className="hero">
                    <AnimatedBackground />
                    <div className="hero-content">
                        <div className="small-label">
                            <span className="live-dot" aria-hidden="true" />
                            Live donor response network
                        </div>

                        <h1>
                            Give more than <span>blood</span>.
                            <br />
                            Save a life.
                        </h1>

                        <p>
                            BloodConnect connects hospitals, donors, and communities through a trusted digital platform
                            designed for emergency support, reliable coordination, and rapid response.
                        </p>

                        <div className="hero-buttons">
                            <a href="#request-form" className="red-button">
                                Request blood now
                            </a>
                            <a href="#login-panel" className="outline-button">
                                Become a donor
                            </a>
                        </div>

                        <div className="safe-text">
                            <span>✓</span>
                            Secure, verified, and community-driven support
                        </div>
                    </div>

                    <div className="hero-visual" aria-label="BloodConnect donor platform illustration">
                        <div className="orbit orbit-one" />
                        <div className="orbit orbit-two" />
                        <div className="orbit orbit-three" />
                        <div className="blood-drop">
                            <div className="drop-shine" />
                        </div>
                        <div className="blood-cell cell-one" />
                        <div className="blood-cell cell-two" />
                        <div className="blood-cell cell-three" />
                        <div className="blood-cell cell-four" />
                        <div className="blood-cell cell-five" />

                        <div className="emergency-card">
                            <div className="emergency-top">
                                <span>Emergency match</span>
                                <small>LIVE</small>
                            </div>

                            <div className="blood-type">
                                <strong>O+</strong>
                                <div>
                                    <b>Urgent request</b>
                                    <small>24 donors within 7 km</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="stats-bar" id="impact" aria-label="Community impact stats">
                    { loading ? (
                        <div className="stat-card loading-state">
                            <strong>…</strong>
                            <span>Loading impact data</span>
                        </div>
                    ) : stats.length ? stats.map((item) => (
                        <div key={ item.label } className="stat-card">
                            <strong>{ item.value }</strong>
                            <span>{ item.label }</span>
                        </div>
                    )) : (
                        <div className="stat-card empty-state">
                            <strong>0</strong>
                            <span>No stats available yet</span>
                        </div>
                    ) }
                </section>

                <section className="feature-section" id="why-bloodconnect">
                    <div className="section-heading">
                        <div className="section-label">How it works</div>
                        <h2>Faster coordination. Safer outcomes.</h2>
                    </div>

                    <div className="feature-grid">
                        { [
                            {
                                title: "Urgent matching",
                                text: "Connect verified donors and recipients in real time with faster, smarter coordination.",
                            },
                            {
                                title: "Trusted network",
                                text: "Every request is routed through a secure, medically-aware platform built for life-saving support.",
                            },
                            {
                                title: "Community-led care",
                                text: "Encourage local engagement, transparent communication, and consistent donor participation.",
                            },
                        ].map((item, index) => (
                            <article key={ item.title } className="feature-card">
                                <span className="feature-index">0{ index + 1 }</span>
                                <h3>{ item.title }</h3>
                                <p>{ item.text }</p>
                            </article>
                        )) }
                    </div>
                </section>

                <section className="dashboard-panel" id="donors">
                    <div className="dashboard-header">
                        <div className="section-label">Live requests</div>
                        <h2>Emergency needs across the network</h2>
                    </div>

                    <div className="dashboard-grid">
                        <div className="request-list">
                            { loading ? (
                                <div className="request-item loading-state">
                                    <div className="request-tag">…</div>
                                    <div>
                                        <strong>Loading requests</strong>
                                        <span>Please wait</span>
                                    </div>
                                    <small>Live</small>
                                </div>
                            ) : recentRequests.length ? recentRequests.map((request) => (
                                <div key={ request.id || `${request.hospital}-${request.bloodType}` } className="request-item">
                                    <div className="request-tag">{ request.bloodType }</div>
                                    <div>
                                        <strong>{ request.hospital || request.patientName }</strong>
                                        <span>{ request.city }</span>
                                    </div>
                                    <small>{ request.urgency }</small>
                                </div>
                            )) : (
                                <div className="request-item empty-state">
                                    <div className="request-tag">0</div>
                                    <div>
                                        <strong>No requests</strong>
                                        <span>No active blood requests right now</span>
                                    </div>
                                    <small>Idle</small>
                                </div>
                            ) }
                        </div>

                        <div className="action-stack">
                            <div className="login-panel" id="login-panel">
                                <h3>{ isLoggedIn ? "Donor access active" : "Donor login" }</h3>
                                <form onSubmit={ handleLoginSubmit }>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Email address"
                                        value={ loginForm.email }
                                        onChange={ handleLoginChange }
                                    />
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="Password"
                                        value={ loginForm.password }
                                        onChange={ handleLoginChange }
                                    />
                                    <button type="submit" className="submit-btn">
                                        { isLoggedIn ? "Logged in" : "Login" }
                                    </button>
                                </form>
                            </div>

                            <div className="request-form" id="request-form">
                                <h3>Request blood support</h3>
                                <form onSubmit={ handleRequestSubmit }>
                                    <input
                                        type="text"
                                        name="patientName"
                                        placeholder="Patient name"
                                        value={ requestForm.patientName }
                                        onChange={ handleRequestChange }
                                    />
                                    <input
                                        type="text"
                                        name="hospital"
                                        placeholder="Hospital"
                                        value={ requestForm.hospital }
                                        onChange={ handleRequestChange }
                                    />
                                    <input
                                        type="number"
                                        name="units"
                                        min="1"
                                        max="20"
                                        placeholder="Units"
                                        value={ requestForm.units }
                                        onChange={ handleRequestChange }
                                    />
                                    <select name="bloodType" value={ requestForm.bloodType } onChange={ handleRequestChange }>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                    </select>
                                    <input
                                        type="text"
                                        name="city"
                                        placeholder="City"
                                        value={ requestForm.city }
                                        onChange={ handleRequestChange }
                                    />
                                    <select name="urgencyLevel" value={ requestForm.urgencyLevel } onChange={ handleRequestChange }>
                                        <option value="Normal">Normal</option>
                                        <option value="Emergency">Emergency</option>
                                    </select>
                                    <button type="submit" className="submit-btn accent">
                                        Submit request
                                    </button>
                                </form>
                                { requestMessage && <p className="request-message">{ requestMessage }</p> }
                            </div>
                        </div>
                    </div>
                </section>

                <section className="testimonial" id="ratings">
                    <div className="section-label">Community ratings</div>
                    <h2>Real experiences from the BloodConnect community.</h2>
                    <div className="rating-summary">
                        <strong>{ ratings.average ? ratings.average.toFixed(1) : "--" }</strong>
                        <span>{ ratings.count ? `${ratings.count} approved rating${ratings.count === 1 ? "" : "s"}` : "No ratings yet" }</span>
                    </div>
                    <div className="rating-grid">
                        { ratings.ratings.length ? ratings.ratings.map((item) => (
                            <article className="rating-card" key={ item._id }>
                                <div className="rating-stars" aria-label={ `${item.rating} out of 5 stars` }>{ "★".repeat(item.rating) }{ "☆".repeat(5 - item.rating) }</div>
                                <blockquote>&ldquo;{ item.comment }&rdquo;</blockquote>
                                <strong>{ item.name }</strong>
                            </article>
                        )) : <p className="rating-empty">Be the first community member to share an experience.</p> }
                    </div>
                    <form className="rating-form" onSubmit={ handleRatingSubmit }>
                        <label>Rating<select name="rating" defaultValue="5"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label>
                        <label>Your experience<textarea name="comment" rows="3" maxLength="500" placeholder="Tell the community about your experience..." required /></label>
                        <button type="submit" className="submit-btn">Share rating</button>
                    </form>
                    { ratingMessage && <p className="rating-message" aria-live="polite">{ ratingMessage }</p> }
                </section>

                <section className="process-section" id="resources">
                    <div className="section-heading narrow">
                        <div className="section-label">Our process</div>
                        <h2>Three simple steps from request to rescue.</h2>
                    </div>

                    <div className="process-grid">
                        { steps.map((step, index) => (
                            <div key={ step } className="process-card">
                                <div className="process-no">{ index + 1 }</div>
                                <p>{ step }</p>
                            </div>
                        )) }
                    </div>
                </section>

                <section className="contact-section" id="contact">
                    <div className="contact-copy">
                        <div className="section-label">Contact us</div>
                        <h2>Let&apos;s make support feel closer.</h2>
                        <p>
                            Need help with a blood request, donor profile, or hospital partnership? Send us a message
                            and the BloodConnect team will help you find the next step.
                        </p>
                        <div className="contact-details">
                            <a href="mailto:hello@bloodconnect.org">hello@bloodconnect.org</a>
                            <a href="tel:+923001234567">+92 300 123 4567</a>
                            <span>Available every day, 9:00 AM - 9:00 PM</span>
                        </div>
                    </div>

                    <form className="contact-form" onSubmit={ handleContactSubmit }>
                        <div className="contact-form-row">
                            <label>
                                Your name
                                <input name="name" type="text" placeholder="Your name" required />
                            </label>
                            <label>
                                Email address
                                <input name="email" type="email" placeholder="you@example.com" required />
                            </label>
                        </div>
                        <label>
                            How can we help?
                            <textarea name="message" rows="5" placeholder="Tell us what you need..." required />
                        </label>
                        <button type="submit" className="submit-btn">Send message</button>
                        { contactMessage && <p className="contact-message" aria-live="polite">{ contactMessage }</p> }
                    </form>
                </section>
            </main>
        </div>
    );
}

export default function App() {
    const path = window.location.pathname.replace(/\/$/, "") || "/index.html";

    if (path === "/login.html" || path === "/register.html") {
        return <AuthPage mode={ path === "/register.html" ? "register" : "login" } />;
    }

    if (path === "/dashboard.html") return <DashboardPage />;
    if (path === "/requester-dashboard.html") return <RequesterDashboard />;
    if (path === "/profile.html") return <ProfilePage />;
    if (path === "/request.html" || path === "/request-access.html") return <RequestPage />;
    if (path === "/admin.html") return <AdminPage />;

    return <HomePage />;
}
