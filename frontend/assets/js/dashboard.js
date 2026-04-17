// ── GLOBAL VARIABLES ─────────────────────────────────────────
// Store application state — current month, employee list, etc.
let currentDate = new Date();
let allShifts = [];
let allUsers = [];
let allLabels = [];
let allPositions = [];
let allDepartments = [];
let allNotifications = [];
let allRequests = [];
let currentEditShift = null;
let pendingConfirmAction = null;
let currentDepartment = null;
let calendarRequests = [];

const POSITION_COLORS = [
    "#6C63FF", "#3B82F6", "#06B6D4", "#10B981",
    "#22C55E", "#84CC16", "#EAB308", "#F97316",
    "#EF4444", "#EC4899", "#A855F7", "#14B8A6",
    "#F43F5E", "#64748B", "#94A3B8", "#FF6B6B",
    "#4ECDC4", "#FFE66D", "#C77DFF", "#4CC9F0",
];

function buildColorPicker(pickerId, selectedColor) {
    const picker = document.getElementById(pickerId);
    picker.innerHTML = "";
    POSITION_COLORS.forEach(color => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "color-swatch" + (color === selectedColor ? " selected" : "");
        swatch.style.background = color;
        swatch.title = color;
        swatch.addEventListener("click", () => {
            picker.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
            swatch.classList.add("selected");
            document.getElementById("position-color").value = color;
        });
        picker.appendChild(swatch);
    });
}

// ── CUSTOM NOTIFICATIONS ────────────────────────────────────
// Replace browser alert/confirm with custom modals

function showNotification(title, message, icon = "ℹ️") {
    document.getElementById("notif-icon").textContent = icon;
    document.getElementById("notif-title").textContent = title;
    document.getElementById("notif-message").textContent = message;
    document.getElementById("notif-ok-btn").style.display = "block";
    document.getElementById("notif-cancel-btn").style.display = "none";
    document.getElementById("notif-confirm-btn").style.display = "none";
    pendingConfirmAction = null;
    openModal("modal-notification");
}

function showError(message) {
    showNotification("Error", message, "❌");
}

function showSuccess(message) {
    showNotification("Success", message, "✅");
}

function showConfirm(title, message, onConfirm) {
    document.getElementById("notif-icon").textContent = "⚠️";
    document.getElementById("notif-title").textContent = title;
    document.getElementById("notif-message").textContent = message;
    document.getElementById("notif-ok-btn").style.display = "none";
    document.getElementById("notif-cancel-btn").style.display = "block";
    document.getElementById("notif-confirm-btn").style.display = "block";
    pendingConfirmAction = onConfirm;
    openModal("modal-notification");
}

function closeNotification() {
    closeModal("modal-notification");
    pendingConfirmAction = null;
}

function confirmNotificationAction() {
    if (pendingConfirmAction) {
        const result = pendingConfirmAction();
        // If it's a promise, wait for it
        if (result && typeof result.then === 'function') {
            result.then(() => closeNotification());
        } else {
            closeNotification();
        }
    } else {
        closeNotification();
    }
}

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
    await loadPositions();
    await loadDepartments();
    await loadCalendar();
    await loadNotifCount();
    await loadRequestsBadge();
    await loadAnnouncementsBadge();
});

// ── NAVIGATION BETWEEN VIEWS ───────────────────────────────
// Instead of reloading page, we hide and show appropriate HTML sections
function showView(view) {
    // Hide all views
    document.querySelectorAll("[id^='view-']").forEach(el => el.style.display = "none");
    // Remove active class from all navigation buttons
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    // Remove active class from all page titles
    document.querySelectorAll(".page-title").forEach(el => el.classList.remove("active"));

    // Show selected view
    document.getElementById(`view-${view}`).style.display = "block";
    // Highlight the page title of active view
    const activeView = document.getElementById(`view-${view}`);
    if (activeView) {
        const pageTitle = activeView.querySelector(".page-title");
        if (pageTitle) pageTitle.classList.add("active");
    }
    
    // Highlight the navigation button for current view
    const activeNavBtn = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (activeNavBtn) {
        activeNavBtn.classList.add("active");
    }

    // Load appropriate data for selected view
    if (view === "calendar")      loadCalendar();
    if (view === "employees")     loadEmployees();
    if (view === "positions")     loadPositionsView();
    if (view === "requests")      loadRequests();
    if (view === "announcements") { loadAnnouncements(); markAnnouncementsSeen(); }
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
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const [shiftsData, requestsData] = await Promise.all([
        apiFetch(`/shifts/?month=${month}`),
        apiFetch("/requests/")
    ]);
    allShifts = Array.isArray(shiftsData) ? shiftsData : [];
    calendarRequests = (Array.isArray(requestsData) ? requestsData : [])
        .filter(r => r.type === "urlop" && r.status !== "rejected");
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

        // Find shifts for this day and display them as compact colored chips
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let dayShifts = allShifts.filter(s => s.date === dateStr);
        if (currentDepartment !== null) {
            const deptIds = new Set(allUsers.filter(u => u.department_id === currentDepartment).map(u => u.id));
            dayShifts = dayShifts.filter(s => deptIds.has(s.user_id));
        }

        const MAX_VISIBLE = 3;
        dayShifts.slice(0, MAX_VISIBLE).forEach(shift => {
            const chip = document.createElement("div");
            chip.className = "shift-chip";
            chip.textContent = shift.user_name.split(" ")[0];
            if (shift.position) {
                const c = shift.position.color;
                chip.style.background = c + "22";
                chip.style.borderLeft = `3px solid ${c}`;
                chip.style.color = c;
            }
            cell.appendChild(chip);
        });

        if (dayShifts.length > MAX_VISIBLE) {
            const more = document.createElement("div");
            more.className = "shift-chip-more";
            more.textContent = `+${dayShifts.length - MAX_VISIBLE} more`;
            cell.appendChild(more);
        }

        // Vacation request chips
        const currentUser = getCurrentUser();
        let dayVacations = calendarRequests.filter(r => r.date_from <= dateStr && r.date_to >= dateStr);
        if (!isManager()) {
            dayVacations = dayVacations.filter(r => currentUser && r.user_id === currentUser.id);
        } else if (currentDepartment !== null) {
            const deptIds = new Set(allUsers.filter(u => u.department_id === currentDepartment).map(u => u.id));
            dayVacations = dayVacations.filter(r => deptIds.has(r.user_id));
        }
        dayVacations.forEach(req => {
            const chip = document.createElement("div");
            chip.className = "shift-chip";
            chip.textContent = isManager() ? "\uD83C\uDFD6 " + req.user_name.split(" ")[0] : "\uD83C\uDFD6 Off";
            if (req.status === "pending") {
                chip.style.background = "rgba(245,158,11,0.15)";
                chip.style.borderLeft = "3px solid var(--warning)";
                chip.style.color = "var(--warning)";
            } else {
                chip.style.background = "rgba(34,197,94,0.15)";
                chip.style.borderLeft = "3px solid var(--success)";
                chip.style.color = "var(--success)";
            }
            chip.title = req.status === "pending" ? "Pending time off" : "Approved time off";
            cell.appendChild(chip);
        });

        // Click on day opens detail modal
        if (dayShifts.length > 0 || dayVacations.length > 0 || isManager()) {
            cell.style.cursor = "pointer";
            cell.addEventListener("click", () => openDayModal(dateStr, dayShifts, dayVacations));
        }

        grid.appendChild(cell);
    }
}

