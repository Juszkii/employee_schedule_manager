document.addEventListener("DOMContentLoaded", () => {

    // If user data exists in localStorage, cookie is likely still valid — go to dashboard
    if (localStorage.getItem("user")) {
        window.location.href = "/dashboard.html";
        return;
    }

    const form = document.getElementById("login-form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const errorDiv = document.getElementById("error-msg");
        const btn = document.getElementById("login-btn");

        const lang = localStorage.getItem("lang") || "en";
        const tr = TRANSLATIONS[lang] || TRANSLATIONS.en;

        btn.textContent = tr.login_signing_in;
        btn.disabled = true;

        const data = await apiFetch("/auth/login", "POST", { email, password });

        if (!data || data.error) {
            errorDiv.textContent = data?.error || tr.login_err_invalid;
            errorDiv.style.display = "block";
            btn.textContent = tr.login_btn;
            btn.disabled = false;
            return;
        }

        // Save only user profile — JWT token is in HttpOnly cookie, not accessible to JS
        localStorage.setItem("user", JSON.stringify(data.user));

        window.location.href = "/dashboard.html";
    });
});
