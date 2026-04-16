// Address of our Flask backend — all requests will go to this address
const API_URL = "http://127.0.0.1:5000/api";

// Function fetching token from browser memory
// localStorage is where browser stores data even after closing the tab
const getToken = () => localStorage.getItem("token");

// Main API communication function — we use it everywhere in the project
// endpoint = what we want to do, e.g. "/auth/login"
// method = request type: GET (fetch), POST (create), PUT (edit), DELETE (remove)
// body = data we send to server (e.g. email and password)
async function apiFetch(endpoint, method = "GET", body = null) {
    const headers = {
        "Content-Type": "application/json", // tell server we're sending JSON
    };

    // If user is logged in, attach their token to every request
    // Backend checks this token and knows who is asking and what role they have
    const token = getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = { method, headers };

    // If we're sending data, convert JavaScript object to JSON text
    // JSON.stringify({email: "a@b.com"}) → '{"email":"a@b.com"}'
    if (body) {
        options.body = JSON.stringify(body);
    }

    // fetch() is a built-in browser function for sending HTTP requests
    // async/await means we wait for response before continuing
    const response = await fetch(`${API_URL}${endpoint}`, options);

    // If server returned 401 (expired or wrong token) — log out user
    if (response.status === 401) {
        localStorage.clear();
        window.location.href = "index.html";
        return;
    }

    // Convert server response from JSON text to JavaScript object
    return response.json();
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