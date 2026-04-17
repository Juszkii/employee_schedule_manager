// Address of our Flask backend — all requests will go to this address
const API_URL = "http://127.0.0.1:5000/api";

// Function fetching token from browser memory
const getToken = () => localStorage.getItem("token");

async function apiFetch(endpoint, method = "GET", body = null) {
    const headers = {
        "Content-Type": "application/json",
    };

    const token = getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = { method, headers };

    if (body) {
        options.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, options);
    } catch (networkErr) {
        console.error("Network error:", networkErr);
        return { error: "Cannot reach server. Make sure the backend is running." };
    }

    if (response.status === 401) {
        console.warn("401 Unauthorized on", method, endpoint, "— redirecting to login");
        localStorage.clear();
        window.location.href = "index.html";
        return null;
    }

    try {
        return await response.json();
    } catch (parseErr) {
        console.error("JSON parse error (status " + response.status + "):", parseErr);
        return { error: "Server returned an unexpected response (status " + response.status + ")." };
    }
}

// Helper function — fetches logged in user data from browser memory
function getCurrentUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
}

// Check if logged in user is a manager
function isManager() {
    const user = getCurrentUser();
    return user && user.role === "manager";
}
