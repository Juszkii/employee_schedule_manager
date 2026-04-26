// ── GLOBAL VARIABLES ─────────────────────────────────────────
// Store application state — current month, employee list, etc.
let currentDate = new Date();

// ── CUSTOM SELECT ─────────────────────────────────────────────

document.addEventListener("click", () => {
    document.querySelectorAll(".cs-wrap.open").forEach(el => el.classList.remove("open"));
    document.querySelectorAll(".dept-more-wrap.open").forEach(el => el.classList.remove("open"));
});

function buildCustomSelect(wrapId, options, selectedValue) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;

    const val = selectedValue !== undefined && selectedValue !== null ? String(selectedValue) : "";
    const current = options.find(o => String(o.value) === val);
    const displayText = current ? current.label : (options[0]?.label || "");

    wrap.dataset.value = val;
    wrap.innerHTML = `
        <button type="button" class="cs-trigger">
            <span class="cs-display">${displayText}</span>
            <svg class="cs-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="cs-list">
            ${options.map(o => `<div class="cs-item${String(o.value) === val ? " selected" : ""}" data-value="${o.value}">${o.label}</div>`).join("")}
        </div>
    `;

    wrap.querySelector(".cs-trigger").addEventListener("click", e => {
        e.stopPropagation();
        document.querySelectorAll(".cs-wrap.open").forEach(el => { if (el !== wrap) el.classList.remove("open"); });
        wrap.classList.toggle("open");
    });

    wrap.querySelectorAll(".cs-item").forEach(item => {
        item.addEventListener("click", e => {
            e.stopPropagation();
            wrap.dataset.value = item.dataset.value;
            wrap.querySelector(".cs-display").textContent = item.textContent;
            wrap.querySelectorAll(".cs-item").forEach(i => i.classList.remove("selected"));
            item.classList.add("selected");
            wrap.classList.remove("open");
        });
    });
}

function csVal(wrapId) {
    const el = document.getElementById(wrapId);
    return el ? (el.dataset.value ?? "") : "";
}

// ── ANIMATION HELPERS ─────────────────────────────────────
function staggerAnimate(els, cls, baseDelay = 14) {
    els.forEach((el, i) => {
        el.style.animationDelay = `${i * baseDelay}ms`;
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
    });
}

function countUp(el, target, suffix = "", duration = 900) {
    const start = performance.now();
    const update = now => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (t < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
}

document.addEventListener("click", e => {
    const btn = e.target.closest(".btn-primary, .btn-secondary, .btn-danger, .dept-tab");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const r = document.createElement("span");
    r.className = "btn-ripple";
    r.style.left = `${e.clientX - rect.left}px`;
    r.style.top  = `${e.clientY - rect.top}px`;
    btn.appendChild(r);
    r.addEventListener("animationend", () => r.remove());
});
let allShifts = [];
let allUsers = [];
let allLabels = [];
let allPositions = [];
let allDepartments = [];
let allNotifications = [];
let allRequests = [];
let currentEditShift = null;
let pendingConfirmAction = null;
let calendarView = 'month';
let weekStart = getWeekStart(new Date());

// ── EMPLOYEE COLORS ────────────────────────────────────────
const EMPLOYEE_COLORS = [
    { bg: 'rgba(59,130,246,0.22)',  border: '#3b82f6', text: '#93c5fd' },
    { bg: 'rgba(139,92,246,0.22)',  border: '#8b5cf6', text: '#c4b5fd' },
    { bg: 'rgba(236,72,153,0.22)',  border: '#ec4899', text: '#f9a8d4' },
    { bg: 'rgba(34,197,94,0.22)',   border: '#22c55e', text: '#86efac' },
    { bg: 'rgba(245,158,11,0.22)',  border: '#f59e0b', text: '#fcd34d' },
    { bg: 'rgba(14,165,233,0.22)',  border: '#0ea5e9', text: '#7dd3fc' },
    { bg: 'rgba(239,68,68,0.22)',   border: '#ef4444', text: '#fca5a5' },
    { bg: 'rgba(20,184,166,0.22)',  border: '#14b8a6', text: '#5eead4' },
];

function getEmployeeColor(userId) {
    return EMPLOYEE_COLORS[userId % EMPLOYEE_COLORS.length];
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

function timeToH(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
}
let currentDepartment = null;
let calendarRequests = [];

const POSITION_COLORS = [
    "#3B82F6", "#6366F1", "#8B5CF6", "#A78BFA",
    "#06B6D4", "#0EA5E9", "#22D3EE", "#14B8A6",
    "#10B981", "#22C55E", "#84CC16", "#EAB308",
    "#F97316", "#EF4444", "#F43F5E", "#EC4899",
    "#C084FC", "#818CF8", "#38BDF8", "#2DD4BF",
];

function formatPhoneInput(e) {
    const input = e.target;
    const cursor = input.selectionStart;
    const prevLen = input.value.length;

    let digits = input.value.replace(/\D/g, '');
    let formatted = '';
    if (digits.length > 0)  formatted  = '+' + digits.slice(0, 2);
    if (digits.length > 2)  formatted += ' ' + digits.slice(2, 5);
    if (digits.length > 5)  formatted += ' ' + digits.slice(5, 8);
    if (digits.length > 8)  formatted += ' ' + digits.slice(8, 11);

    input.value = formatted;
    // keep cursor roughly in place after formatting
    const diff = input.value.length - prevLen;
    input.setSelectionRange(cursor + diff, cursor + diff);
}

function attachPhoneFormatter(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.removeEventListener('input', formatPhoneInput);
    el.addEventListener('input', formatPhoneInput);
}

function buildColorPicker(pickerId, selectedColor, targetInputId) {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    const inputId = targetInputId || "position-color";
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
            document.getElementById(inputId).value = color;
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
    showNotification(t("notify_error"), message, "❌");
}

function showSuccess(message) {
    showNotification(t("notify_success"), message, "✅");
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

    // If no user data — redirect to login page
    if (!localStorage.getItem("user")) {
        window.location.href = "/index.html";
        return;
    }

    const user = getCurrentUser();

    // Display user name and role in sidebar
    applyLanguage();
    document.getElementById("user-name").textContent = user.name;
    document.getElementById("user-role").textContent =
        user.role === "manager" ? t("role_manager") : t("role_employee");
    const initials = user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const avatarEl = document.getElementById("sidebar-avatar");
    if (avatarEl) avatarEl.textContent = initials;

    // Populate mobile topbar + more drawer user info
    const mobileAvatar = document.getElementById("mobile-avatar");
    if (mobileAvatar) mobileAvatar.textContent = initials;
    const moreAvatar = document.getElementById("mobile-more-avatar");
    if (moreAvatar) moreAvatar.textContent = initials;
    const moreName = document.getElementById("mobile-more-name");
    if (moreName) moreName.textContent = user.name;
    const moreRole = document.getElementById("mobile-more-role");
    if (moreRole) moreRole.textContent = user.role === "manager" ? t("role_manager") : t("role_employee");

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
    document.querySelectorAll(".mobile-nav-item[data-view]").forEach(el => el.classList.remove("active"));
    // Remove active class from all page titles
    document.querySelectorAll(".page-title").forEach(el => el.classList.remove("active"));

    // Show selected view with entrance animation
    const viewEl = document.getElementById(`view-${view}`);
    viewEl.style.display = "block";
    viewEl.classList.remove("view-entering");
    void viewEl.offsetWidth;
    viewEl.classList.add("view-entering");
    // Highlight the page title of active view
    const activeView = document.getElementById(`view-${view}`);
    if (activeView) {
        const pageTitle = activeView.querySelector(".page-title");
        if (pageTitle) pageTitle.classList.add("active");
    }

    // Highlight the navigation button for current view (desktop + mobile)
    document.querySelectorAll(`.nav-item[data-view="${view}"], .mobile-nav-item[data-view="${view}"]`).forEach(el => el.classList.add("active"));

    // Update mobile more drawer active state
    document.querySelectorAll(".mobile-more-item[data-view]").forEach(el => {
        el.style.color = el.dataset.view === view ? "var(--accent)" : "";
    });

    // Load appropriate data for selected view
    if (view === "calendar")      loadCalendar();
    if (view === "employees")     loadEmployees();
    if (view === "requests")      loadRequests();
    if (view === "announcements") { loadAnnouncements(); markAnnouncementsSeen(); }
    if (view === "notifications") loadNotifications();
    if (view === "stats")         loadStats();
}

// ── MANAGE MODAL ─────────────────────────────────────────────────────────────

function openManageModal(tab) {
    switchManageTab(tab || "departments");
    openModal("modal-manage");
}

function switchManageTab(tab) {
    document.querySelectorAll(".manage-tab").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".manage-tab-content").forEach(div => {
        div.style.display = "none";
    });
    const content = document.getElementById("manage-tab-" + tab);
    if (content) content.style.display = "";
    if (tab === "roles")       loadJobRolesSection();
    if (tab === "departments") loadDepartmentsSection();
    if (tab === "positions")   loadPositionsView();
}

// ── WYLOGOWANIE ───────────────────────────────────────────────
async function logout() {
    await apiFetch("/auth/logout", "POST");
    localStorage.removeItem("user");
    window.location.href = "/index.html";
}

function selectLangOption(lang) {
    document.querySelectorAll(".lang-option").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.lang === lang);
    });
}

