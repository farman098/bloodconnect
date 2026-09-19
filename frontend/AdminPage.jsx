import { useEffect, useMemo, useState } from "react";
import { apiRequest, clearSession, getSession, goTo } from "./api.js";
import "./admin.css";

const tabs = [
    { key: "requests", label: "Blood requests" },
    { key: "messages", label: "Contact messages" },
    { key: "users", label: "Users" },
];

const requestStatuses = ["Open", "Matched", "Completed"];
const messageStatuses = ["New", "Read", "Resolved"];

function formatDate(value) {
    return value ? new Date(value).toLocaleString() : "Not recorded";
}

function AdminTopbar() {
    return <header className="topbar">
        <a className="brand" href="/index.html"><span>B</span>BloodConnect</a>
        <div className="admin-topbar-actions">
            <a className="admin-home-link" href="/index.html">View site</a>
            <button className="logout" onClick={ () => { clearSession(); goTo("/login.html"); } }>Log out</button>
        </div>
    </header>;
}

function AdminCard({ item, kind, onStatusChange }) {
    if (kind === "requests") return <article className="message-card">
        <div className="message-meta"><strong>{ item.patientName } · { item.bloodType }</strong><span>{ formatDate(item.createdAt) }</span></div>
        <p>{ item.hospital }, { item.city } · { item.units } unit(s) · { item.urgencyLevel || item.urgency }</p>
        <label>Status<select value={ item.status || "Open" } onChange={ (event) => onStatusChange(`requests/${item._id}`, event.target.value) }>{ requestStatuses.map((status) => <option key={ status }>{ status }</option>) }</select></label>
    </article>;

    if (kind === "messages") return <article className="message-card">
        <div className="message-meta"><strong>{ item.name }</strong><span>{ formatDate(item.createdAt) }</span></div>
        <a href={ `mailto:${item.email}` }>{ item.email }</a><p>{ item.message }</p>
        <label>Status<select value={ item.status || "New" } onChange={ (event) => onStatusChange(`messages/${item._id}`, event.target.value) }>{ messageStatuses.map((status) => <option key={ status }>{ status }</option>) }</select></label>
    </article>;

    return <article className="message-card user-card">
        <div className="message-meta"><strong>{ item.name }</strong><span className="role-badge">{ item.role }</span></div>
        <p>{ item.email }</p><div className="user-details"><span>Blood type: { item.bloodType || "Not added" }</span><span>Availability: { item.availability || "Unknown" }</span></div>
    </article>;
}

export default function AdminPage() {
    const { token, user } = getSession();
    const [data, setData] = useState({ stats: {}, requests: [], messages: [], users: [] });
    const [tab, setTab] = useState("requests");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [state, setState] = useState({ loading: true, error: "", message: "" });

    const loadData = async () => {
        setState((current) => ({ ...current, loading: true, error: "" }));
        try {
            const result = await apiRequest("/admin/overview");
            setData({ stats: result.stats || {}, requests: result.requests || [], messages: result.messages || [], users: result.users || [] });
            setState({ loading: false, error: "", message: "Data refreshed just now." });
        } catch (error) {
            setState({ loading: false, error: error.message, message: "" });
        }
    };

    useEffect(() => {
        if (!token || !user || user.role !== "admin") {
            goTo("/login.html");
            return;
        }
        loadData();
    }, []);

    const records = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return (data[tab] || []).filter((item) => {
            const text = tab === "requests"
                ? `${item.patientName} ${item.bloodType} ${item.hospital} ${item.city} ${item.urgency}`
                : tab === "messages" ? `${item.name} ${item.email} ${item.message}` : `${item.name} ${item.email} ${item.role} ${item.bloodType}`;
            const matchesQuery = !normalizedQuery || text.toLowerCase().includes(normalizedQuery);
            const matchesStatus = statusFilter === "All" || item.status === statusFilter;
            return matchesQuery && (tab === "users" || matchesStatus);
        });
    }, [data, query, statusFilter, tab]);

    const handleTabChange = (nextTab) => {
        setTab(nextTab);
        setQuery("");
        setStatusFilter("All");
    };

    const updateStatus = async (path, status) => {
        try {
            await apiRequest(`/admin/${path}`, { method: "PATCH", body: JSON.stringify({ status }) });
            setData((current) => ({
                ...current,
                [path.startsWith("requests/") ? "requests" : "messages"]: current[path.startsWith("requests/") ? "requests" : "messages"].map((item) => item._id === path.split("/")[1] ? { ...item, status } : item),
            }));
            setState((current) => ({ ...current, message: "Status updated successfully.", error: "" }));
        } catch (error) {
            setState((current) => ({ ...current, error: error.message, message: "" }));
        }
    };

    const activeLabel = tabs.find((item) => item.key === tab)?.label;
    const stats = [[data.stats.users, "Registered users"], [data.stats.requests, "Total requests"], [data.stats.openRequests, "Open requests"], [data.stats.newMessages, "New messages"]];

    return <>
        <AdminTopbar />
        <main className="wrap admin-page">
            <div className="heading"><div><div className="eyebrow">Admin dashboard</div><h1>Control center</h1></div><p>Monitor requests, messages, and donor activity from one place.</p></div>
            <section className="admin-toolbar"><div><strong>Welcome, { user?.name || "Admin" }</strong><span>{ state.loading ? "Loading latest data..." : state.error || state.message }</span></div><button className="refresh-button" onClick={ loadData } disabled={ state.loading }>{ state.loading ? "Refreshing..." : "Refresh data" }</button></section>
            { state.error && <div className="admin-error" role="alert"><span>{ state.error }</span><button onClick={ loadData }>Try again</button></div> }
            <section className="stats-grid">{ stats.map(([value, label]) => <article className="stat-card" key={ label }><strong>{ value ?? 0 }</strong><span>{ label }</span></article>) }</section>
            <nav className="admin-tabs" aria-label="Admin sections">{ tabs.map((item) => <button className={ `tab ${tab === item.key ? "active" : ""}` } onClick={ () => handleTabChange(item.key) } key={ item.key }>{ item.label }<span>{ data[item.key]?.length || 0 }</span></button>) }</nav>
            <section className="admin-panel active"><div className="panel-heading"><div><div className="eyebrow">Workspace</div><h2>{ activeLabel }</h2></div><div className="admin-filters"><input value={ query } onChange={ (event) => setQuery(event.target.value) } placeholder={ `Search ${activeLabel.toLowerCase()}...` } aria-label={ `Search ${activeLabel}` } />{ tab !== "users" && <select value={ statusFilter } onChange={ (event) => setStatusFilter(event.target.value) } aria-label="Filter by status"><option>All</option>{ (tab === "requests" ? requestStatuses : messageStatuses).map((status) => <option key={ status }>{ status }</option>) }</select> }</div></div>
                { state.loading ? <div className="empty">Loading admin data...</div> : records.length ? <div className="message-list">{ records.map((item) => <AdminCard key={ item._id } item={ item } kind={ tab } onStatusChange={ updateStatus } />) }</div> : <div className="empty">No matching records found.</div> }
            </section>
        </main>
    </>;
}