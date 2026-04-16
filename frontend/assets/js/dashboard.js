// ── GLOBAL VARIABLES ─────────────────────────────────────────
// Store application state — current month, employee list, etc.
let currentDate = new Date();
let allShifts = [];
let allUsers = [];
let allLabels = [];

// ── INITIALIZATION ─────────────────────────────────────────
// This function runs when the page loads
document.addEventListener("DOMContentLoaded", async () => {

    // If no token — redirect to login page
    if (!localStorage.getItem("token")) {
        window.location.href = "index.html";
        return;
    }

    const user = getCurrentUser();

    // Display user name and role in sidebar
    document.getElementById("user-name").textContent = user.name;
    document.getElementById("user-role").textContent =
        user.role === "manager" ? "Manager" : "Employee";

    // Hide elements that are only for manager or only for employee
    if (user.role !== "manager") {
        document.querySelectorAll(".manager-only").forEach(el => el.style.display = "none");
        document.getElementById("nav-employees").style.display = "none";
        document.getElementById("nav-stats").style.display = "none";
    } else {
        document.querySelectorAll(".employee-only").forEach(el => el.style.display = "none");
    }

    // Load data needed for application to work
    await loadUsers();
    await loadLabels();
    await loadCalendar();
    await loadNotifCount();
});

// ── NAVIGATION BETWEEN VIEWS ───────────────────────────────
// Instead of reloading page, we hide and show appropriate HTML sections
function showView(view) {
    // Hide all views
    document.querySelectorAll("[id^='view-']").forEach(el => el.style.display = "none");
    // Remove active class from all navigation buttons
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));

    // Show selected view
    document.getElementById(`view-${view}`).style.display = "block";

    // Load appropriate data for selected view
    if (view === "calendar")      loadCalendar();
    if (view === "employees")     loadEmployees();
    if (view === "requests")      loadRequests();
    if (view === "notifications") loadNotifications();
    if (view === "stats")         loadStats();
}

// ── WYLOGOWANIE ───────────────────────────────────────────────
function logout() {
    localStorage.clear(); // czyścimy token i dane użytkownika
    window.location.href = "index.html";
}

// ── MODALS ──────────────────────────────────────────────────────────────────
function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

function openModal(id) {
    document.getElementById(id).classList.add("active");
}

// Close modal by clicking outside it
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.remove("active");
    }
});

// ── CALENDAR ───────────────────────────────────────────────
async function loadCalendar() {
    // Get shifts for current month from backend
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const data = await apiFetch(`/shifts/?month=${month}`);
    allShifts = data || [];
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Set calendar title, e.g. "April 2026"
    document.getElementById("calendar-title").textContent =
        currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const grid = document.getElementById("calendar-grid");
    grid.innerHTML = "";

    // Week day headers
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    days.forEach(d => {
        const header = document.createElement("div");
        header.className = "calendar-day-header";
        header.textContent = d;
        grid.appendChild(header);
    });

    // First day of month — check which day of week to start from
    const firstDay = new Date(year, month, 1);
    // getDay() returns 0=Sunday, 1=Monday etc. — convert to European format
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    // Last day of month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Fill empty cells before first day of month
    for (let i = 0; i < startDow; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day other-month";
        grid.appendChild(empty);
    }

    // Create cell for each day of month
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day";

        // Check if this is today
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            cell.classList.add("today");
        }

        // Day number
        const dayNum = document.createElement("div");
        dayNum.className = "day-number";
        dayNum.textContent = day;
        cell.appendChild(dayNum);

        // Find shifts for this day and display them as colored tiles
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayShifts = allShifts.filter(s => s.date === dateStr);

        dayShifts.forEach(shift => {
            const chip = document.createElement("div");
            chip.className = "shift-chip";
            chip.textContent = `${shift.user_name} ${shift.start_time}-${shift.end_time}`;
            chip.title = shift.note || "";
            cell.appendChild(chip);
        });

        grid.appendChild(cell);
    }
}

// Change month — -1 previous, +1 next
function changeMonth(dir) {
    currentDate.setMonth(currentDate.getMonth() + dir);
    loadCalendar();
}

// ── EMPLOYEES ──────────────────────────────────────────────────────────────
async function loadUsers() {
    if (!isManager()) return;
    const data = await apiFetch("/users/");
    allUsers = data || [];
}

async function loadEmployees() {
    await loadUsers();
    const tbody = document.getElementById("employees-tbody");
    tbody.innerHTML = "";

    allUsers.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role === "manager" ? "Manager" : "Employee"}</td>
            <td>${user.label
                ? `<span class="label-badge" style="background:${user.label.color}22; color:${user.label.color}">${user.label.name}</span>`
                : "—"
            }</td>
            <td>
                <button class="btn-danger" onclick="deleteEmployee(${user.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadLabels() {
    const data = await apiFetch("/users/labels");
    allLabels = data || [];
}

function openAddEmployeeModal() {
    // Clear form fields
    document.getElementById("emp-name").value = "";
    document.getElementById("emp-email").value = "";
    document.getElementById("emp-password").value = "";

    // Fill label dropdown
    const select = document.getElementById("emp-label");
    select.innerHTML = '<option value="">No label</option>';
    allLabels.forEach(label => {
        select.innerHTML += `<option value="${label.id}">${label.name}</option>`;
    });

    openModal("modal-employee");
}