function openSettings() {
    const user = getCurrentUser();
    document.getElementById("settings-name").value = user.name;
    document.getElementById("settings-email").value = user.email;
    document.getElementById("settings-password").value = "";
    document.getElementById("settings-password-confirm").value = "";
    selectLangOption(getLang());
    openModal("modal-settings");
}

async function saveSettings() {
    const lang = document.querySelector(".lang-option.active")?.dataset.lang || "en";
    const name = document.getElementById("settings-name").value.trim();
    const email = document.getElementById("settings-email").value.trim();
    const password = document.getElementById("settings-password").value;
    const confirm = document.getElementById("settings-password-confirm").value;

    if (!name) { showError(t("err_name_empty")); return; }
    if (!email) { showError(t("err_email_empty")); return; }
    if (password && !isStrongPassword(password)) { showError(t("err_password_weak")); return; }
    if (password && password !== confirm) { showError(t("err_passwords_no_match")); return; }

    const payload = { name, email };
    if (password) payload.password = password;

    const data = await apiFetch("/users/me", "PUT", payload);
    if (!data || data.error) { showError(data?.error || t("err_save_settings")); return; }

    localStorage.setItem("user", JSON.stringify(data));
    localStorage.setItem("lang", lang);
    document.getElementById("user-name").textContent = data.name;
    document.getElementById("user-role").textContent =
        data.role === "manager" ? t("role_manager") : t("role_employee");
    applyLanguage();
    renderCalendar();
    closeModal("modal-settings");
}

// ── MODALS ──────────────────────────────────────────────────────────────────
function closeModal(id) {
    document.getElementById(id).classList.remove("active");
    if (!document.querySelector(".modal-overlay.active")) {
        document.body.style.overflow = "";
    }
}

function openModal(id) {
    document.getElementById(id).classList.add("active");
    document.body.style.overflow = "hidden";
}

// Close modal by clicking outside it
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.remove("active");
        if (!document.querySelector(".modal-overlay.active")) {
            document.body.style.overflow = "";
        }
    }
});

// ── CALENDAR ───────────────────────────────────────────────
async function loadCalendar() {
    document.getElementById('view-monthly').style.display = calendarView === 'month' ? 'block' : 'none';
    document.getElementById('view-weekly').style.display  = calendarView === 'week'  ? 'block' : 'none';

    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const [shiftsData, requestsData] = await Promise.all([
        apiFetch(`/shifts/?month=${month}`),
        apiFetch("/requests/")
    ]);
    allShifts = Array.isArray(shiftsData) ? shiftsData : [];
    calendarRequests = (Array.isArray(requestsData) ? requestsData : [])
        .filter(r => r.type === "urlop" && r.status !== "rejected");
    if (calendarView === 'week') renderWeeklyCalendar();
    else renderCalendar();
    updateScheduleStats();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Set calendar title, e.g. "April 2026"
    document.getElementById("calendar-title").textContent =
        `${t("months")[month]} ${year}`;

    const grid = document.getElementById("calendar-grid");
    grid.innerHTML = "";

    // Week day headers
    const days = t("weekdays");
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

        const MAX_VISIBLE = 2;
        dayShifts.slice(0, MAX_VISIBLE).forEach(shift => {
            const chip = document.createElement("div");
            chip.className = "shift-chip";
            chip.textContent = shift.user_name.split(" ")[0];
            const user = allUsers.find(u => u.id === shift.user_id);
            const c = user?.department?.color || "#3B82F6";
            chip.style.background = c + "22";
            chip.style.borderLeft = `3px solid ${c}`;
            chip.style.color = c;
            cell.appendChild(chip);
        });

        if (dayShifts.length > MAX_VISIBLE) {
            const more = document.createElement("div");
            more.className = "shift-chip-more";
            more.textContent = t("more_shifts").replace("{n}", dayShifts.length - MAX_VISIBLE);
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
            chip.title = req.status === "pending" ? t("ph_pending_timeoff") : t("ph_approved_timeoff");
            cell.appendChild(chip);
        });

        // Click on day opens detail modal
        if (dayShifts.length > 0 || dayVacations.length > 0 || isManager()) {
            cell.style.cursor = "pointer";
            cell.addEventListener("click", () => openDayModal(dateStr, dayShifts, dayVacations));
        }

        grid.appendChild(cell);
    }

    staggerAnimate(
        Array.from(grid.querySelectorAll(".calendar-day:not(.other-month)")),
        "stagger-pop", 12
    );
}

// Change month — -1 previous, +1 next
function changeMonth(dir) {
    currentDate.setMonth(currentDate.getMonth() + dir);
    loadCalendar();
}

// ── CALENDAR VIEW TOGGLE ───────────────────────────────────
function toggleCalendarView(view) {
    calendarView = view;
    document.getElementById('view-monthly').style.display = view === 'month' ? 'block' : 'none';
    document.getElementById('view-weekly').style.display  = view === 'week'  ? 'block' : 'none';
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'week') {
        weekStart = getWeekStart(currentDate);
        loadWeekData();
    } else {
        loadCalendar();
    }
}

function calNav(dir) {
    if (calendarView === 'month') changeMonth(dir);
    else changeWeek(dir);
}

function changeWeek(dir) {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + dir * 7);
    loadWeekData();
}

