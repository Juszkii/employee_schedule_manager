// Wait for all HTML to load before we start searching for elements on the page
// If we don't do this, JavaScript would look for buttons that don't exist yet in the HTML
document.addEventListener("DOMContentLoaded", () => {

    // If user is already logged in (has token in browser memory)
    // no point showing the login page — redirect them to dashboard
    if (localStorage.getItem("token")) {
        window.location.href = "dashboard.html";
        return;
    }

    // Get the login form from HTML by its ID
    const form = document.getElementById("login-form");

    // Listen for when user clicks "Sign In"
    form.addEventListener("submit", async (e) => {

        // By default HTML form reloads the page on click — we don't want that
        // preventDefault() stops this default behavior
        e.preventDefault();

        // Get values entered by user in the form fields
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const errorDiv = document.getElementById("error-msg");
        const btn = document.getElementById("login-btn");

        // Change button text so user knows something is happening
        btn.textContent = "Signing in...";
        btn.disabled = true;

        // Send email and password to backend — using function from api.js
        const data = await apiFetch("/auth/login", "POST", { email, password });

        // If backend returned error (wrong email or password) — show message
        if (data.error) {
            errorDiv.textContent = data.error;
            errorDiv.style.display = "block";
            btn.textContent = "Sign In";
            btn.disabled = false;
            return;
        }

        // Login succeeded — save token and user data in browser
        // This way user will stay logged in even after page refresh
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Redirect to main application page
        window.location.href = "dashboard.html";
    });
});