async function saveEmployee() {
    const name = document.getElementById("emp-name").value;
    const email = document.getElementById("emp-email").value;
    const password = document.getElementById("emp-password").value;
    const label_id = document.getElementById("emp-label").value || null;

    const data = await apiFetch("/users/", "POST", { name, email, password, label_id });

    if (data.error) {
        alert(data.error);
        return;
    }

    closeModal("modal-employee");
    loadEmployees();
}

async function deleteEmployee(id) {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    await apiFetch(`/users/${id}`, "DELETE");
    loadEmployees();
}

// ── SHIFTS ─────────────────────────────────────────────────────────────────
function openAddShiftModal() {
    // Fill employee dropdown
    const select = document.getElementById("shift-user");
    select.innerHTML = "";
    allUsers.filter(u => u.role === "employee").forEach(user => {
        select.innerHTML += `<option value="${user.id}">${user.name}</option>`;
    });

    // Default date — today
    document.getElementById("shift-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("shift-start").value = "08:00";
    document.getElementById("shift-end").value = "16:00";
    document.getElementById("shift-note").value = "";

    openModal("modal-shift");
}

async function saveShift() {
    const data = await apiFetch("/shifts/", "POST", {
        user_id: parseInt(document.getElementById("shift-user").value),
        date: document.getElementById("shift-date").value,
        start_time: document.getElementById("shift-start").value,
        end_time: document.getElementById("shift-end").value,
        note: document.getElementById("shift-note").value,
    });

    if (data.error) {
        alert(data.error);
        return;
    }

    closeModal("modal-shift");
    loadCalendar();
}

// ── REQUESTS ─────────────────────────────────────────────────────────────────
async function loadRequests() {
    const data = await apiFetch("/requests/");
    const requests = data || [];
    const tbody = document.getElementById("requests-tbody");
    tbody.innerHTML = "";

    requests.forEach(req => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${req.user_name}</td>
            <td>${req.type === "urlop" ? "🏖️ Time Off" : "🔄 Shift Swap"}</td>
            <td>${req.date_from}</td>
            <td>${req.date_to}</td>
            <td><span class="status-badge status-${req.status}">
                ${req.status === "pending" ? "Pending" : req.status === "approved" ? "Approved" : "Rejected"}
            </span></td>
            <td>
                ${isManager() && req.status === "pending" ? `
                    <button class="btn-primary" style="width:auto;padding:6px 12px;font-size:13px;margin-right:6px"
                        onclick="updateRequest(${req.id}, 'approved')">✓</button>
                    <button class="btn-danger"
                        onclick="updateRequest(${req.id}, 'rejected')">✗</button>
                ` : "—"}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openAddRequestModal() {
    document.getElementById("req-from").value = "";
    document.getElementById("req-to").value = "";
    document.getElementById("req-message").value = "";
    openModal("modal-request");
}

async function saveRequest() {
    const data = await apiFetch("/requests/", "POST", {
        type: document.getElementById("req-type").value,
        date_from: document.getElementById("req-from").value,
        date_to: document.getElementById("req-to").value,
        message: document.getElementById("req-message").value,
    });

    if (data.error) {
        alert(data.error);
        return;
    }

    closeModal("modal-request");
    loadRequests();
}

async function updateRequest(id, status) {
    await apiFetch(`/requests/${id}`, "PUT", { status });
    loadRequests();
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
async function loadNotifCount() {
    const data = await apiFetch("/notifications/");
    const notifications = data || [];
    // Count unread notifications
    const unread = notifications.filter(n => !n.is_read).length;
    const badge = document.getElementById("notif-count");

    if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = "inline-flex";
    } else {
        badge.style.display = "none";
    }
}

async function loadNotifications() {
    const data = await apiFetch("/notifications/");
    const notifications = data || [];
    const list = document.getElementById("notifications-list");
    list.innerHTML = "";

    if (notifications.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align:center; padding: 24px">No notifications</p>';
        return;
    }

    notifications.forEach(notif => {
        const div = document.createElement("div");
        div.className = `notif-item ${notif.is_read ? "read" : "unread"}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start">
                <span>${notif.is_read ? "" : "🔵 "}${notif.message}</span>
                ${!notif.is_read
                    ? `<button class="btn-secondary" style="padding:4px 10px; font-size:12px; white-space:nowrap; margin-left:12px"
                        onclick="markRead(${notif.id})">Mark Read</button>`
                    : ""
                }
            </div>
            <div class="notif-time">${new Date(notif.created_at).toLocaleString("en-US")}</div>
        `;
        list.appendChild(div);
    });

    // Refresh counter after entering notifications view
    loadNotifCount();
}

async function markRead(id) {
    await apiFetch(`/notifications/${id}/read`, "PUT");
    loadNotifications();
}

// ── STATISTICS ─────────────────────────────────────────────────────────────────
async function loadStats() {
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const data = await apiFetch(`/stats/?month=${month}`);
    const stats = data || [];
    const grid = document.getElementById("stats-grid");
    grid.innerHTML = "";

    stats.forEach(stat => {
        const card = document.createElement("div");
        card.className = "stat-card";
        card.innerHTML = `
            <div class="stat-value">${stat.total_hours}h</div>
            <div class="stat-label">${stat.user_name}</div>
            <div style="font-size:12px; color: var(--text-muted); margin-top:4px">
                ${stat.shifts_count} shifts this month
            </div>
        `;
        grid.appendChild(card);
    });

    if (stats.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted)">No data for this month</p>';
    }
}