async function loadWeekData() {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const sm = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
    const em = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}`;

    if (sm === em) {
        const [s, r] = await Promise.all([apiFetch(`/shifts/?month=${sm}`), apiFetch('/requests/')]);
        allShifts = Array.isArray(s) ? s : [];
        calendarRequests = (Array.isArray(r) ? r : []).filter(x => x.type === 'urlop' && x.status !== 'rejected');
    } else {
        const [s1, s2, r] = await Promise.all([
            apiFetch(`/shifts/?month=${sm}`), apiFetch(`/shifts/?month=${em}`), apiFetch('/requests/')
        ]);
        const seen = new Set();
        allShifts = [...(Array.isArray(s1)?s1:[]), ...(Array.isArray(s2)?s2:[])].filter(s => {
            if (seen.has(s.id)) return false;
            seen.add(s.id); return true;
        });
        calendarRequests = (Array.isArray(r) ? r : []).filter(x => x.type === 'urlop' && x.status !== 'rejected');
    }
    renderWeeklyCalendar();
    updateScheduleStats();
}

// ── WEEKLY CALENDAR RENDER ─────────────────────────────────
const WK_HOUR_START = 0;
const WK_HOUR_END   = 23;
const WK_HOUR_PX    = 60;

function renderWeeklyCalendar() {
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    });

    // Update calendar title to week range
    const locale = getLang() === 'pl' ? 'pl-PL' : 'en-US';
    const from = days[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const to   = days[6].toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('calendar-title').textContent = `${from} – ${to}`;

    const grid = document.getElementById('weekly-grid');
    grid.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayNames = t('weekdays');

    // Header row
    const header = document.createElement('div');
    header.className = 'wk-header';
    header.innerHTML = '<div class="wk-corner"></div>';
    days.forEach((d, i) => {
        const isToday = d.getTime() === today.getTime();
        const el = document.createElement('div');
        el.className = 'wk-day-header' + (isToday ? ' today' : '');
        el.innerHTML = `<span class="wk-day-name">${dayNames[i]}</span><span class="wk-day-num${isToday ? ' today' : ''}">${d.getDate()}</span>`;
        header.appendChild(el);
    });
    grid.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'wk-body';

    // Time gutter
    const gutter = document.createElement('div');
    gutter.className = 'wk-gutter';
    for (let h = WK_HOUR_START; h <= WK_HOUR_END; h++) {
        const lbl = document.createElement('div');
        lbl.className = 'wk-hour-lbl';
        lbl.textContent = `${String(h).padStart(2, '0')}:00`;
        gutter.appendChild(lbl);
    }
    body.appendChild(gutter);

    // Day columns
    days.forEach(d => {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const isToday = d.getTime() === today.getTime();

        const col = document.createElement('div');
        col.className = 'wk-col' + (isToday ? ' today' : '');

        for (let h = WK_HOUR_START; h <= WK_HOUR_END; h++) {
            const line = document.createElement('div');
            line.className = 'wk-hline';
            col.appendChild(line);
        }

        if (isManager()) {
            col.addEventListener('click', () => openAddShiftModal(dateStr));
        }

        // Filtered shifts
        let dayShifts = allShifts.filter(s => s.date === dateStr);
        if (currentDepartment !== null) {
            const deptIds = new Set(allUsers.filter(u => u.department_id === currentDepartment).map(u => u.id));
            dayShifts = dayShifts.filter(s => deptIds.has(s.user_id));
        }

        // Lane assignment for overlapping shifts
        const sorted = [...dayShifts].sort((a, b) => a.start_time.localeCompare(b.start_time));
        const laneEnds = [];
        const laned = sorted.map(shift => {
            const sh = timeToH(shift.start_time);
            const eh = timeToH(shift.end_time);
            let lane = laneEnds.findIndex(e => e <= sh);
            if (lane === -1) { lane = laneEnds.length; laneEnds.push(eh); }
            else laneEnds[lane] = eh;
            return { ...shift, lane, sh, eh };
        });
        const totalLanes = laneEnds.length || 1;

        laned.forEach(shift => {
            const top    = (shift.sh - WK_HOUR_START) * WK_HOUR_PX;
            const height = Math.max((shift.eh - shift.sh) * WK_HOUR_PX - 3, 22);
            const color  = getEmployeeColor(shift.user_id);
            const w = 100 / totalLanes;

            const card = document.createElement('div');
            card.className = 'wk-shift';
            card.style.cssText = `top:${top}px;height:${height}px;left:calc(${shift.lane*w}% + 2px);width:calc(${w}% - 4px);background:${color.bg};border-left:3px solid ${color.border};color:${color.text};`;
            card.innerHTML = `
                <div class="wk-shift-name">${shift.user_name.split(' ')[0]}</div>
                <div class="wk-shift-time">${shift.start_time}–${shift.end_time}</div>
                ${shift.position ? `<div class="wk-shift-pos">${shift.position.name}</div>` : ''}
            `;
            card.addEventListener('click', e => { e.stopPropagation(); if (isManager()) openEditShiftModal(shift); else openDayModal(dateStr, [shift]); });
            col.appendChild(card);
        });

        body.appendChild(col);
    });

    const scroll = document.createElement('div');
    scroll.className = 'wk-scroll';
    scroll.appendChild(body);
    grid.appendChild(scroll);
}

// ── SCHEDULE STATS UPDATE ──────────────────────────────────
function updateScheduleStats() {
    if (!isManager()) return;
    let shifts = allShifts;
    if (calendarView === 'week' && weekStart) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const d0 = weekStart.toISOString().split('T')[0];
        const d1 = weekEnd.toISOString().split('T')[0];
        shifts = shifts.filter(s => s.date >= d0 && s.date <= d1);
    }
    if (currentDepartment !== null) {
        const deptIds = new Set(allUsers.filter(u => u.department_id === currentDepartment).map(u => u.id));
        shifts = shifts.filter(s => deptIds.has(s.user_id));
    }
    const totalH = shifts.reduce((s, sh) => {
        const [ah, am] = sh.start_time.split(':').map(Number);
        const [bh, bm] = sh.end_time.split(':').map(Number);
        return s + (bh*60+bm - ah*60-am) / 60;
    }, 0);
    const empSet = new Set(shifts.map(s => s.user_id));
    const avgH = empSet.size > 0 ? totalH / empSet.size : 0;
    const th = document.getElementById('stat-total-hours');
    const ec = document.getElementById('stat-employee-count');
    const ah = document.getElementById('stat-avg-hours');
    if (th) th.textContent = totalH.toFixed(1) + 'h';
    if (ec) ec.textContent = empSet.size;
    if (ah) ah.textContent = avgH.toFixed(1) + 'h';
}

// ── DAY DETAIL MODAL ───────────────────────────────────────


// ── DAY DETAIL MODAL ─────────────────────────────────────────────────────
async function openDayModal(dateStr, dayShifts, dayVacations = []) {
    const date = new Date(dateStr + "T00:00:00");
    const locale = getLang() === "pl" ? "pl-PL" : "en-US";
    document.getElementById("day-modal-title").textContent =
        date.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const list = document.getElementById("day-modal-list");
    list.innerHTML = "";

    // Vacation rows
    dayVacations.forEach(req => {
        const row = document.createElement("div");
        row.className = "day-shift-row";
        const color = req.status === "pending" ? "var(--warning)" : "var(--success)";
        const statusLabel = req.status === "pending" ? t("status_pending") : t("status_approved");
        row.innerHTML = `
            <div class="day-shift-left">
                <div class="day-shift-indicator" style="background:${color}"></div>
                <div>
                    <div class="day-shift-name">${req.user_name}</div>
                    <div class="day-shift-time">🏖 ${t("opt_time_off")} &nbsp;<span class="day-pos-badge" style="background:${color}22;color:${color};border-color:${color}44">${statusLabel}</span></div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });

    if (dayShifts.length === 0 && dayVacations.length === 0) {
        list.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:24px 0">${t("no_shifts")}</p>`;
    } else {
        dayShifts.forEach(shift => {
            const row = document.createElement("div");
            row.className = "day-shift-row";

            const user = allUsers.find(u => u.id === shift.user_id);
            const deptColor = user?.department?.color || "#3B82F6";
            const roleHtml = user?.label
                ? `<span class="day-pos-badge" style="background:${deptColor}22; color:${deptColor}; border-color:${deptColor}44; box-shadow:0 0 7px ${deptColor}55">${user.label.name}</span>`
                : "";

            const posHtml = shift.position
                ? `<span class="day-pos-badge" style="background:${shift.position.color}22; color:${shift.position.color}; border-color:${shift.position.color}44">${shift.position.name}</span>`
                : "";
            const noteHtml = shift.note
                ? `<span class="day-shift-note">${shift.note}</span>`
                : "";

            row.innerHTML = `
                <div class="day-shift-left">
                    <div class="day-shift-indicator" style="background:${deptColor}"></div>
                    <div>
                        <div class="day-shift-name">${shift.user_name} ${roleHtml}</div>
                        <div class="day-shift-time">${shift.start_time} – ${shift.end_time} ${posHtml} ${noteHtml}</div>
                    </div>
                </div>
                ${isManager() ? `<button type="button" class="btn-secondary" style="padding:5px 12px;font-size:12px;flex-shrink:0" onclick="openEditShiftFromDay(${shift.id})">${t("btn_edit")}</button>` : ""}
            `;
            list.appendChild(row);
        });
    }

    // Sekcja wspolpracownikow — tylko dla pracownikow
    if (!isManager()) {
        const colleagues = await apiFetch(`/shifts/colleagues?date=${dateStr}`, "GET");
        if (Array.isArray(colleagues) && colleagues.length > 0) {
            const sep = document.createElement("div");
            sep.className = "day-colleagues-header";
            sep.textContent = t("section_colleagues_on_shift");
            list.appendChild(sep);

            colleagues.forEach(shift => {
                const user = allUsers.find(u => u.id === shift.user_id);
                const cDeptColor = user?.department?.color || "#3B82F6";
                const roleHtml = user?.label
                    ? `<span class="day-pos-badge" style="background:${cDeptColor}22;color:${cDeptColor};border-color:${cDeptColor}44; box-shadow:0 0 7px ${cDeptColor}55">${user.label.name}</span>`
                    : "";
                const posHtml = shift.position
                    ? `<span class="day-pos-badge" style="background:${shift.position.color}22;color:${shift.position.color};border-color:${shift.position.color}44">${shift.position.name}</span>`
                    : "";

                const row = document.createElement("div");
                row.className = "day-shift-row";
                row.innerHTML = `
                    <div class="day-shift-left">
                        <div class="day-shift-indicator" style="background:var(--text-muted)"></div>
                        <div>
                            <div class="day-shift-name">${shift.user_name} ${roleHtml}</div>
                            <div class="day-shift-time">${shift.start_time} – ${shift.end_time} ${posHtml}</div>
                        </div>
                    </div>
                `;
                list.appendChild(row);
            });
        }
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
        const dept = user.department;
        const deptCell = dept
            ? `<span style="display:inline-flex;align-items:center;gap:5px">
                   <span style="width:8px;height:8px;border-radius:50%;background:${dept.color};flex-shrink:0"></span>
                   ${dept.name}
               </span>`
            : "—";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${user.phone || "—"}</td>
            <td>${deptCell}</td>
            <td>${user.role === "manager" ? t("opt_manager") : t("opt_employee")}</td>
            <td>${user.label
                ? `<span class="label-badge" style="background:${dept?.color || "#6C63FF"}22; color:${dept?.color || "#6C63FF"}; box-shadow:0 0 7px ${dept?.color || "#6C63FF"}55">${user.label.name}</span>`
                : "—"
            }</td>
            <td style="display:flex; gap:6px;">
                <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:13px" onclick="openEditEmployeeModal(${user.id})" data-i18n="btn_edit">Edit</button>
                <button type="button" class="btn-danger" onclick="deleteEmployee(${user.id})" data-i18n="btn_delete">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    staggerAnimate(Array.from(tbody.querySelectorAll("tr")), "stagger-slide", 40);
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
    const empOptions = allUsers
        .filter(u => u.role === "employee")
        .map(u => ({ value: String(u.id), label: u.name }));
    buildCustomSelect("cs-shift-user", empOptions, empOptions[0]?.value ?? "");

    const posOptions = [
        { value: "", label: t("opt_no_position") },
        ...allPositions.map(p => ({ value: String(p.id), label: p.name }))
    ];
    buildCustomSelect("cs-shift-position", posOptions, "");

    document.getElementById("shift-date").value = dateStr || new Date().toISOString().split("T")[0];
    document.getElementById("shift-start").value = "08:00";
    document.getElementById("shift-end").value = "16:00";
    document.getElementById("shift-note").value = "";

    switchShiftTab("single");
    openModal("modal-shift");
}