// Change month — -1 previous, +1 next
function changeMonth(dir) {
    currentDate.setMonth(currentDate.getMonth() + dir);
    loadCalendar();
}

// ── DAY DETAIL MODAL ───────────────────────────────────────
function openDayModal(dateStr, dayShifts, dayVacations = []) {
    const date = new Date(dateStr + "T00:00:00");
    document.getElementById("day-modal-title").textContent =
        date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const list = document.getElementById("day-modal-list");
    list.innerHTML = "";

    // Vacation rows
    dayVacations.forEach(req => {
        const row = document.createElement("div");
        row.className = "day-shift-row";
        const color = req.status === "pending" ? "var(--warning)" : "var(--success)";
        const statusLabel = req.status === "pending" ? "Pending" : "Approved";
        row.innerHTML = `
            <div class="day-shift-left">
                <div class="day-shift-indicator" style="background:${color}"></div>
                <div>
                    <div class="day-shift-name">${req.user_name}</div>
                    <div class="day-shift-time">\uD83C\uDFD6 Time off &nbsp;<span class="day-pos-badge" style="background:${color}22;color:${color};border-color:${color}44">${statusLabel}</span></div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });

    if (dayShifts.length === 0 && dayVacations.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:24px 0">No shifts scheduled</p>';
    } else {
        dayShifts.forEach(shift => {
            const row = document.createElement("div");
            row.className = "day-shift-row";

            const posHtml = shift.position
                ? `<span class="day-pos-badge" style="background:${shift.position.color}22; color:${shift.position.color}; border-color:${shift.position.color}44">${shift.position.name}</span>`
                : "";
            const noteHtml = shift.note
                ? `<span class="day-shift-note">${shift.note}</span>`
                : "";

            row.innerHTML = `
                <div class="day-shift-left">
                    <div class="day-shift-indicator" style="background:${shift.position ? shift.position.color : "var(--accent)"}"></div>
                    <div>
                        <div class="day-shift-name">${shift.user_name}</div>
                        <div class="day-shift-time">${shift.start_time} – ${shift.end_time} ${posHtml} ${noteHtml}</div>
                    </div>
                </div>
                ${isManager() ? `<button type="button" class="btn-secondary" style="padding:5px 12px;font-size:12px;flex-shrink:0" onclick="openEditShiftFromDay(${shift.id})">Edit</button>` : ""}
            `;
            list.appendChild(row);
        });
    }

    const addBtn = document.getElementById("day-modal-add-btn");
    if (isManager()) {
        addBtn.style.display = "inline-block";
        addBtn.onclick = () => { closeModal("modal-day"); openAddShiftModal(dateStr); };
    } else {
        addBtn.style.display = "none";
    }

    openModal("modal-day");
}

function openEditShiftFromDay(shiftId) {
    closeModal("modal-day");
    const shift = allShifts.find(s => s.id === shiftId);
    if (shift) openEditShiftModal(shift);
}

// ── EMPLOYEES ──────────────────────────────────────────────────────────────
async function loadUsers() {
    if (!isManager()) return;
    const data = await apiFetch("/users/");
    allUsers = Array.isArray(data) ? data : [];
}

async function loadEmployees() {
    await loadUsers();
    loadJobRolesSection();
    loadDepartmentsSection();
    const tbody = document.getElementById("employees-tbody");
    tbody.innerHTML = "";

    allUsers.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${user.role === "manager" ? "Manager" : "Employee"}</td>
            <td>${user.label
                ? `<span class="label-badge" style="background:${user.label.color}22; color:${user.label.color}">${user.label.name}</span>`
                : "—"
            }</td>
            <td style="display:flex; gap:6px;">
                <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:13px" onclick="openEditEmployeeModal(${user.id})">Edit</button>
                <button type="button" class="btn-danger" onclick="deleteEmployee(${user.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadLabels() {
    const data = await apiFetch("/users/labels");
    allLabels = Array.isArray(data) ? data : [];
}

function openAddEmployeeModal() {
    document.getElementById("emp-name").value = "";
    document.getElementById("emp-email").value = "";
    document.getElementById("emp-password").value = "";

    const deptSelect = document.getElementById("emp-department");
    deptSelect.innerHTML = '<option value="">No department</option>';
    allDepartments.forEach(d => {
        deptSelect.innerHTML += `<option value="${d.id}">${d.name}</option>`;
    });

    const labelSelect = document.getElementById("emp-label");
    labelSelect.innerHTML = '<option value="">No role</option>';
    allLabels.forEach(label => {
        labelSelect.innerHTML += `<option value="${label.id}">${label.name}</option>`;
    });

    openModal("modal-employee");
}

async function saveEmployee() {
    const name = document.getElementById("emp-name").value;
    const email = document.getElementById("emp-email").value;
    const password = document.getElementById("emp-password").value;
    const label_id = document.getElementById("emp-label").value || null;
    const department_id = document.getElementById("emp-department").value
        ? parseInt(document.getElementById("emp-department").value) : null;

    const data = await apiFetch("/users/", "POST", { name, email, password, label_id, department_id });

    if (data.error) {
        showError(data.error);
        return;
    }

    closeModal("modal-employee");
    loadEmployees();
}

async function deleteEmployee(id) {
    if (!isManager()) return;
    
    showConfirm("Delete Employee", "Are you sure you want to delete this employee?", async () => {
        await apiFetch(`/users/${id}`, "DELETE");
        loadEmployees();
    });
}

// ── SHIFTS ─────────────────────────────────────────────────────────────────
function openAddShiftModal(dateStr = null) {
    // Fill employee dropdown
    const select = document.getElementById("shift-user");
    select.innerHTML = "";
    allUsers.filter(u => u.role === "employee").forEach(user => {
        select.innerHTML += `<option value="${user.id}">${user.name}</option>`;
    });

    document.getElementById("shift-date").value = dateStr || new Date().toISOString().split("T")[0];
    document.getElementById("shift-start").value = "08:00";
    document.getElementById("shift-end").value = "16:00";
    document.getElementById("shift-note").value = "";
    populatePositionSelect("shift-position", null);

    openModal("modal-shift");
}

// Wrapper function for clicking on calendar day
function openAddShiftModalForDate(dateStr) {
    openAddShiftModal(dateStr);
}

async function saveShift() {
    const user_id = parseInt(document.getElementById("shift-user").value);
    const date = document.getElementById("shift-date").value;
    const start_time = document.getElementById("shift-start").value;
    const end_time = document.getElementById("shift-end").value;
    const note = document.getElementById("shift-note").value;

    // Validate that start_time < end_time
    if (start_time >= end_time) {
        showError("Invalid Time", "Start time must be before end time");
        return;
    }

    // Check for overlapping shifts for the same employee on the same day
    const conflictingShift = allShifts.find(shift => 
        shift.user_id === user_id && 
        shift.date === date &&
        // Check if times overlap:
        // Overlap occurs if: start_time < other.end_time AND end_time > other.start_time
        start_time < shift.end_time && 
        end_time > shift.start_time
    );

    if (conflictingShift) {
        showError(
            "Scheduling Conflict",
            `This employee already has a shift from ${conflictingShift.start_time} to ${conflictingShift.end_time} on this date`
        );
        return;
    }

    const position_id = document.getElementById("shift-position").value
        ? parseInt(document.getElementById("shift-position").value)
        : null;

    const data = await apiFetch("/shifts/", "POST", {
        user_id,
        date,
        start_time,
        end_time,
        note,
        position_id,
    });

    if (data.error) {
        showError(data.error);
        return;
    }

    closeModal("modal-shift");
    loadCalendar();
}

// ── EDIT SHIFT ──────────────────────────────────────────────
function openEditShiftModal(shift) {
    if (!isManager()) return;
    
    currentEditShift = shift;
    document.getElementById("edit-shift-user").value = shift.user_name;
    document.getElementById("edit-shift-date").value = shift.date;
    document.getElementById("edit-shift-start").value = shift.start_time;
    document.getElementById("edit-shift-end").value = shift.end_time;
    document.getElementById("edit-shift-note").value = shift.note || "";
    populatePositionSelect("edit-shift-position", shift.position_id);

    openModal("modal-edit-shift");
}

async function updateShift() {
    if (!currentEditShift) return;
    
    const date = document.getElementById("edit-shift-date").value;
    const start_time = document.getElementById("edit-shift-start").value;
    const end_time = document.getElementById("edit-shift-end").value;
    const note = document.getElementById("edit-shift-note").value;

    // Validate that start_time < end_time
    if (start_time >= end_time) {
        showError("Invalid Time", "Start time must be before end time");
        return;
    }

    // Check for overlapping shifts (excluding current shift being edited)
    const conflictingShift = allShifts.find(shift => 
        shift.id !== currentEditShift.id &&  // Don't compare with itself
        shift.user_id === currentEditShift.user_id && 
        shift.date === date &&
        // Check if times overlap
        start_time < shift.end_time && 
        end_time > shift.start_time
    );

    if (conflictingShift) {
        showError(
            "Scheduling Conflict",
            `This employee already has a shift from ${conflictingShift.start_time} to ${conflictingShift.end_time} on this date`
        );
        return;
    }
    
    const position_id = document.getElementById("edit-shift-position").value
        ? parseInt(document.getElementById("edit-shift-position").value)
        : null;

    const data = await apiFetch(`/shifts/${currentEditShift.id}`, "PUT", {
        date,
        start_time,
        end_time,
        note,
        position_id,
    });
    
    if (data.error) {
        showError(data.error);
        return;
    }
    
    closeModal("modal-edit-shift");
    currentEditShift = null;
    loadCalendar();
}

async function deleteShift() {
    if (!currentEditShift) return;
    
    showConfirm("Delete Shift", "Are you sure you want to delete this shift?", async () => {
        const data = await apiFetch(`/shifts/${currentEditShift.id}`, "DELETE");
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        closeModal("modal-edit-shift");
        currentEditShift = null;
        loadCalendar();
    });
}

// ── REQUESTS ─────────────────────────────────────────────────────────────────
async function loadRequests() {
    const data = await apiFetch("/requests/");
    const requests = Array.isArray(data) ? data : [];
    allRequests = requests;
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
            <td style="display:flex; gap:6px; align-items:center;">
                <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:13px"
                    onclick="openRequestDetail(${req.id})">Details</button>
                ${isManager() && req.status === "pending" ? `
                    <button type="button" class="btn-primary" style="width:auto;padding:6px 12px;font-size:13px"
                        onclick="updateRequest(${req.id}, 'approved')">✓</button>
                    <button type="button" class="btn-danger"
                        onclick="updateRequest(${req.id}, 'rejected')">✗</button>
                ` : ""}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openRequestDetail(reqId) {
    const req = allRequests.find(r => r.id === reqId);
    if (!req) return;

    const typeText = req.type === "urlop" ? "🏖️ Time Off" : "🔄 Shift Swap";
    const statusMap = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

    document.getElementById("request-detail-content").innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:8px;">
            <div class="req-detail-row">
                <span class="req-detail-label">Employee</span>
                <span>${req.user_name}</span>
            </div>
            <div class="req-detail-row">
                <span class="req-detail-label">Type</span>
                <span>${typeText}</span>
            </div>
            <div class="req-detail-row">
                <span class="req-detail-label">Period</span>
                <span>${req.date_from} → ${req.date_to}</span>
            </div>
            <div class="req-detail-row">
                <span class="req-detail-label">Status</span>
                <span class="status-badge status-${req.status}">${statusMap[req.status]}</span>
            </div>
            <div class="req-detail-row" style="align-items:flex-start">
                <span class="req-detail-label">Reason</span>
                <span style="white-space:pre-wrap; line-height:1.6">${req.message || "—"}</span>
            </div>
        </div>
    `;

    const actions = document.getElementById("request-detail-actions");
    if (isManager() && req.status === "pending") {
        actions.innerHTML = "";
        const approveBtn = document.createElement("button");
        approveBtn.type = "button";
        approveBtn.className = "btn-primary";
        approveBtn.style.cssText = "width:auto; padding:8px 16px;";
        approveBtn.textContent = "✓ Approve";
        approveBtn.addEventListener("click", () => { updateRequest(req.id, "approved"); closeModal("modal-request-detail"); });

        const rejectBtn = document.createElement("button");
        rejectBtn.type = "button";
        rejectBtn.className = "btn-danger";
        rejectBtn.style.cssText = "padding:8px 16px;";
        rejectBtn.textContent = "✗ Reject";
        rejectBtn.addEventListener("click", () => { updateRequest(req.id, "rejected"); closeModal("modal-request-detail"); });

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
    } else {
        actions.innerHTML = "";
    }

    openModal("modal-request-detail");
}

function openAddRequestModal() {
    document.getElementById("req-from").value = "";
    document.getElementById("req-to").value = "";
    document.getElementById("req-message").value = "";
    openModal("modal-request");
}

async function saveRequest() {
    const date_from = document.getElementById("req-from").value;
    const date_to   = document.getElementById("req-to").value;
    const message   = document.getElementById("req-message").value.trim();

    if (!date_from || !date_to) {
        showError("Please select both From and To dates.");
        return;
    }
    if (date_to < date_from) {
        showError("End date cannot be before start date.");
        return;
    }
    if (!message) {
        showError("Please provide a reason for your request.");
        return;
    }

    const data = await apiFetch("/requests/", "POST", {
        type: document.getElementById("req-type").value,
        date_from,
        date_to,
        message,
    });

    if (data.error) {
        showError(data.error);
        return;
    }

    closeModal("modal-request");
    loadRequests();
}

async function updateRequest(id, status) {
    await apiFetch(`/requests/${id}`, "PUT", { status });
    loadRequests();
    loadRequestsBadge();
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
async function loadNotifCount() {
    const data = await apiFetch("/notifications/");
    const notifications = data || [];
    const unread = notifications.filter(n => !n.is_read).length;
    const badge = document.getElementById("notif-count");
    if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = "inline-flex";
    } else {
        badge.style.display = "none";
    }
}

async function loadRequestsBadge() {
    if (!isManager()) return;
    const data = await apiFetch("/requests/");
    const pending = (Array.isArray(data) ? data : []).filter(r => r.status === "pending").length;
    const badge = document.getElementById("requests-badge");
    if (pending > 0) {
        badge.textContent = pending;
        badge.style.display = "inline-flex";
    } else {
        badge.style.display = "none";
    }
}

async function loadNotifications() {
    const data = await apiFetch("/notifications/");
    const notifications = data || [];
    allNotifications = notifications;
    const list = document.getElementById("notifications-list");
    list.innerHTML = "";

    const markAllButton = document.getElementById("mark-all-read-btn");
    const unreadCount = notifications.filter(n => !n.is_read).length;
    markAllButton.style.display = unreadCount > 0 ? "block" : "none";
    markAllButton.removeEventListener("click", markAllReadHandler);
    markAllButton.addEventListener("click", markAllReadHandler);

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
                    ? `<button type="button" class="btn-secondary" style="padding:4px 10px; font-size:12px; white-space:nowrap; margin-left:12px" data-notif-id="${notif.id}">Mark Read</button>`
                    : ""}
            </div>
            <div class="notif-time">${new Date(notif.created_at).toLocaleString("en-US")}</div>
        `;
        const markBtn = div.querySelector("[data-notif-id]");
        if (markBtn) {
            markBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                markRead(notif.id);
            });
        }
        list.appendChild(div);
    });
}

async function markAllReadHandler(event) {
    event.stopPropagation();
    event.preventDefault();

    const unreadCount = allNotifications.filter(n => !n.is_read).length;
    if (unreadCount === 0) return;

    await apiFetch("/notifications/read-all", "PUT");
    loadNotifications();
    loadNotifCount();
}

async function markRead(id) {
    await apiFetch(`/notifications/${id}/read`, "PUT");
    loadNotifications();
    loadNotifCount();
}

async function markAllRead(event) {
    if (event) event.stopPropagation();
    
    const unreadCount = allNotifications.filter(n => !n.is_read).length;
    if (unreadCount === 0) {
        return;
    }
    
    await apiFetch("/notifications/read-all", "PUT");
    loadNotifications();
}

// ── EDIT EMPLOYEE ──────────────────────────────────────────────────────────────
function openEditEmployeeModal(id) {
    const user = allUsers.find(u => u.id === id);
    if (!user) return;

    document.getElementById("edit-emp-id").value = user.id;
    document.getElementById("edit-emp-name").value = user.name;
    document.getElementById("edit-emp-role").value = user.role;

    const deptSelect = document.getElementById("edit-emp-department");
    deptSelect.innerHTML = '<option value="">No department</option>';
    allDepartments.forEach(d => {
        deptSelect.innerHTML += `<option value="${d.id}" ${user.department_id === d.id ? "selected" : ""}>${d.name}</option>`;
    });

    const select = document.getElementById("edit-emp-label");
    select.innerHTML = '<option value="">No role</option>';
    allLabels.forEach(label => {
        select.innerHTML += `<option value="${label.id}" ${user.label && user.label.id === label.id ? "selected" : ""}>${label.name}</option>`;
    });

    openModal("modal-edit-employee");
}

async function saveEditEmployee() {
    const id = document.getElementById("edit-emp-id").value;
    const name = document.getElementById("edit-emp-name").value.trim();
    const role = document.getElementById("edit-emp-role").value;
    const label_id = document.getElementById("edit-emp-label").value || null;

    if (!name) { showError("Name cannot be empty."); return; }

    const department_id = document.getElementById("edit-emp-department").value
        ? parseInt(document.getElementById("edit-emp-department").value) : null;

    const data = await apiFetch(`/users/${id}`, "PUT", { name, role, label_id, department_id });
    if (data.error) { showError(data.error); return; }

    closeModal("modal-edit-employee");
    loadEmployees();
}

// ── JOB ROLES (labels) ─────────────────────────────────────────────────────────

function loadJobRolesSection() {
    const container = document.getElementById("job-roles-list");
    if (!container) return;
    container.innerHTML = "";

    if (allLabels.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:16px 0">No job roles yet</p>';
        return;
    }

    allLabels.forEach(label => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);";
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="width:14px; height:14px; border-radius:50%; background:${label.color}; display:inline-block; flex-shrink:0;"></span>
                <span class="label-badge" style="background:${label.color}22; color:${label.color}">${label.name}</span>
            </div>
            <button type="button" class="btn-danger" style="padding:4px 10px; font-size:12px" onclick="deleteLabel(${label.id})">Delete</button>
        `;
        container.appendChild(row);
    });
}

