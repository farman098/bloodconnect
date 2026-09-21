import { useEffect, useState } from "react";
import { apiRequest, clearSession, getSession, goTo, API_URL } from "./api.js";
import "./auth.css";
import "./dashboard.css";
import "./profile.css";
import "./request.css";
import "./admin.css";

const bloodTypes = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

function AuthLayout({ mode, children }) {
    const isRegister = mode === "register";
    return <main className="auth-page">
        <section className="auth-art"><div className="auth-mark" aria-hidden="true" /><div className="auth-art-content">
            <h1>{ isRegister ? <>One profile.<br /><span>Many lives touched.</span></> : <>Welcome back.<br /><span>Your match matters.</span></> }</h1>
            <p>{ isRegister ? "Join a community ready to respond when a blood type is needed most." : "Keep your donor profile current so nearby requests can reach you." }</p>
        </div></section>
        <section className="auth-panel"><a className="auth-brand" href="/index.html"><span className="auth-brand-mark">B</span>BloodConnect</a>{ children }</section>
    </main>;
}

export function AuthPage({ mode }) {
    const isRegister = mode === "register";
    const nextPath = new URLSearchParams(window.location.search).get("next");
    const requestedRole = new URLSearchParams(window.location.search).get("role") === "requester" ? "requester" : "donor";
    const [form, setForm] = useState(isRegister
        ? { name: "", email: "", phone: "", password: "", bloodType: "O+", age: "", eligibility: "Needs review", role: requestedRole }
        : { email: "", password: "" });
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

    async function submit(event) {
        event.preventDefault();
        setLoading(true);
        setMessage("");
        try {
            const data = await fetch(`${API_URL}/auth/${isRegister ? "register" : "login"}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
            }).then(async (response) => {
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || "Request failed.");
                return result;
            });
            localStorage.setItem("bloodConnectToken", data.token);
            localStorage.setItem("bloodConnectUser", JSON.stringify(data.user));
            if (nextPath && data.user.role === "requester") goTo(nextPath);
            else goTo(data.user.role === "admin" ? "/admin.html" : data.user.role === "requester" ? "/requester-dashboard.html" : "/dashboard.html");
        } catch (error) {
            setMessage(error.name === "TypeError" ? "Backend connection failed. Start the API server first." : error.message);
            setLoading(false);
        }
    }

    return <AuthLayout mode={ mode }><div className="auth-kicker">{ isRegister ? "Join the community" : "Welcome back" }</div>
        <h2>{ isRegister ? "Become a donor." : "Log in to BloodConnect." }</h2>
        <p>{ isRegister ? "Create your profile and be ready for the next request in your area." : "Manage your donor profile and stay ready to help." }</p>
        <form className="auth-form" onSubmit={ submit }>
            { isRegister && <label>Full name<input name="name" value={ form.name } onChange={ update } placeholder="Ayesha Khan" required /></label> }
            <label>Email address<input name="email" type="email" value={ form.email } onChange={ update } placeholder="you@example.com" required /></label>
            { isRegister && <label>Phone number<input name="phone" type="tel" value={ form.phone } onChange={ update } placeholder="+92 300 1234567" /></label> }
            <label>Password<input name="password" type="password" value={ form.password } onChange={ update } minLength="6" placeholder="Your password" required /></label>
            { isRegister && <>
                <label>Blood type<select name="bloodType" value={ form.bloodType } onChange={ update }>{ bloodTypes.map((type) => <option key={ type }>{ type }</option>) }</select></label>
                <label>Age<input name="age" type="number" min="16" max="100" value={ form.age } onChange={ update } required /></label>
                <label>Eligibility<select name="eligibility" value={ form.eligibility } onChange={ update }><option>Needs review</option><option>Eligible</option><option>Not eligible</option></select></label>
                <label>Account type<select name="role" value={ form.role } onChange={ update }><option value="donor">Donor</option><option value="requester">Requester</option></select></label>
            </> }
            <p className="auth-message" aria-live="polite">{ message }</p><button className="auth-submit" type="submit" disabled={ loading }>{ loading ? "Please wait..." : isRegister ? "Create donor profile" : "Log in" }</button>
        </form>
        <p className="auth-switch">{ isRegister ? "Already have an account? " : "New to BloodConnect? " }<a href={ isRegister ? `/login.html${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}` : `/register.html${nextPath ? `?next=${encodeURIComponent(nextPath)}&role=requester` : ""}` }>{ isRegister ? "Log in" : nextPath === "/request.html" ? "Create a requester account" : "Create a donor profile" }</a></p>
    </AuthLayout>;
}

function Protected({ children, role }) {
    const { token, user } = getSession();
    if (!token || !user || (role && user.role !== role)) {
        goTo("/login.html");
        return null;
    }
    return children;
}

function AppTopbar() {
    return <header className="topbar"><a className="brand" href="/index.html" aria-label="BloodConnect home"><span className="brand-mark" aria-hidden="true">B</span><span className="brand-name">BloodConnect</span></a><button className="logout" onClick={ () => { clearSession(); goTo("/login.html"); } }>Log out</button></header>;
}

function LegacyDashboardPage() {
    const { user } = getSession();
    const [profile, setProfile] = useState({});
    const [requests, setRequests] = useState([]);
    const [responses, setResponses] = useState([]);
    const [section, setSection] = useState("requests");
    const [message, setMessage] = useState("Loading requests...");
    const [availability, setAvailability] = useState("Available");

    async function load() {
        try { const [profileData, requestData, responseData] = await Promise.all([apiRequest("/profile/me"), apiRequest("/requests"), apiRequest("/requests/my-responses")]); setProfile(profileData); setRequests(requestData); setResponses(responseData); setMessage(""); }
        catch (error) { setMessage(error.message); }
    }
    useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, []);
    async function updateAvailability(event) { setAvailability(event.target.value); try { const data = await apiRequest("/profile/me", { method: "PATCH", body: JSON.stringify({ availability: event.target.value }) }); setProfile((current) => ({ ...current, ...data })); setMessage(`Availability updated: ${data.availability}`); } catch (error) { setMessage(error.message); } }
    async function respond(id, response) { try { await apiRequest(`/requests/${id}/respond`, { method: "PATCH", body: JSON.stringify({ response }) }); setMessage(`Request ${response.toLowerCase()}.`); load(); } catch (error) { setMessage(error.message); } }
    return <Protected><AppTopbar /><main className="wrap"><div className="heading"><div><div className="eyebrow">Donor dashboard</div><h1>Hello, <span>{ user?.name || "Donor" }</span>.</h1></div><p>Your profile is ready to help when a matching blood request appears nearby.</p></div>
        <div className="actions"><a className="button" href="/profile.html">Update profile</a><button className={ `button ${section === "requests" ? "primary" : ""}` } onClick={ () => setSection("requests") }>Available requests</button><button className={ `button ${section === "responses" ? "primary" : ""}` } onClick={ () => setSection("responses") }>My responses ({ responses.length })</button><button className="button" onClick={ async () => { if ("Notification" in window) setMessage((await Notification.requestPermission()) === "granted" ? "Emergency notifications enabled." : "Notifications were not enabled."); } }>Enable notifications</button></div>
        <section className="stats"><div className="stat"><strong>{ profile.bloodType || "--" }</strong><span>Your blood type</span></div><div className="stat"><strong>{ profile.availability || availability }</strong><span>Availability</span></div><div className="stat"><strong>{ profile.donationHistory?.length || 0 }</strong><span>Donations recorded</span></div></section>
        <section className="profile-strip"><div><span className="eyebrow">Eligibility</span><strong>{ profile.eligibility || "Needs review" }</strong></div><label>Availability<select value={ profile.availability || availability } onChange={ updateAvailability }><option>Available</option><option>Not Available</option></select></label><div><span className="eyebrow">Last donation</span><strong>{ profile.lastDonationDate ? new Date(profile.lastDonationDate).toLocaleDateString() : "Not recorded" }</strong></div></section>
        <div className="eyebrow">{ section === "requests" ? "Latest requests" : "Response history" }</div><h2>{ section === "requests" ? <>People who need a match. <span className="live-label">● Live updates</span></> : "Your donor activity" }</h2><p className="dashboard-message" aria-live="polite">{ message }</p><section className="request-list">{ section === "requests" ? (requests.length ? requests.map((request) => <article className="request-card" key={ request._id }><div className="blood">{ request.bloodType }</div><div><h3>{ request.patientName }</h3><p>{ request.hospital }, { request.city } · { request.units } unit(s)</p><div className="request-actions"><button onClick={ () => respond(request._id, "Accepted") }>Accept Request</button><button onClick={ () => respond(request._id, "Declined") }>Decline</button></div></div><div className="urgency">{ request.urgency }<br /><small>{ request.status }</small></div></article>) : <div className="empty">{ message || "No blood requests available right now." }</div>) : (responses.length ? responses.map((item) => <article className="request-card response-card" key={ item._id }><div className="blood">{ item.requestId?.bloodType || "--" }</div><div><h3>{ item.requestId?.patientName || "Request unavailable" }</h3><p>{ item.requestId?.hospital || "Hospital unavailable" }, { item.requestId?.city || "Location unavailable" } · { item.requestId?.units || 0 } unit(s)</p><small>Responded { item.respondedAt ? new Date(item.respondedAt).toLocaleDateString() : "recently" }</small></div><div className="urgency">{ item.status }</div></article>) : <div className="empty">You have not responded to any blood request yet.</div>) }</section>
    </main></Protected>;
}

export function ProfilePage() {
    const [form, setForm] = useState({}); const [history, setHistory] = useState([]); const [message, setMessage] = useState("Loading profile...");
    useEffect(() => { apiRequest("/profile/me").then((data) => { setForm({ ...data, lastDonationDate: data.lastDonationDate ? new Date(data.lastDonationDate).toISOString().slice(0, 10) : "" }); setHistory(data.donationHistory || []); setMessage(""); }).catch((error) => setMessage(error.message)); }, []);
    const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    async function submit(event) { event.preventDefault(); setMessage("Saving..."); try { const data = await apiRequest("/profile/me", { method: "PATCH", body: JSON.stringify(form) }); localStorage.setItem("bloodConnectUser", JSON.stringify(data)); setMessage("Profile updated successfully."); } catch (error) { setMessage(error.message); } }
    return <Protected><main className="profile-page"><section className="profile-box"><a className="back" href="/dashboard.html">← Back to dashboard</a><div className="eyebrow">Donor profile</div><h1>Keep your details current.</h1><p>Accurate information helps BloodConnect send the right emergency request to you.</p><form className="profile-form" onSubmit={ submit }>{ [["name", "Full name"], ["email", "Email"]].map(([name, label]) => <label key={ name }>{ label }<input name={ name } value={ form[name] || "" } onChange={ update } readOnly={ name === "email" } required /></label>) }<label>Blood type<select name="bloodType" value={ form.bloodType || "O+" } onChange={ update }>{ bloodTypes.map((type) => <option key={ type }>{ type }</option>) }</select></label><label>Age<input name="age" type="number" min="16" max="100" value={ form.age || "" } onChange={ update } required /></label><label>Eligibility<select name="eligibility" value={ form.eligibility || "Needs review" } onChange={ update }><option>Needs review</option><option>Eligible</option><option>Not eligible</option></select></label><label>Availability<select name="availability" value={ form.availability || "Available" } onChange={ update }><option>Available</option><option>Not Available</option></select></label><label>Last donation date<input name="lastDonationDate" type="date" value={ form.lastDonationDate || "" } onChange={ update } /></label><p className="message" aria-live="polite">{ message }</p><button type="submit">Save profile</button></form><section className="history"><div className="eyebrow">Donation history</div>{ history.length ? history.map((item) => <div className="history-item" key={ `${item.date}-${item.location}` }><strong>{ new Date(item.date).toLocaleDateString() }</strong><span>{ item.location || "Location not added" } · { item.units } unit(s)</span></div>) : <p>No donations recorded yet.</p> }</section></section></main></Protected>;
}

export function RequestPage() {
    const [form, setForm] = useState({ patientName: "", bloodType: "O+", units: 1, hospital: "", city: "", urgencyLevel: "Normal" }); const [message, setMessage] = useState("");
    const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    async function submit(event) { event.preventDefault(); setMessage("Submitting..."); try { await apiRequest("/requests", { method: "POST", body: JSON.stringify(form) }); goTo("/requester-dashboard.html"); } catch (error) { setMessage(error.message); } }
    return <Protected role="requester"><main className="request-page"><section className="request-box"><a className="back" href="/index.html">← Back to home</a><h1>Request blood.</h1><p>Share the essentials so nearby verified donors can respond quickly. Admins and donors will see this request.</p><form className="request-form" onSubmit={ submit }>{ [["patientName", "Patient name", "Patient full name"], ["hospital", "Hospital", "Hospital name"], ["city", "City", "Peshawar"]].map(([name, label, placeholder]) => <label key={ name }>{ label }<input name={ name } value={ form[name] } onChange={ update } placeholder={ placeholder } required /></label>) }<label>Blood type<select name="bloodType" value={ form.bloodType } onChange={ update }>{ bloodTypes.map((type) => <option key={ type }>{ type }</option>) }</select></label><label>Units needed<input name="units" type="number" min="1" max="20" value={ form.units } onChange={ update } required /></label><label>Urgency level<select name="urgencyLevel" value={ form.urgencyLevel } onChange={ update }><option>Normal</option><option>Emergency</option></select></label><p className="message" aria-live="polite">{ message }</p><button className="request-submit" type="submit">Submit blood request</button></form></section></main></Protected>;
}

export function AdminPage() {
    const [data, setData] = useState({ stats: {}, requests: [], messages: [], users: [] }); const [message, setMessage] = useState("Loading admin data..."); const [tab, setTab] = useState("requests");
    useEffect(() => { apiRequest("/admin/overview").then((result) => { setData(result); setMessage("Admin data loaded."); }).catch((error) => setMessage(error.message)); }, []);
    async function update(path, status) { try { await apiRequest(`/admin/${path}`, { method: "PATCH", body: JSON.stringify({ status }) }); setMessage("Status updated."); } catch (error) { setMessage(error.message); } }
    const stats = [[data.stats.users, "Registered users"], [data.stats.requests, "Total requests"], [data.stats.openRequests, "Open requests"], [data.stats.newMessages, "New messages"]];
    return <Protected role="admin"><AppTopbar /><main className="wrap"><div className="heading"><div><div className="eyebrow">Admin dashboard</div><h1>Admin control center</h1></div><p>Manage blood requests, contact messages, and donor activity from one place.</p></div><p className="message" aria-live="polite">{ message }</p><section className="stats-grid">{ stats.map(([value, label]) => <article className="stat-card" key={ label }><strong>{ value || 0 }</strong><span>{ label }</span></article>) }</section><nav className="admin-tabs" aria-label="Admin sections">{ [["requests", "Blood requests"], ["messages", "Contact messages"], ["users", "Users"]].map(([key, label]) => <button className={ `tab ${tab === key ? "active" : ""}` } onClick={ () => setTab(key) } key={ key }>{ label }</button>) }</nav><section className="admin-panel active"><h2>{ tab === "requests" ? "Blood requests" : tab === "messages" ? "Contact messages" : "Registered users" }</h2><div className="message-list">{ tab === "requests" && data.requests.map((item) => <article className="message-card" key={ item._id }><div className="message-meta"><strong>{ item.patientName } · { item.bloodType }</strong><span>{ new Date(item.createdAt).toLocaleString() }</span></div><p>{ item.hospital }, { item.city } · { item.units } unit(s) · { item.urgency }</p><label>Status <select defaultValue={ item.status } onChange={ (event) => update(`requests/${item._id}`, event.target.value) }><option>Open</option><option>Matched</option><option>Completed</option></select></label></article>) }{ tab === "messages" && data.messages.map((item) => <article className="message-card" key={ item._id }><div className="message-meta"><strong>{ item.name }</strong><span>{ new Date(item.createdAt).toLocaleString() }</span></div><a href={ `mailto:${item.email}` }>{ item.email }</a><p>{ item.message }</p><label>Status <select defaultValue={ item.status } onChange={ (event) => update(`messages/${item._id}`, event.target.value) }><option>New</option><option>Read</option><option>Resolved</option></select></label></article>) }{ tab === "users" && data.users.map((item) => <article className="message-card" key={ item._id }><div className="message-meta"><strong>{ item.name }</strong><span>{ item.role }</span></div><p>{ item.email } · { item.bloodType || "No blood type" } · { item.availability || "Unknown" }</p></article>) }{ !data[tab]?.length && <div className="empty">No records yet.</div> }</div></section></main></Protected>;
}

const relativeTime = (date) => {
    const seconds = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

const defaultDonationDate = () => {
    const date = new Date(Date.now() + 86400000);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

const directionsUrl = (request) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${request.hospital}, ${request.city}`)}`;

function DonorDashboard() {
    const { user } = getSession();
    const [profile, setProfile] = useState({});
    const [requests, setRequests] = useState([]);
    const [activity, setActivity] = useState({ totalDonations: 0, lastDonationDate: null, acceptedRequests: [] });
    const [notifications, setNotifications] = useState([]);
    const [filter, setFilter] = useState("mine");
    const [sort, setSort] = useState("newest");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [message, setMessage] = useState("");
    const [confirmedDate, setConfirmedDate] = useState(defaultDonationDate);
    const [actionLoading, setActionLoading] = useState("");
    const [requesterContacts, setRequesterContacts] = useState({});

    async function loadDashboard() {
        setLoading(true);
        setError("");
        try {
            const [profileData, requestData, activityData, notificationData] = await Promise.all([
                apiRequest(`/profile/me`),
                apiRequest(`/requests?bloodType=${encodeURIComponent(filter)}&sort=${sort}`),
                apiRequest(`/requests/activity`),
                apiRequest(`/requests/notifications`),
            ]);
            setProfile(profileData);
            setRequests(requestData);
            setActivity(activityData);
            setNotifications(notificationData);
        } catch (loadError) {
            setError(loadError.message || "Unable to load your donor dashboard.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDashboard();
        const timer = setInterval(loadDashboard, 30000);
        return () => clearInterval(timer);
    }, [filter, sort]);

    async function acceptRequest() {
        setActionLoading("accept");
        try {
            const result = await apiRequest(`/requests/${selectedRequest.id}/accept`, { method: "POST", body: JSON.stringify({ confirmedDate }) });
            setSelectedRequest(null);
            if (result.requester) setRequesterContacts((current) => ({ ...current, [result.request.id]: result.requester }));
            setMessage(`Accepted. Contact ${result.requester?.firstName || "the requester"} at ${result.requester?.phone || result.requester?.email || "the available contact"}.`);
            loadDashboard();
        } catch (acceptError) {
            setMessage(acceptError.message);
        } finally {
            setActionLoading("");
        }
    }

    async function cancelAcceptance(id) {
        setActionLoading(`cancel-${id}`);
        try {
            await apiRequest(`/requests/${id}/cancel`, { method: "POST", body: JSON.stringify({}) });
            setMessage("Your acceptance was cancelled and the request is available again.");
            loadDashboard();
        } catch (cancelError) {
            setMessage(cancelError.message);
        } finally {
            setActionLoading("");
        }
    }

    async function showRequesterContact(id) {
        setActionLoading(`contact-${id}`);
        try {
            const data = await apiRequest(`/requests/${id}/contact`);
            setRequesterContacts((current) => ({ ...current, [id]: data.contact }));
        } catch (error) {
            setMessage(error.message || "Unable to load requester contact.");
        } finally {
            setActionLoading("");
        }
    }

    return <Protected role="donor"><AppTopbar /><main className="wrap donor-dashboard">
        <div className="heading"><div><div className="eyebrow">Donor dashboard</div><h1>Hello, <span>{ user?.name || "Donor" }</span>.</h1></div><p>Live requests matched to your blood group, with privacy protected until you accept.</p></div>
        <section className="stats donor-stats"><div className="stat"><strong>{ profile.bloodType || "--" }</strong><span>Your blood group</span></div><div className="stat"><strong>{ activity.totalDonations }</strong><span>Total donations</span></div><div className="stat"><strong>{ activity.acceptedRequests.filter((item) => item.status === "accepted").length }</strong><span>Active acceptances</span></div><div className="stat"><strong>{ activity.lastDonationDate ? new Date(activity.lastDonationDate).toLocaleDateString() : "Not recorded" }</strong><span>Last donation</span></div></section>
        { notifications.length > 0 && <section className="notification-strip"><strong>New matching updates</strong><span>{ notifications[0].message }</span></section> }
        <div className="dashboard-toolbar"><div><div className="eyebrow">Available blood requests</div><h2>People who need your help.</h2></div><div className="feed-controls"><label>Blood group<select value={ filter } onChange={ (event) => setFilter(event.target.value) }><option value="mine">My blood group ({ profile.bloodType || "--" })</option><option value="all">All groups</option>{ bloodTypes.map((type) => <option value={ type } key={ type }>{ type }</option>) }</select></label><label>Sort by<select value={ sort } onChange={ (event) => setSort(event.target.value) }><option value="newest">Newest first</option><option value="urgent">Most urgent first</option><option value="nearest">Nearest first</option></select></label></div></div>
        { message && <p className="dashboard-message" aria-live="polite">{ message }</p> }
        { error ? <div className="feed-state error-state"><strong>We could not load requests.</strong><span>{ error }</span><button className="button primary" onClick={ loadDashboard }>Retry</button></div> : loading ? <div className="feed-state"><span className="spinner" aria-hidden="true" /><strong>Loading available requests...</strong></div> : requests.length ? <section className="request-list donor-feed">{ requests.map((request) => <article className={ `request-card donor-request-card ${request.urgencyLevel === "Emergency" ? "emergency-request" : ""}` } key={ request.id }><div className="blood">{ request.bloodType }</div><div className="request-main"><div className="request-title"><h3>{ request.hospital }</h3><span className={ `urgency-badge ${request.urgencyLevel === "Emergency" ? "emergency" : "normal"}` }>{ request.urgencyLevel || request.urgencyLabel }</span></div><p>{ request.city } · { request.units } unit(s) needed</p><small>Posted { relativeTime(request.createdAt) } · Patient contact hidden until acceptance</small>{ request.responseStatus === "accepted" ? <button className="request-action cancel-action" onClick={ () => cancelAcceptance(request.id) } disabled={ actionLoading === `cancel-${request.id}` }>{ actionLoading === `cancel-${request.id}` ? "Cancelling..." : "Cancel my acceptance" }</button> : request.eligibility.eligible ? <button className="request-action" onClick={ () => { setConfirmedDate(defaultDonationDate()); setSelectedRequest(request); } }>Accept Request</button> : <p className="eligibility-warning">You are not eligible to donate yet. Eligible on { new Date(request.eligibility.eligibleOn).toLocaleDateString() }.</p> }</div><div className="request-side"><strong>{ request.units }</strong><span>units</span></div></article>) }</section> : <div className="feed-state empty-state"><span className="empty-icon" aria-hidden="true">+</span><strong>No matching requests available right now</strong><span>Try viewing all blood groups or check back soon.</span></div> }
        <section className="activity-section"><div className="eyebrow">Your activity</div><h2>Accepted requests</h2>{ activity.acceptedRequests.length ? <div className="activity-list">{ activity.acceptedRequests.map((item) => <article className="activity-item receipt-card" key={ item._id }><div><strong>{ item.requestId?.hospital || "Request unavailable" }</strong><span>{ item.requestId?.bloodType || "--" } · { item.requestId?.city || "Location unavailable" }</span><span>{ item.requestId?.confirmedDate ? new Date(item.requestId.confirmedDate).toLocaleString() : "Date not confirmed" }</span>{ requesterContacts[item.requestId?._id] && <span className="matched-contact">{ requesterContacts[item.requestId._id].name } · { requesterContacts[item.requestId._id].phone || requesterContacts[item.requestId._id].email || "Contact unavailable" }</span> }</div><div className="receipt-actions"><span className={ `activity-status ${item.status}` }>{ item.status === "accepted" ? "Confirmed" : item.status }</span>{ item.status === "accepted" && item.requestId && <button className="button" onClick={ () => showRequesterContact(item.requestId._id) } disabled={ actionLoading === `contact-${item.requestId._id}` }>{ actionLoading === `contact-${item.requestId._id}` ? "Loading..." : "Contact Requester" }</button> }{ item.requestId && <a className="button" href={ directionsUrl(item.requestId) } target="_blank" rel="noreferrer">Get Directions</a> }{ item.status === "accepted" && item.requestId && <button className="button" onClick={ () => cancelAcceptance(item.requestId._id) } disabled={ actionLoading === `cancel-${item.requestId._id}` }>{ actionLoading === `cancel-${item.requestId._id}` ? "Cancelling..." : "Cancel" }</button> }</div></article>) }</div> : <p className="empty-copy">Your accepted requests will appear here.</p> }</section>
        { selectedRequest && <div className="modal-backdrop" role="presentation" onClick={ () => setSelectedRequest(null) }><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={ (event) => event.stopPropagation() }><button className="modal-close" onClick={ () => setSelectedRequest(null) } aria-label="Close confirmation">×</button><div className="eyebrow">Confirm availability</div><h2 id="confirm-title">Can you help at { selectedRequest.hospital }?</h2><p><strong>{ selectedRequest.bloodType }</strong> · { selectedRequest.units } unit(s) · { selectedRequest.urgencyLevel || selectedRequest.urgencyLabel }</p><p>Choose when you can donate. Contact details will be revealed after confirmation.</p><label className="modal-date">Donation date and time<input type="datetime-local" min={ defaultDonationDate() } value={ confirmedDate } onChange={ (event) => setConfirmedDate(event.target.value) } /></label><div className="modal-actions"><button className="button" onClick={ () => setSelectedRequest(null) } disabled={ actionLoading === "accept" }>Cancel</button><button className="button primary" onClick={ acceptRequest } disabled={ actionLoading === "accept" }>{ actionLoading === "accept" ? "Confirming..." : "Confirm acceptance" }</button></div></section></div> }
    </main></Protected>;
}

export function DashboardPage() {
    return <DonorDashboard />;
}

export function RequesterDashboard() {
    const { user } = getSession();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [actionLoading, setActionLoading] = useState("");
    const [thankYouDrafts, setThankYouDrafts] = useState({});

    async function loadRequests() {
        setLoading(true);
        try {
            setRequests(await apiRequest("/requests/mine"));
            setMessage("");
        } catch (error) {
            setMessage(error.message || "Unable to load your requests.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadRequests(); }, []);

    async function completeRequest(id) {
        setActionLoading(`complete-${id}`);
        try { await apiRequest(`/requests/${id}/complete`, { method: "POST", body: JSON.stringify({}) }); setMessage("Request marked as completed."); await loadRequests(); }
        catch (error) { setMessage(error.message || "Failed to complete request."); }
        finally { setActionLoading(""); }
    }

    async function sendThankYou(id) {
        const text = thankYouDrafts[id]?.trim();
        if (!text) return setMessage("Write a thank-you message first.");
        setActionLoading(`thank-you-${id}`);
        try { await apiRequest(`/requests/${id}/thank-you`, { method: "POST", body: JSON.stringify({ message: text }) }); setThankYouDrafts((current) => ({ ...current, [id]: "" })); setMessage("Thank-you message sent."); }
        catch (error) { setMessage(error.message || "Unable to send the thank-you message."); }
        finally { setActionLoading(""); }
    }

    return <Protected role="requester"><AppTopbar /><main className="wrap requester-dashboard">
        <div className="heading"><div><div className="eyebrow">Requester dashboard</div><h1>Hello, <span>{ user?.name || "Requester" }</span>.</h1></div><p>Track the blood requests you have submitted and their latest status.</p></div>
        <div className="actions"><a className="button primary" href="/request.html">Create blood request</a><button className="button" onClick={ loadRequests }>Refresh requests</button></div>
        <p className="dashboard-message" aria-live="polite">{ message }</p>
        { loading ? <div className="feed-state"><span className="spinner" aria-hidden="true" /><strong>Loading your requests...</strong></div> : requests.length ? <section className="request-list">{ requests.map((request) => <article className={ `request-card requester-request-card ${request.urgencyLevel === "Emergency" ? "emergency-request" : ""}` } key={ request._id }><div className="blood">{ request.bloodType }</div><div><div className="request-title"><h3>{ request.patientName }</h3><span className={ `urgency-badge ${request.urgencyLevel === "Emergency" ? "emergency" : "normal"}` }>{ request.urgencyLevel || "Normal" }</span></div><p>{ request.hospital }, { request.city } · { request.units } unit(s)</p><small>Submitted { new Date(request.createdAt).toLocaleString() }</small>{ request.matchedDonorId && <><p className="matched-contact">Contact donor: { request.matchedDonorId.phone || request.matchedDonorId.email }</p>{ request.matchedDonorId.phone ? <a className="button" href={ `tel:${request.matchedDonorId.phone}` }>Contact Donor</a> : <a className="button" href={ `mailto:${request.matchedDonorId.email}` }>Contact Donor</a> }</> }{ request.status === "Matched" && request.confirmedDate && new Date(request.confirmedDate) <= new Date() && <button className="request-action" onClick={ () => completeRequest(request._id) } disabled={ actionLoading === `complete-${request._id}` }>{ actionLoading === `complete-${request._id}` ? "Completing..." : "Mark as Completed" }</button> }{ request.status === "Completed" && request.matchedDonorId && <div className="thank-you-box"><input value={ thankYouDrafts[request._id] || "" } onChange={ (event) => setThankYouDrafts((current) => ({ ...current, [request._id]: event.target.value })) } placeholder="Send a thank-you message" /><button className="request-action" onClick={ () => sendThankYou(request._id) } disabled={ actionLoading === `thank-you-${request._id}` }>{ actionLoading === `thank-you-${request._id}` ? "Sending..." : "Send thanks" }</button></div> }</div><div className="urgency"><strong>{ request.status }</strong>{ request.confirmedDate && <small>{ new Date(request.confirmedDate).toLocaleString() }</small> }</div></article>) }</section> : <div className="feed-state empty-state"><strong>You have not submitted any blood requests yet.</strong><a className="button primary" href="/request.html">Create your first request</a></div> }
    </main></Protected>;
}