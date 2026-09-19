const apiHost = window.location.hostname || "127.0.0.1";

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
const localApiUrl = `http://${apiHost}:3000/api`;
export const API_URL = configuredApiUrl || localApiUrl;

export const getSession = () => ({
    token: localStorage.getItem("bloodConnectToken"),
    user: JSON.parse(localStorage.getItem("bloodConnectUser") || "null"),
});

export const clearSession = () => {
    localStorage.removeItem("bloodConnectToken");
    localStorage.removeItem("bloodConnectUser");
};

export async function apiRequest(path, options = {}) {
    const { token } = getSession();
    const candidateUrls = [API_URL];
    if (API_URL !== localApiUrl) candidateUrls.push(localApiUrl);

    for (const baseUrl of candidateUrls) {
        let response;
        try {
            response = await fetch(`${baseUrl}${path}`, {
                ...options,
                headers: {
                    ...(options.body ? { "Content-Type": "application/json" } : {}),
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...options.headers,
                },
            });
        } catch {
            if (baseUrl !== candidateUrls[candidateUrls.length - 1]) continue;
            throw new Error("Backend connection failed. Start the API server on port 3000.");
        }

        const contentType = response.headers.get("content-type") || "";
        const rawBody = await response.text();
        const trimmedBody = rawBody.trimStart();
        const isHtml = trimmedBody.startsWith("<!DOCTYPE") || trimmedBody.startsWith("<html");
        if (isHtml && baseUrl !== candidateUrls[candidateUrls.length - 1]) continue;

        let data;
        try {
            data = contentType.includes("application/json") ? JSON.parse(rawBody) : null;
        } catch {
            data = null;
        }

        if (!data) {
            if (isHtml) throw new Error("The API URL returned a webpage. Start the backend from the backend folder or set VITE_API_URL correctly.");
            throw new Error("The API returned an invalid response. Check that the backend server is running.");
        }

        if (!response.ok) throw new Error(data.message || "Request failed.");
        return data;
    }

    throw new Error("Unable to reach the API server.");
}

export const goTo = (path) => {
    window.location.href = path;
};