function openAddLabelModal() {
    document.getElementById("label-name").value = "";
    document.getElementById("label-color").value = "#3B82F6";
    buildColorPicker("label-color-picker", "#3B82F6");
    openModal("modal-label");
}

async function saveLabel() {
    const name = document.getElementById("label-name").value.trim();
    const color = document.getElementById("label-color").value;

    if (!name) { showError("Role name cannot be empty."); return; }

    const data = await apiFetch("/users/labels", "POST", { name, color });
    if (data && data.error) { showError(data.error); return; }

    closeModal("modal-label");
    await loadLabels();
    loadJobRolesSection();
    loadEmployees();
}

async function deleteLabel(id) {
    showConfirm("Delete Job Role", "Employees with this role will have it removed.", async () => {
        const data = await apiFetch(`/users/labels/${id}`, "DELETE");
        if (data && data.error) { showError(data.error); return; }
        await loadLabels();
        loadJobRolesSection();
        loadEmployees();
    });
}

// ── DEPARTMENTS ────────────────────────────────────────────────────────────────

async function loadDepartments() {
    const data = await apiFetch("/departments/");
    allDepartments = Array.isArray(data) ? data : [];
    renderDepartmentTabs();
}

function renderDepartmentTabs() {
    const container = document.getElementById("dept-tabs");
    if (!container) return;

    if (!isManager() || allDepartments.length < 2) {
        container.innerHTML = "";
        container.style.display = "none";
        currentDepartment = null;
        return;
    }

    container.style.display = "flex";
    container.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "dept-tab" + (currentDepartment === null ? " active" : "");
    allBtn.textContent = "All";
    allBtn.addEventListener("click", () => selectDepartment(null));
    container.appendChild(allBtn);

    allDepartments.forEach(dept => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dept-tab" + (currentDepartment === dept.id ? " active" : "");
        btn.textContent = dept.name;
        btn.addEventListener("click", () => selectDepartment(dept.id));
        container.appendChild(btn);
    });
}

