// Relative URL — works because Flask now serves both frontend and API
const API_URL = "/api";

function _getCsrfToken() {
    const match = document.cookie.split(";").find(c => c.trim().startsWith("csrf_access_token="));
    return match ? match.trim().split("=")[1] : null;
}

async function apiFetch(endpoint, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };

    // CSRF token required for state-changing requests (cookie-based auth)
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        const csrf = _getCsrfToken();
        if (csrf) headers["X-CSRF-TOKEN"] = csrf;
    }

    const options = {
        method,
        headers,
        credentials: "include",  // send HttpOnly JWT cookie automatically
    };

    if (body) options.body = JSON.stringify(body);

    let response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, options);
    } catch (networkErr) {
        console.error("Network error:", networkErr);
        return { error: "Cannot reach server. Make sure the backend is running." };
    }

    if (response.status === 401) {
        console.warn("401 Unauthorized on", method, endpoint, "— redirecting to login");
        localStorage.removeItem("user");
        window.location.href = "/index.html";
        return null;
    }

    try {
        return await response.json();
    } catch (parseErr) {
        console.error("JSON parse error (status " + response.status + "):", parseErr);
        return { error: "Server returned an unexpected response (status " + response.status + ")." };
    }
}

function getCurrentUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
}

function isManager() {
    const user = getCurrentUser();
    return user && user.role === "manager";
}

// min 8 chars, at least one upper, one lower, one digit
function isStrongPassword(pw) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw);
}