// Wrapper function for clicking on calendar day
function openAddShiftModalForDate(dateStr) {
    openAddShiftModal(dateStr);
}

async function saveShift() {
    const user_id = parseInt(csVal("cs-shift-user"));
    const date = document.getElementById("shift-date").value;
    const start_time = document.getElementById("shift-start").value;
    const end_time = document.getElementById("shift-end").value;
    const note = document.getElementById("shift-note").value;
    const position_id = csVal("cs-shift-position") ? parseInt(csVal("cs-shift-position")) : null;

    if (!user_id) { showError(t("err_no_employee")); return; }
    if (start_time >= end_time) { showError(t("err_end_before_start")); return; }

    const data = await apiFetch("/shifts/", "POST", {
        user_id, date, start_time, end_time, note, position_id,
    });

    if (data.error) { showError(data.error); return; }
    closeModal("modal-shift");
    loadCalendar();
}

// ── RECURRING SHIFTS ──────────────────────────────────────────────────────
let _recurState = { year: 0, month: 0, selected: new Set() };

function switchShiftTab(tab) {
    document.querySelectorAll(".shift-tab").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.getElementById("shift-tab-single").style.display = tab === "single" ? "" : "none";
    document.getElementById("shift-tab-recurring").style.display = tab === "recurring" ? "" : "none";
    if (tab === "recurring") _initRecurTab();
}

function _initRecurTab() {
    const empOptions = allUsers
        .filter(u => u.role === "employee")
        .map(u => ({ value: String(u.id), label: u.name }));
    buildCustomSelect("cs-recur-user", empOptions, empOptions[0]?.value ?? "");

    const posOptions = [
        { value: "", label: t("opt_no_position") },
        ...allPositions.map(p => ({ value: String(p.id), label: p.name }))
    ];
    buildCustomSelect("cs-recur-position", posOptions, "");

    document.getElementById("recur-start").value = "08:00";
    document.getElementById("recur-end").value = "16:00";
    document.getElementById("recur-note").value = "";

    _recurState.year = currentDate.getFullYear();
    _recurState.month = currentDate.getMonth();
    _recurState.selected = new Set();
    _renderRecurCalendar();
}

function recurCalNav(dir) {
    _recurState.month += dir;
    if (_recurState.month > 11) { _recurState.month = 0; _recurState.year++; }
    if (_recurState.month < 0)  { _recurState.month = 11; _recurState.year--; }
    _renderRecurCalendar();
}

function _renderRecurCalendar() {
    const { year, month, selected } = _recurState;
    const locale = getLang() === "pl" ? "pl-PL" : "en-US";
    document.getElementById("recur-cal-title").textContent =
        new Date(year, month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });

    const grid = document.getElementById("recur-cal-grid");
    grid.innerHTML = "";

    let startDow = new Date(year, month, 1).getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startDow; i++) {
        const cell = document.createElement("div");
        cell.className = "recur-day-cell empty";
        grid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const cell = document.createElement("div");
        cell.className = "recur-day-cell" + (selected.has(dateStr) ? " selected" : "");
        cell.textContent = d;
        cell.addEventListener("click", () => toggleRecurDay(dateStr, cell));
        grid.appendChild(cell);
    }

    const count = selected.size;
    document.getElementById("recur-selected-count").textContent =
        count > 0 ? t("recur_days_selected").replace("{n}", count) : "";
}

function toggleRecurDay(dateStr, cell) {
    if (_recurState.selected.has(dateStr)) {
        _recurState.selected.delete(dateStr);
        cell.classList.remove("selected");
    } else {
        _recurState.selected.add(dateStr);
        cell.classList.add("selected");
    }
    const count = _recurState.selected.size;
    document.getElementById("recur-selected-count").textContent =
        count > 0 ? t("recur_days_selected").replace("{n}", count) : "";
}