function selectDepartment(deptId) {
    currentDepartment = deptId;
    renderDepartmentTabs();
    renderCalendar();
}

function loadDepartmentsSection() {
    const container = document.getElementById("departments-list");
    if (!container) return;
    container.innerHTML = "";

    if (allDepartments.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:13px; padding:4px 0 12px">No departments yet</p>';
        return;
    }

    allDepartments.forEach(dept => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:1px solid var(--border);";
        row.innerHTML = `
            <span style="font-size:14px; font-weight:500;">${dept.name}</span>
            <button type="button" class="btn-danger" style="padding:4px 10px; font-size:12px" onclick="deleteDepartment(${dept.id})">Delete</button>
        `;
        container.appendChild(row);
    });
}

async function saveDepartment() {
    const input = document.getElementById("new-dept-name");
    const name = input.value.trim();
    if (!name) { showError("Department name cannot be empty."); return; }

    const data = await apiFetch("/departments/", "POST", { name });
    if (data && data.error) { showError(data.error); return; }

    input.value = "";
    await loadDepartments();
    loadDepartmentsSection();
    loadEmployees();
}

async function deleteDepartment(id) {
    showConfirm("Delete Department", "Employees in this department will be unassigned.", async () => {
        const data = await apiFetch(`/departments/${id}`, "DELETE");
        if (data && data.error) { showError(data.error); return; }
        await loadDepartments();
        loadDepartmentsSection();
        loadEmployees();
    });
}

// ── POSITIONS ──────────────────────────────────────────────────────────────────
async function loadPositions() {
    const data = await apiFetch("/positions/");
    allPositions = Array.isArray(data) ? data : [];
}

function populatePositionSelect(selectId, selectedId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">— No position —</option>';
    allPositions.forEach(pos => {
        const opt = document.createElement("option");
        opt.value = pos.id;
        opt.textContent = pos.name;
        if (selectedId && pos.id === selectedId) opt.selected = true;
        select.appendChild(opt);
    });
}

async function loadPositionsView() {
    await loadPositions();
    const tbody = document.getElementById("positions-tbody");
    tbody.innerHTML = "";

    if (allPositions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:24px">No positions yet</td></tr>';
        return;
    }

    allPositions.forEach(pos => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${pos.name}</strong></td>
            <td>
                <span style="width:24px; height:24px; border-radius:6px; background:${pos.color}; display:inline-block; border:1px solid rgba(0,0,0,.2);"></span>
            </td>
            <td style="display:flex; gap:6px;">
                <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:13px" onclick="openEditPositionModal(${pos.id})">Edit</button>
                <button type="button" class="btn-danger" onclick="deletePosition(${pos.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openAddPositionModal() {
    document.getElementById("position-id").value = "";
    document.getElementById("position-name").value = "";
    document.getElementById("position-color").value = "#6C63FF";
    document.getElementById("position-modal-title").textContent = "Add Position";
    buildColorPicker("position-color-picker", "#6C63FF");
    openModal("modal-position");
}

function openEditPositionModal(id) {
    const pos = allPositions.find(p => p.id === id);
    if (!pos) return;
    document.getElementById("position-id").value = pos.id;
    document.getElementById("position-name").value = pos.name;
    document.getElementById("position-color").value = pos.color;
    document.getElementById("position-modal-title").textContent = "Edit Position";
    buildColorPicker("position-color-picker", pos.color);
    openModal("modal-position");
}

async function savePosition() {
    const id = document.getElementById("position-id").value;
    const name = document.getElementById("position-name").value.trim();
    const color = document.getElementById("position-color").value;

    if (!name) { showError("Position name cannot be empty."); return; }

    let data;
    if (id) {
        data = await apiFetch(`/positions/${id}`, "PUT", { name, color });
    } else {
        data = await apiFetch("/positions/", "POST", { name, color });
    }

    if (data && data.error) { showError(data.error); return; }

    closeModal("modal-position");
    await loadPositions();
    loadPositionsView();
}

async function deletePosition(id) {
    showConfirm("Delete Position", "Are you sure? Shifts using this position will have it removed.", async () => {
        const data = await apiFetch(`/positions/${id}`, "DELETE");
        if (data && data.error) { showError(data.error); return; }
        await loadPositions();
        loadPositionsView();
        loadCalendar();
    });
}

// ── ANNOUNCEMENTS ──────────────────────────────────────────────────────────────

async function loadAnnouncements() {
    const data = await apiFetch("/announcements/");
    const items = Array.isArray(data) ? data : [];
    const list = document.getElementById("announcements-list");
    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = '<div class="card"><p style="color:var(--text-muted); text-align:center; padding:32px 0">No announcements yet</p></div>';
        return;
    }

    items.forEach(ann => {
        const card = document.createElement("div");
        card.className = "announcement-card";

        const deptBadge = ann.department
            ? `<span class="label-badge" style="background:rgba(108,99,255,.15); color:var(--accent)">${ann.department.name}</span>`
            : `<span class="label-badge" style="background:rgba(108,99,255,.15); color:var(--accent)">All Departments</span>`;

        const date = new Date(ann.created_at).toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric"
        });

        card.innerHTML = `
            <div class="announcement-header">
                <h3 class="announcement-title">📢 ${ann.title}</h3>
                ${isManager() ? `
                    <div style="display:flex; gap:8px; flex-shrink:0">
                        <button type="button" class="btn-secondary" style="padding:5px 12px;font-size:12px" onclick="showReaders(${ann.id})">
                            👁 Seen by ${ann.readers_count}
                        </button>
                        <button type="button" class="btn-danger" style="padding:5px 12px;font-size:12px" onclick="deleteAnnouncement(${ann.id})">Delete</button>
                    </div>` : ""}
            </div>
            <p class="announcement-content">${ann.content}</p>
            <div class="announcement-footer">
                <span>${ann.author_name} · ${date}</span>
                ${deptBadge}
            </div>
        `;
        list.appendChild(card);
    });
}