async function saveRecurringShifts() {
    const user_id = csVal("cs-recur-user");
    const start_time = document.getElementById("recur-start").value;
    const end_time = document.getElementById("recur-end").value;
    const note = document.getElementById("recur-note").value;
    const position_id = csVal("cs-recur-position") || null;
    const dates = [..._recurState.selected].sort();

    if (!user_id) { showError(t("err_no_employee")); return; }
    if (!start_time || !end_time) { showError(t("err_time_required")); return; }
    if (start_time >= end_time) { showError(t("err_end_before_start")); return; }
    if (dates.length === 0) { showError(t("err_no_days_selected")); return; }

    const data = await apiFetch("/shifts/bulk", "POST", {
        user_id: parseInt(user_id),
        start_time,
        end_time,
        note,
        position_id: position_id ? parseInt(position_id) : null,
        dates,
    });

    if (data.error) { showError(data.error); return; }

    const created = data.created?.length ?? 0;
    const skipped = data.skipped?.length ?? 0;
    if (skipped > 0) {
        showError(t("msg_recurring_partial").replace("{created}", created).replace("{skipped}", skipped));
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

    const posOptions = [
        { value: "", label: t("opt_no_position") },
        ...allPositions.map(p => ({ value: String(p.id), label: p.name }))
    ];
    buildCustomSelect("cs-edit-shift-position", posOptions, shift.position_id ? String(shift.position_id) : "");

    openModal("modal-edit-shift");
}

async function updateShift() {
    if (!currentEditShift) return;

    const date = document.getElementById("edit-shift-date").value;
    const start_time = document.getElementById("edit-shift-start").value;
    const end_time = document.getElementById("edit-shift-end").value;
    const note = document.getElementById("edit-shift-note").value;
    const position_id = csVal("cs-edit-shift-position") ? parseInt(csVal("cs-edit-shift-position")) : null;

    if (start_time >= end_time) { showError(t("err_end_before_start")); return; }

    const data = await apiFetch(`/shifts/${currentEditShift.id}`, "PUT", {
        date, start_time, end_time, note, position_id,
    });

    if (data.error) { showError(data.error); return; }
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
const REQ_TYPES_WITH_TIMES = new Set(["swap", "nadgodziny"]);

const REQ_TYPE_ICONS = {
    urlop:                 `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>`,
    urlop_chorobowy:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    urlop_okolicznosciowy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    urlop_bezplatny:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    praca_zdalna:          `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    swap:                  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    nadgodziny:            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

const REQ_TYPES = [
    { value: "urlop",                 key: "opt_time_off" },
    { value: "urlop_chorobowy",       key: "opt_urlop_chorobowy" },
    { value: "urlop_okolicznosciowy", key: "opt_urlop_okolicznosciowy" },
    { value: "urlop_bezplatny",       key: "opt_urlop_bezplatny" },
    { value: "praca_zdalna",          key: "opt_praca_zdalna" },
    { value: "swap",                  key: "opt_shift_swap" },
    { value: "nadgodziny",            key: "opt_nadgodziny" },
];

function reqTypeLabel(type) {
    const found = REQ_TYPES.find(r => r.value === type);
    const icon  = REQ_TYPE_ICONS[type] ?? "";
    const label = found ? t(found.key) : type;
    return `<span class="req-type-icon">${icon}</span>${label}`;
}

function reqStatusColor(status) {
    return status === "pending" ? "var(--warning)" : status === "approved" ? "var(--success)" : "var(--danger)";
}

async function loadRequests() {
    const data = await apiFetch("/requests/");
    const requests = Array.isArray(data) ? data : [];
    allRequests = requests;

    const container = document.getElementById("requests-list");
    container.innerHTML = "";

    if (requests.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:40px 0">${t("req_no_requests")}</p>`;
        return;
    }

    requests.forEach(req => {
        const days = Math.round((new Date(req.date_to) - new Date(req.date_from)) / 86400000) + 1;
        const color = reqStatusColor(req.status);
        const statusLabel = t("status_" + req.status);
        const typeLabel = reqTypeLabel(req.type);

        const card = document.createElement("div");
        card.className = "req-card";
        card.innerHTML = `
            <div class="req-card-stripe" style="background:${color}"></div>
            <div class="req-card-body">
                <div class="req-card-top">
                    <span class="req-card-type">${typeLabel}</span>
                    <span class="status-badge status-${req.status}">${statusLabel}</span>
                </div>
                <div class="req-card-meta">
                    <span class="req-card-emp">${req.user_name}</span>
                    <span class="req-card-dates">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${req.date_from} – ${req.date_to}
                        <span class="req-card-days">${days} ${t("req_days")}</span>
                    </span>
                    ${req.time_from && req.time_to ? `
                    <span class="req-card-times">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${req.time_from} – ${req.time_to}
                    </span>` : ""}
                    ${req.message ? `<span class="req-card-reason">"${req.message}"</span>` : ""}
                </div>
                <div class="req-card-actions">
                    <button type="button" class="req-action-btn" onclick="openRequestDetail(${req.id})">${t("btn_details") || "Details"}</button>
                    ${isManager() && req.status === "pending" ? `
                        <button type="button" class="req-action-btn req-approve-btn" onclick="updateRequest(${req.id},'approved')">✓ ${t("btn_approve") || "Approve"}</button>
                        <button type="button" class="req-action-btn req-reject-btn" onclick="updateRequest(${req.id},'rejected')">✗ ${t("btn_reject") || "Reject"}</button>
                    ` : ""}
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    staggerAnimate(Array.from(container.querySelectorAll(".req-card")), "stagger-slide", 50);
}

function openRequestDetail(reqId) {
    const req = allRequests.find(r => r.id === reqId);
    if (!req) return;

    const days = Math.round((new Date(req.date_to) - new Date(req.date_from)) / 86400000) + 1;
    const color = reqStatusColor(req.status);

    document.getElementById("request-detail-content").innerHTML = `
        <div class="req-detail-header" style="border-color:${color}22; background:${color}11">
            <span class="req-detail-type">${reqTypeLabel(req.type)}</span>
            <span class="status-badge status-${req.status}">${t("status_" + req.status)}</span>
        </div>
        <div class="req-detail-grid">
            <div class="req-detail-item">
                <span class="req-detail-label">${t("req_submitted_label")}</span>
                <span class="req-detail-value">${req.user_name}</span>
            </div>
            <div class="req-detail-item">
                <span class="req-detail-label">${t("req_period_label")}</span>
                <span class="req-detail-value">${req.date_from} – ${req.date_to} <em style="color:var(--text-muted);font-style:normal">(${days} ${t("req_days")})</em></span>
            </div>
            ${req.time_from && req.time_to ? `
            <div class="req-detail-item">
                <span class="req-detail-label">${t("label_shift_hours")}</span>
                <span class="req-detail-value">${req.time_from} – ${req.time_to}</span>
            </div>` : ""}
            ${req.message ? `
            <div class="req-detail-item" style="grid-column:1/-1">
                <span class="req-detail-label">${t("req_reason_label")}</span>
                <span class="req-detail-value" style="white-space:pre-wrap;line-height:1.6">${req.message}</span>
            </div>` : ""}
        </div>
    `;

    const actions = document.getElementById("request-detail-actions");
    actions.innerHTML = "";
    if (isManager() && req.status === "pending") {
        const approveBtn = document.createElement("button");
        approveBtn.type = "button";
        approveBtn.className = "btn-primary";
        approveBtn.style.cssText = "width:auto;padding:8px 18px;";
        approveBtn.textContent = `✓ ${t("btn_approve") || "Approve"}`;
        approveBtn.addEventListener("click", () => { updateRequest(req.id, "approved"); closeModal("modal-request-detail"); });

        const rejectBtn = document.createElement("button");
        rejectBtn.type = "button";
        rejectBtn.className = "btn-danger";
        rejectBtn.style.cssText = "padding:8px 18px;";
        rejectBtn.textContent = `✗ ${t("btn_reject") || "Reject"}`;
        rejectBtn.addEventListener("click", () => { updateRequest(req.id, "rejected"); closeModal("modal-request-detail"); });

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
    }

    openModal("modal-request-detail");
}

function _updateReqTimeSection() {
    const type = csVal("cs-req-type");
    const section = document.getElementById("req-time-section");
    if (!section) return;
    const show = REQ_TYPES_WITH_TIMES.has(type);
    section.style.display = show ? "" : "none";
    if (!show) {
        document.getElementById("req-time-from").value = "";
        document.getElementById("req-time-to").value   = "";
    }
}

function openAddRequestModal() {
    const typeOptions = REQ_TYPES.map(r => ({
        value: r.value,
        label: `<span class="req-type-icon">${REQ_TYPE_ICONS[r.value] ?? ""}</span>${t(r.key)}`,
    }));
    buildCustomSelect("cs-req-type", typeOptions, "urlop");
    document.getElementById("req-from").value    = "";
    document.getElementById("req-to").value      = "";
    document.getElementById("req-time-from").value = "";
    document.getElementById("req-time-to").value   = "";
    document.getElementById("req-message").value  = "";
    _updateReqTimeSection();

    const wrap = document.getElementById("cs-req-type");
    wrap.querySelectorAll(".cs-item").forEach(item => {
        item.addEventListener("click", () => setTimeout(_updateReqTimeSection, 0));
    });

    openModal("modal-request");
}

async function saveRequest() {
    const type      = csVal("cs-req-type");
    const date_from = document.getElementById("req-from").value;
    const date_to   = document.getElementById("req-to").value;
    const message   = document.getElementById("req-message").value.trim();
    const time_from = document.getElementById("req-time-from").value || null;
    const time_to   = document.getElementById("req-time-to").value   || null;

    if (!date_from || !date_to) { showError(t("err_dates_required")); return; }
    if (date_to < date_from)    { showError(t("err_end_date_before_start")); return; }
    if (REQ_TYPES_WITH_TIMES.has(type) && (!time_from || !time_to)) {
        showError(t("err_times_required")); return;
    }

    const data = await apiFetch("/requests/", "POST", { type, date_from, date_to, message, time_from, time_to });
    if (data.error) { showError(data.error); return; }

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

    staggerAnimate(Array.from(list.querySelectorAll(".notif-item")), "stagger-slide", 45);
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

    const roleOptions = [
        { value: "employee", label: t("role_employee") },
        { value: "manager", label: t("role_manager") },
    ];
    buildCustomSelect("cs-edit-role", roleOptions, user.role);

    const deptOptions = [
        { value: "", label: t("opt_no_department") },
        ...allDepartments.map(d => ({ value: String(d.id), label: d.name }))
    ];
    buildCustomSelect("cs-edit-department", deptOptions, user.department_id ? String(user.department_id) : "");

    const labelOptions = [
        { value: "", label: t("opt_no_role") },
        ...allLabels.map(l => ({ value: String(l.id), label: l.name }))
    ];
    buildCustomSelect("cs-edit-label", labelOptions, user.label ? String(user.label.id) : "");

    openModal("modal-edit-employee");
}

async function saveEditEmployee() {
    const id = document.getElementById("edit-emp-id").value;
    const name = document.getElementById("edit-emp-name").value.trim();
    const role = csVal("cs-edit-role");
    const label_id = csVal("cs-edit-label") || null;
    const department_id = csVal("cs-edit-department") ? parseInt(csVal("cs-edit-department")) : null;

    if (!name) { showError(t("err_name_empty")); return; }

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
                <span class="label-badge">${label.name}</span>
            </div>
            <button type="button" class="btn-danger" style="padding:4px 10px; font-size:12px" onclick="deleteLabel(${label.id})">Delete</button>
        `;
        container.appendChild(row);
    });
}

function openAddLabelModal() {
    document.getElementById("label-name").value = "";
    document.getElementById("label-color").value = "#3B82F6";
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
    allBtn.textContent = t("opt_all");
    allBtn.addEventListener("click", () => { closeDeptDropdown(); selectDepartment(null); });
    container.appendChild(allBtn);

    const activeDept = currentDepartment !== null
        ? allDepartments.find(d => d.id === currentDepartment)
        : null;

    const wrap = document.createElement("div");
    wrap.className = "dept-more-wrap";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "dept-tab dept-more-btn" + (activeDept ? " active" : "");
    if (activeDept) {
        trigger.innerHTML = `<span class="dept-more-dot" style="background:${activeDept.color}"></span>${activeDept.name}`;
    } else {
        trigger.innerHTML = `<span class="dept-more-dots">···</span>`;
    }

    const dropdown = document.createElement("div");
    dropdown.className = "dept-dropdown";

    allDepartments.forEach(dept => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dept-dropdown-item" + (currentDepartment === dept.id ? " active" : "");
        item.innerHTML = `<span class="dept-dd-dot" style="background:${dept.color}"></span>${dept.name}`;
        item.addEventListener("click", e => {
            e.stopPropagation();
            closeDeptDropdown();
            selectDepartment(dept.id);
        });
        dropdown.appendChild(item);
    });

    trigger.addEventListener("click", e => {
        e.stopPropagation();
        const isOpen = wrap.classList.contains("open");
        closeDeptDropdown();
        if (!isOpen) wrap.classList.add("open");
    });

    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);
    container.appendChild(wrap);
}