function openAddAnnouncementModal() {
    document.getElementById("ann-title").value = "";
    document.getElementById("ann-content").value = "";

    const select = document.getElementById("ann-department");
    select.innerHTML = '<option value="">All Departments</option>';
    allDepartments.forEach(d => {
        select.innerHTML += `<option value="${d.id}">${d.name}</option>`;
    });

    openModal("modal-announcement");
}

async function saveAnnouncement() {
    const title   = document.getElementById("ann-title").value.trim();
    const content = document.getElementById("ann-content").value.trim();
    const department_id = document.getElementById("ann-department").value
        ? parseInt(document.getElementById("ann-department").value) : null;

    if (!title)   { showError("Title cannot be empty."); return; }
    if (!content) { showError("Content cannot be empty."); return; }

    const data = await apiFetch("/announcements/", "POST", { title, content, department_id });
    if (data && data.error) { showError(data.error); return; }

    closeModal("modal-announcement");
    loadAnnouncements();
}

async function loadAnnouncementsBadge() {
    const data = await apiFetch("/announcements/");
    const items = Array.isArray(data) ? data : [];
    const user = getCurrentUser();
    const lastSeen = localStorage.getItem(`ann_seen_${user.id}`) || "1970-01-01T00:00:00";
    const newCount = items.filter(a => new Date(a.created_at) > new Date(lastSeen)).length;
    const badge = document.getElementById("announcements-badge");
    if (newCount > 0) {
        badge.textContent = newCount;
        badge.style.display = "inline-flex";
    } else {
        badge.style.display = "none";
    }
}

function markAnnouncementsSeen() {
    const user = getCurrentUser();
    localStorage.setItem(`ann_seen_${user.id}`, new Date().toISOString());
    document.getElementById("announcements-badge").style.display = "none";
    apiFetch("/announcements/mark-seen", "POST");
}

async function showReaders(annId) {
    const data = await apiFetch(`/announcements/${annId}/readers`);
    const readers = Array.isArray(data) ? data : [];
    const list = document.getElementById("readers-list");

    if (readers.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:24px 0">Nobody has read this yet</p>';
    } else {
        list.innerHTML = readers.map(r => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:14px;">
                <span style="font-weight:500">${r.user_name}</span>
                <span style="font-size:12px; color:var(--text-muted)">${new Date(r.read_at).toLocaleString("en-US")}</span>
            </div>
        `).join("");
    }

    openModal("modal-readers");
}

async function deleteAnnouncement(id) {
    showConfirm("Delete Announcement", "Are you sure you want to delete this announcement?", async () => {
        const data = await apiFetch(`/announcements/${id}`, "DELETE");
        if (data && data.error) { showError(data.error); return; }
        loadAnnouncements();
    });
}

// ── DATEPICKER ─────────────────────────────────────────────────────────────────
let dpState = { fieldId: null, year: 0, month: 0 };

function openDatepicker(fieldId, triggerEl) {
    const popup = document.getElementById("datepicker-popup");

    if (dpState.fieldId === fieldId && popup.classList.contains("active")) {
        closeDatepicker();
        return;
    }

    dpState.fieldId = fieldId;

    const val = document.getElementById(fieldId).value;
    const d = (val && /^\d{4}-\d{2}-\d{2}$/.test(val))
        ? new Date(val + "T00:00:00")
        : new Date();
    dpState.year = d.getFullYear();
    dpState.month = d.getMonth();

    dpRender();
    popup.classList.add("active");

    const wrap = triggerEl.closest(".dp-input-wrap") || triggerEl;
    const rect = wrap.getBoundingClientRect();
    popup.style.top = (rect.bottom + 6) + "px";
    popup.style.left = rect.left + "px";

    requestAnimationFrame(() => {
        const pr = popup.getBoundingClientRect();
        if (pr.right > window.innerWidth - 8)
            popup.style.left = (rect.right - pr.width) + "px";
    });
}

function closeDatepicker() {
    document.getElementById("datepicker-popup").classList.remove("active");
    dpState.fieldId = null;
}

function dpNavigate(dir) {
    dpState.month += dir;
    if (dpState.month > 11) { dpState.month = 0; dpState.year++; }
    if (dpState.month < 0)  { dpState.month = 11; dpState.year--; }
    dpRender();
}

function dpRender() {
    const { year, month, fieldId } = dpState;

    document.getElementById("dp-month-title").textContent =
        new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const container = document.getElementById("dp-days");
    container.innerHTML = "";

    const today = new Date();
    const selectedVal = fieldId ? document.getElementById(fieldId).value : "";

    let startDow = new Date(year, month, 1).getDay() - 1;
    if (startDow < 0) startDow = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    for (let i = startDow - 1; i >= 0; i--) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dp-day other-month";
        btn.textContent = daysInPrev - i;
        container.appendChild(btn);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dp-day";
        btn.textContent = d;
        if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === d)
            btn.classList.add("today");
        if (selectedVal === dateStr)
            btn.classList.add("selected");
        btn.addEventListener("click", () => dpSelect(dateStr));
        container.appendChild(btn);
    }

    const totalCells = startDow + daysInMonth;
    const fillers = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= fillers; d++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dp-day other-month";
        btn.textContent = d;
        container.appendChild(btn);
    }
}

function dpSelect(dateStr) {
    if (dpState.fieldId)
        document.getElementById(dpState.fieldId).value = dateStr;
    closeDatepicker();
}

document.addEventListener("click", (e) => {
    const popup = document.getElementById("datepicker-popup");
    if (popup && popup.classList.contains("active")) {
        if (!popup.contains(e.target) && !e.target.closest(".dp-input-wrap"))
            closeDatepicker();
    }
});

// ── TIMEPICKER ─────────────────────────────────────────────────────────────────
let tpState = { fieldId: null, hour: 8, minute: 0 };

function openTimepicker(fieldId, triggerEl) {
    const popup = document.getElementById("timepicker-popup");

    if (tpState.fieldId === fieldId && popup.classList.contains("active")) {
        closeTimepicker();
        return;
    }

    tpState.fieldId = fieldId;

    const val = document.getElementById(fieldId).value;
    if (val && /^\d{2}:\d{2}$/.test(val)) {
        tpState.hour   = parseInt(val.split(":")[0]);
        tpState.minute = parseInt(val.split(":")[1]);
    } else {
        tpState.hour   = 8;
        tpState.minute = 0;
    }

    tpRender();
    popup.classList.add("active");

    const wrap = triggerEl.closest(".dp-input-wrap") || triggerEl;
    const rect = wrap.getBoundingClientRect();
    popup.style.top  = (rect.bottom + 6) + "px";
    popup.style.left = rect.left + "px";

    requestAnimationFrame(() => {
        const pr = popup.getBoundingClientRect();
        if (pr.right > window.innerWidth - 8)
            popup.style.left = (rect.right - pr.width) + "px";
        if (pr.bottom > window.innerHeight - 8)
            popup.style.top = (rect.top - pr.height - 6) + "px";
    });
}

function closeTimepicker() {
    document.getElementById("timepicker-popup").classList.remove("active");
    tpState.fieldId = null;
}

function tpRender() {
    const { hour, minute } = tpState;
    document.getElementById("tp-display").textContent =
        String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");

    const hoursEl = document.getElementById("tp-hours");
    hoursEl.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tp-cell" + (h === hour ? " selected" : "");
        btn.textContent = String(h).padStart(2, "0");
        btn.addEventListener("click", (e) => { e.stopPropagation(); tpState.hour = h; tpRender(); });
        hoursEl.appendChild(btn);
    }

    const minsEl = document.getElementById("tp-mins");
    minsEl.innerHTML = "";
    for (let m = 0; m < 60; m += 5) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tp-cell" + (m === minute ? " selected" : "");
        btn.textContent = String(m).padStart(2, "0");
        btn.addEventListener("click", () => {
            tpState.minute = m;
            if (tpState.fieldId) {
                document.getElementById(tpState.fieldId).value =
                    String(tpState.hour).padStart(2, "0") + ":" + String(m).padStart(2, "0");
            }
            closeTimepicker();
        });
        minsEl.appendChild(btn);
    }
}

document.addEventListener("click", (e) => {
    const tp = document.getElementById("timepicker-popup");
    if (tp && tp.classList.contains("active")) {
        if (!tp.contains(e.target) && !e.target.closest(".dp-input-wrap"))
            closeTimepicker();
    }
});

// ── EMPLOYEE SCHEDULE MODAL ────────────────────────────────────────────────────
let empSchedState = { userId: null, userName: "", year: 0, month: 0, shifts: [], vacations: [] };

async function openEmployeeSchedule(userId, userName) {
    empSchedState.userId = userId;
    empSchedState.userName = userName;
    empSchedState.year  = currentDate.getFullYear();
    empSchedState.month = currentDate.getMonth();
    document.getElementById("emp-sched-title").textContent = userName;
    await loadEmpSchedShifts();
    openModal("modal-employee-schedule");
}

async function loadEmpSchedShifts() {
    const month = `${empSchedState.year}-${String(empSchedState.month + 1).padStart(2, "0")}`;
    const [shiftsData, requestsData] = await Promise.all([
        apiFetch(`/shifts/?month=${month}`),
        apiFetch("/requests/")
    ]);
    const allS = Array.isArray(shiftsData) ? shiftsData : [];
    empSchedState.shifts = allS.filter(s => s.user_id === empSchedState.userId);
    empSchedState.vacations = (Array.isArray(requestsData) ? requestsData : [])
        .filter(r => r.user_id === empSchedState.userId && r.type === "urlop" && r.status !== "rejected");
    renderEmpSchedCalendar();
}

async function empSchedChangeMonth(dir) {
    empSchedState.month += dir;
    if (empSchedState.month > 11) { empSchedState.month = 0; empSchedState.year++; }
    if (empSchedState.month < 0)  { empSchedState.month = 11; empSchedState.year--; }
    await loadEmpSchedShifts();
}

function renderEmpSchedCalendar() {
    const { year, month, shifts } = empSchedState;

    document.getElementById("emp-sched-month-title").textContent =
        new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const grid = document.getElementById("emp-sched-grid");
    grid.innerHTML = "";

    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d => {
        const h = document.createElement("div");
        h.className = "calendar-day-header";
        h.textContent = d;
        grid.appendChild(h);
    });

    let startDow = new Date(year, month, 1).getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < startDow; i++) {
        const e = document.createElement("div");
        e.className = "calendar-day other-month";
        grid.appendChild(e);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate())
            cell.classList.add("today");

        const dayNum = document.createElement("div");
        dayNum.className = "day-number";
        dayNum.textContent = day;
        cell.appendChild(dayNum);

        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        shifts.filter(s => s.date === dateStr).forEach(shift => {
            const chip = document.createElement("div");
            chip.className = "shift-chip";
            chip.textContent = `${shift.start_time}–${shift.end_time}`;
            if (shift.position) {
                const c = shift.position.color;
                chip.style.background = c + "22";
                chip.style.borderLeft = `3px solid ${c}`;
                chip.style.color = c;
                chip.title = shift.position.name + (shift.note ? " · " + shift.note : "");
            } else if (shift.note) {
                chip.title = shift.note;
            }
            cell.appendChild(chip);
        });

        empSchedState.vacations.filter(r => r.date_from <= dateStr && r.date_to >= dateStr).forEach(req => {
            const chip = document.createElement("div");
            chip.className = "shift-chip";
            chip.textContent = "\uD83C\uDFD6 Off";
            if (req.status === "pending") {
                chip.style.background = "rgba(245,158,11,0.15)";
                chip.style.borderLeft = "3px solid var(--warning)";
                chip.style.color = "var(--warning)";
                chip.title = "Pending time off";
            } else {
                chip.style.background = "rgba(34,197,94,0.15)";
                chip.style.borderLeft = "3px solid var(--success)";
                chip.style.color = "var(--success)";
                chip.title = "Approved time off";
            }
            cell.appendChild(chip);
        });

        grid.appendChild(cell);
    }
}

// ── STATISTICS ─────────────────────────────────────────────────────────────────
async function loadStats() {
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const data = await apiFetch(`/stats/?month=${month}`);
    const stats = Array.isArray(data) ? data : [];
    const grid = document.getElementById("stats-grid");
    grid.innerHTML = "";

    stats.forEach(stat => {
        const card = document.createElement("div");
        card.className = "stat-card";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <div class="stat-value">${stat.total_hours}h</div>
            <div class="stat-label">${stat.user_name}</div>
            <div style="font-size:12px; color: var(--text-muted); margin-top:4px">
                ${stat.shifts_count} shifts this month
            </div>
            <div style="font-size:11px; color:var(--accent); margin-top:8px; opacity:0.7">View schedule →</div>
        `;
        card.addEventListener("click", () => openEmployeeSchedule(stat.user_id, stat.user_name));
        grid.appendChild(card);
    });

    if (stats.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted)">No data for this month</p>';
    }
}