function closeDeptDropdown() {
    document.querySelectorAll(".dept-more-wrap.open").forEach(el => el.classList.remove("open"));
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
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="width:14px; height:14px; border-radius:50%; background:${dept.color}; flex-shrink:0; box-shadow:0 0 6px ${dept.color}88;"></span>
                <span style="font-size:14px; font-weight:500;">${dept.name}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button type="button" class="btn-secondary" style="padding:4px 10px; font-size:12px" onclick="openEditDepartmentModal(${dept.id})" data-i18n="btn_edit">Edit</button>
                <button type="button" class="btn-danger" style="padding:4px 10px; font-size:12px" onclick="deleteDepartment(${dept.id})" data-i18n="btn_delete">Delete</button>
            </div>
        `;
        container.appendChild(row);
    });
}

function openAddDepartmentModal() {
    document.getElementById("dept-name").value = "";
    document.getElementById("dept-color").value = "#3B82F6";
    buildColorPicker("dept-color-picker", "#3B82F6", "dept-color");
    openModal("modal-department");
}

async function saveDepartment() {
    const nameEl = document.getElementById("dept-name");
    const name = nameEl.value.trim();
    const color = document.getElementById("dept-color").value || "#3B82F6";
    if (!name) { showError("Department name cannot be empty."); return; }

    const data = await apiFetch("/departments/", "POST", { name, color });
    if (data && data.error) { showError(data.error); return; }

    closeModal("modal-department");
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

function openEditDepartmentModal(id) {
    const dept = allDepartments.find(d => d.id === id);
    if (!dept) return;
    document.getElementById("edit-dept-id").value = id;
    document.getElementById("edit-dept-name").value = dept.name;
    document.getElementById("edit-dept-color").value = dept.color;
    buildColorPicker("edit-dept-color-picker", dept.color, "edit-dept-color");
    openModal("modal-edit-department");
}

async function saveEditDepartment() {
    const id = parseInt(document.getElementById("edit-dept-id").value);
    const name = document.getElementById("edit-dept-name").value.trim();
    const color = document.getElementById("edit-dept-color").value || "#3B82F6";
    if (!name) { showError("Department name cannot be empty."); return; }

    const data = await apiFetch(`/departments/${id}`, "PUT", { name, color });
    if (data && data.error) { showError(data.error); return; }

    closeModal("modal-edit-department");
    await loadDepartments();
    loadDepartmentsSection();
    loadEmployees();
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

    const opts = [
        { value: "", label: t("opt_all_departments") },
        ...allDepartments.map(d => ({ value: String(d.id), label: d.name }))
    ];
    buildCustomSelect("cs-ann-department", opts, "");

    openModal("modal-announcement");
}

async function saveAnnouncement() {
    const title   = document.getElementById("ann-title").value.trim();
    const content = document.getElementById("ann-content").value.trim();
    const deptVal = csVal("cs-ann-department");
    const department_id = deptVal ? parseInt(deptVal) : null;

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
    popup.style.visibility = "hidden";
    popup.classList.add("active");

    const wrap = triggerEl.closest(".dp-input-wrap") || triggerEl;
    const rect = wrap.getBoundingClientRect();
    const pr = popup.getBoundingClientRect();

    let top = rect.bottom + 6;
    let left = rect.left;
    if (pr.bottom > window.innerHeight - 8) top = rect.top - pr.height - 6;
    if (left + pr.width > window.innerWidth - 8) left = rect.right - pr.width;
    popup.style.top = Math.max(8, top) + "px";
    popup.style.left = Math.max(8, left) + "px";
    popup.style.visibility = "";
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
    popup.style.visibility = "hidden";
    popup.classList.add("active");

    const wrap = triggerEl.closest(".dp-input-wrap") || triggerEl;
    const rect = wrap.getBoundingClientRect();
    const pr = popup.getBoundingClientRect();

    let top = rect.bottom + 6;
    let left = rect.left;
    if (pr.bottom > window.innerHeight - 8) top = rect.top - pr.height - 6;
    if (left + pr.width > window.innerWidth - 8) left = rect.right - pr.width;
    popup.style.top = Math.max(8, top) + "px";
    popup.style.left = Math.max(8, left) + "px";
    popup.style.visibility = "";
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

    const initials = userName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    document.getElementById("emp-sched-avatar").textContent = initials;

    const user = allUsers.find(u => u.id === userId);
    const subtitleParts = [];
    if (user?.department) subtitleParts.push(user.department.name);
    if (user?.label)      subtitleParts.push(user.label.name);
    document.getElementById("emp-sched-subtitle").textContent = subtitleParts.join(" · ") || "";

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
    const { year, month, shifts, vacations } = empSchedState;
    const locale = getLang() === "pl" ? "pl-PL" : "en-US";

    document.getElementById("emp-sched-month-title").textContent =
        new Date(year, month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });

    let totalMins = 0;
    shifts.forEach(s => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        totalMins += eh * 60 + em - sh * 60 - sm;
    });
    document.getElementById("emp-sched-stats-bar").innerHTML = `
        <div class="emp-sched-stat">
            <div class="emp-sched-stat-val">${shifts.length}</div>
            <div class="emp-sched-stat-lbl">${t("stats_total_shifts")}</div>
        </div>
        <div class="emp-sched-stat">
            <div class="emp-sched-stat-val">${(totalMins / 60).toFixed(1)}h</div>
            <div class="emp-sched-stat-lbl">${t("stats_total_hours")}</div>
        </div>
        <div class="emp-sched-stat">
            <div class="emp-sched-stat-val">${vacations.length}</div>
            <div class="emp-sched-stat-lbl">${t("nav_requests")}</div>
        </div>
    `;

    const grid = document.getElementById("emp-sched-grid");
    grid.innerHTML = "";

    const dayHeaders = getLang() === "pl"
        ? ["Pon","Wt","Śr","Czw","Pt","Sob","Nd"]
        : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    dayHeaders.forEach(d => {
        const h = document.createElement("div");
        h.className = "emp-sched-day-header";
        h.textContent = d;
        grid.appendChild(h);
    });

    let startDow = new Date(year, month, 1).getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < startDow; i++) {
        const e = document.createElement("div");
        e.className = "emp-sched-cell other-month";
        grid.appendChild(e);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayShifts = shifts.filter(s => s.date === dateStr);
        const dayVacs   = vacations.filter(r => r.date_from <= dateStr && r.date_to >= dateStr);

        const cell = document.createElement("div");
        cell.className = "emp-sched-cell";
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate())
            cell.classList.add("today");
        if (dayShifts.length > 0)
            cell.classList.add("has-shift");

        const dayNum = document.createElement("div");
        dayNum.className = "emp-sched-day-num";
        dayNum.textContent = day;
        cell.appendChild(dayNum);

        dayShifts.forEach(shift => {
            const chip = document.createElement("div");
            chip.className = "emp-sched-chip";
            chip.textContent = shift.start_time + "–" + shift.end_time;
            const c = (shift.position && shift.position.color) ? shift.position.color : "var(--accent)";
            chip.style.cssText = `background:${c}22; border-left-color:${c}; color:${c}`;
            const parts = [shift.position && shift.position.name, shift.note].filter(Boolean);
            if (parts.length) chip.title = parts.join(" · ");
            cell.appendChild(chip);
        });

        dayVacs.forEach(req => {
            const chip = document.createElement("div");
            chip.className = "emp-sched-chip";
            chip.textContent = t("type_urlop") || "Off";
            const isPending = req.status === "pending";
            const c  = isPending ? "var(--warning)" : "var(--success)";
            const bg = isPending ? "rgba(245,158,11,.15)" : "rgba(34,197,94,.15)";
            chip.style.cssText = `background:${bg}; border-left-color:${c}; color:${c}`;
            cell.appendChild(chip);
        });

        grid.appendChild(cell);
    }
}

// ── STATISTICS ─────────────────────────────────────────────────────────────────────────────────
let _statsChartBar  = null;
let _statsChartLine = null;

function _statsMonthStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function statsNavMonth(dir) {
    currentDate.setMonth(currentDate.getMonth() + dir);
    loadStats();
}

function _destroyCharts() {
    if (_statsChartBar)  { _statsChartBar.destroy();  _statsChartBar  = null; }
    if (_statsChartLine) { _statsChartLine.destroy(); _statsChartLine = null; }
}

async function loadStats() {
    const locale = getLang() === "pl" ? "pl-PL" : "en-US";
    const month  = _statsMonthStr(currentDate);

    document.getElementById("stats-month-label").textContent =
        currentDate.toLocaleDateString(locale, { month: "long", year: "numeric" });

    const prevDate  = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const prevMonth = _statsMonthStr(prevDate);

    const trend6 = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - i), 1);
        return { label: d.toLocaleDateString(locale, { month: "short" }), month: _statsMonthStr(d) };
    });

    const [currData, prevData, ...trendRaw] = await Promise.all([
        apiFetch(`/stats/?month=${month}`),
        apiFetch(`/stats/?month=${prevMonth}`),
        ...trend6.map(x => apiFetch(`/stats/?month=${x.month}`))
    ]);

    const stats     = Array.isArray(currData) ? currData : [];
    const prevStats = Array.isArray(prevData) ? prevData : [];

    const totalHours  = stats.reduce((s, r) => s + r.total_hours, 0);
    const totalShifts = stats.reduce((s, r) => s + r.shifts_count, 0);
    const activeEmps  = stats.length;
    const avgHours    = activeEmps ? totalHours / activeEmps : 0;
    const prevHours   = prevStats.reduce((s, r) => s + r.total_hours, 0);
    const prevShifts  = prevStats.reduce((s, r) => s + r.shifts_count, 0);
    const prevEmps    = prevStats.length;
    const prevAvg     = prevEmps ? prevHours / prevEmps : 0;

    function delta(curr, prev) {
        if (prev === 0) return '<span class="stats-kpi-delta neutral">—</span>';
        const pct  = Math.round(((curr - prev) / prev) * 100);
        const cls  = pct >= 0 ? "up" : "down";
        const sign = pct >= 0 ? "+" : "";
        return `<span class="stats-kpi-delta ${cls}">${sign}${pct}%</span>`;
    }

    const SVG_CLOCK  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    const SVG_CAL    = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    const SVG_USERS  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    const SVG_PULSE  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';

    const kpiDefs = [
        { cls:"kpi-blue",   icon:SVG_CLOCK, val:totalHours.toFixed(1),  suffix:"h", label:t("stats_total_hours"),    dl:delta(totalHours, prevHours)  },
        { cls:"kpi-violet", icon:SVG_CAL,   val:totalShifts,            suffix:"",  label:t("stats_total_shifts"),   dl:delta(totalShifts, prevShifts) },
        { cls:"kpi-teal",   icon:SVG_USERS, val:activeEmps,             suffix:"",  label:t("stats_employees_count"),dl:delta(activeEmps, prevEmps)   },
        { cls:"kpi-green",  icon:SVG_PULSE, val:avgHours.toFixed(1),    suffix:"h", label:t("stats_avg_hours"),      dl:delta(avgHours, prevAvg)      }
    ];

    const kpiRow = document.getElementById("stats-kpi-row");
    kpiRow.innerHTML = kpiDefs.map(k => `
        <div class="stats-kpi-card ${k.cls}">
            <div class="stats-kpi-header">
                <div class="stats-kpi-icon">${k.icon}</div>
                ${k.dl}
            </div>
            <div class="stats-kpi-val">${k.val}${k.suffix}</div>
            <div class="stats-kpi-label">${k.label}</div>
        </div>
    `).join("");
    staggerAnimate(Array.from(kpiRow.querySelectorAll(".stats-kpi-card")), "stagger-pop", 70);

    _destroyCharts();
    Chart.defaults.color       = "#64748b";
    Chart.defaults.borderColor = "#1c2338";
    Chart.defaults.font.family = "DM Sans, sans-serif";
    Chart.defaults.font.size   = 11;

    const sorted = [...stats].sort((a, b) => b.total_hours - a.total_hours).slice(0, 10);
    const BAR_COLORS = ["#3b82f6","#6366f1","#8b5cf6","#06b6d4","#14b8a6","#10b981","#22c55e","#eab308","#f97316","#ef4444"];
    const barCtx = document.getElementById("chart-hours-bar");
    if (barCtx) {
        _statsChartBar = new Chart(barCtx, {
            type: "bar",
            data: {
                labels: sorted.map(s => s.user_name.split(" ")[0]),
                datasets: [{ data: sorted.map(s => parseFloat(s.total_hours.toFixed(1))), backgroundColor: BAR_COLORS, borderRadius: 6, borderSkipped: false }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxRotation: 0 } },
                    y: { grid: { color: "rgba(28,35,56,0.8)" }, ticks: { callback: v => v + "h" }, beginAtZero: true }
                }
            }
        });
    }

    const trendHours = trendRaw.map(d => parseFloat(((Array.isArray(d) ? d : []).reduce((s, r) => s + r.total_hours, 0)).toFixed(1)));
    const lineCtx = document.getElementById("chart-trend-line");
    if (lineCtx) {
        _statsChartLine = new Chart(lineCtx, {
            type: "line",
            data: {
                labels: trend6.map(x => x.label),
                datasets: [{
                    data: trendHours,
                    borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.08)",
                    borderWidth: 2.5, pointBackgroundColor: "#3b82f6",
                    pointBorderColor: "#0d1120", pointBorderWidth: 2,
                    pointRadius: 4, pointHoverRadius: 6, tension: 0.4, fill: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: "rgba(28,35,56,0.8)" }, ticks: { callback: v => v + "h" }, beginAtZero: true }
                }
            }
        });
    }

    const grid = document.getElementById("stats-grid");
    grid.innerHTML = "";
    if (stats.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted)">${t("stats_no_data")}</p>`;
    } else {
        [...stats].sort((a, b) => b.total_hours - a.total_hours).forEach(stat => {
            const user      = allUsers.find(u => u.id === stat.user_id);
            const deptColor = user?.department?.color || "var(--accent)";
            const initials  = stat.user_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            const card = document.createElement("div");
            card.className = "stat-card";
            card.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,${deptColor},${deptColor}99);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:#fff;flex-shrink:0">${initials}</div>
                    <div>
                        <div style="font-weight:600;font-size:14px;line-height:1.2">${stat.user_name}</div>
                        <div style="font-size:11px;color:var(--text-muted)">${user?.department?.name || ""}</div>
                    </div>
                </div>
                <div class="stat-value" data-target="${stat.total_hours}" data-suffix="h">0h</div>
                <div class="stat-label" style="margin-top:4px">${t("stats_total_hours")}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
                    <span class="stat-shifts-count" data-target="${stat.shifts_count}">0</span> ${t("stats_total_shifts").toLowerCase()}
                </div>
                <div style="font-size:11px;color:var(--accent);margin-top:10px;opacity:0.7">${t("stats_view_schedule")} →</div>
            `;
            card.addEventListener("click", () => openEmployeeSchedule(stat.user_id, stat.user_name));
            grid.appendChild(card);
        });
        staggerAnimate(Array.from(grid.querySelectorAll(".stat-card")), "stagger-pop", 60);
        grid.querySelectorAll(".stat-value").forEach(el => countUp(el, parseFloat(el.dataset.target) || 0, "h"));
        grid.querySelectorAll(".stat-shifts-count").forEach(el => countUp(el, parseInt(el.dataset.target) || 0, ""));
    }
}

async function openDetailedStats() {
    const locale     = getLang() === "pl" ? "pl-PL" : "en-US";
    const month      = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const prevDate   = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const prevMonth  = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const [data, prevData] = await Promise.all([
        apiFetch(`/stats/?month=${month}`),
        apiFetch(`/stats/?month=${prevMonth}`)
    ]);

    const stats     = Array.isArray(data)     ? data     : [];
    const prevStats = Array.isArray(prevData) ? prevData : [];
    const container = document.getElementById("detailed-stats-content");

    if (stats.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);padding:24px 0;text-align:center">${t("stats_no_data")}</p>`;
        openModal("modal-detailed-stats");
        return;
    }

    const totalHours  = stats.reduce((s, r) => s + r.total_hours, 0);
    const totalShifts = stats.reduce((s, r) => s + r.shifts_count, 0);
    const avgHours    = totalHours / stats.length;
    const prevHours   = prevStats.reduce((s, r) => s + r.total_hours, 0);
    const prevShifts  = prevStats.reduce((s, r) => s + r.shifts_count, 0);
    const prevAvg     = prevStats.length ? prevStats.reduce((s, r) => s + r.total_hours, 0) / prevStats.length : 0;
    const monthLabel  = currentDate.toLocaleDateString(locale, { month: "long", year: "numeric" });

    function deltaBadge(curr, prev) {
        if (prev === 0) return "";
        const pct  = Math.round(((curr - prev) / prev) * 100);
        const cls  = pct >= 0 ? "up" : "down";
        const sign = pct >= 0 ? "+" : "";
        return `<span class="stats-kpi-delta ${cls}" style="font-size:11px">${sign}${pct}%</span>`;
    }

    const SVG_CLOCK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const SVG_CAL   = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const SVG_PULSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;

    const kpis = [
        { cls:"kpi-blue",   icon:SVG_CLOCK, val:`${totalHours.toFixed(1)}h`, label:t("stats_total_hours"),  dl:deltaBadge(totalHours, prevHours)  },
        { cls:"kpi-violet", icon:SVG_CAL,   val:totalShifts,                 label:t("stats_total_shifts"), dl:deltaBadge(totalShifts, prevShifts) },
        { cls:"kpi-teal",   icon:SVG_PULSE, val:`${avgHours.toFixed(1)}h`,   label:t("stats_avg_hours"),    dl:deltaBadge(avgHours, prevAvg)       }
    ];

    const sorted  = [...stats].sort((a, b) => b.total_hours - a.total_hours);
    const maxHours = sorted[0]?.total_hours || 1;
    const BAR_COLORS = ["#f59e0b","#94a3b8","#c2864a"];
    const RANK_CLS   = ["rank-gold","rank-silver","rank-bronze"];

    const rankRows = sorted.map((s, i) => {
        const user      = allUsers.find(u => u.id === s.user_id);
        const deptColor = user?.department?.color || "#3b82f6";
        const deptName  = user?.department?.name  || "";
        const initials  = s.user_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        const pct       = Math.round((s.total_hours / maxHours) * 100);
        const barColor  = i < 3 ? BAR_COLORS[i] : deptColor;
        const rankCls   = i < 3 ? RANK_CLS[i] : "";
        const medal     = i < 3 ? ["🥇","🥈","🥉"][i] : i + 1;
        const shiftsLabel = getLang() === "pl" ? "zmian" : "shifts";

        return `
        <div class="dstats-rank-item ${rankCls}">
            <div class="dstats-rank-medal">${medal}</div>
            <div class="dstats-rank-avatar" style="background:linear-gradient(135deg,${deptColor},${deptColor}99)">${initials}</div>
            <div class="dstats-rank-info">
                <div class="dstats-rank-name">${s.user_name}</div>
                ${deptName ? `<div class="dstats-rank-dept" style="background:${deptColor}22;color:${deptColor}">${deptName}</div>` : ""}
            </div>
            <div class="dstats-rank-bar-wrap">
                <div class="dstats-rank-bar" style="width:${pct}%;background:${barColor}"></div>
            </div>
            <div class="dstats-rank-nums">
                <div class="dstats-rank-h">${s.total_hours.toFixed(1)}h</div>
                <div class="dstats-rank-s">${s.shifts_count} ${shiftsLabel}</div>
            </div>
        </div>`;
    }).join("");

    container.innerHTML = `
    <div class="dstats-wrap">
        <div class="dstats-banner">
            <div class="dstats-banner-month">${monthLabel}</div>
            <div class="dstats-banner-sub">${t("modal_detailed_stats")}</div>
        </div>
        <div class="dstats-kpi-row">
            ${kpis.map(k => `
            <div class="dstats-kpi ${k.cls}">
                <div class="dstats-kpi-header">
                    <div class="dstats-kpi-icon">${k.icon}</div>
                    ${k.dl}
                </div>
                <div class="dstats-kpi-val">${k.val}</div>
                <div class="dstats-kpi-label">${k.label}</div>
            </div>`).join("")}
        </div>
        <div class="dstats-section-label">${getLang() === "pl" ? "Ranking pracowników" : "Employee ranking"}</div>
        <div class="dstats-rank-list">${rankRows}</div>
    </div>`;

    openModal("modal-detailed-stats");
    staggerAnimate(Array.from(container.querySelectorAll(".dstats-rank-item")), "stagger-pop", 50);
}
