# 📅 GrafikApp — Employee Schedule Manager

A full-stack web application for managing employee work schedules, built as a portfolio project.

## Features

- 👔 **Manager** — create and edit shifts, manage employees, assign labels, approve/reject requests, view work hour statistics
- 👷 **Employee** — view personal schedule, submit leave/shift swap requests, receive notifications
- 📅 Monthly calendar view
- 🔐 JWT authentication with role-based access control

## Tech Stack

**Backend**
- Python / Flask
- SQLAlchemy (ORM)
- Flask-JWT-Extended
- SQLite

**Frontend**
- HTML / CSS / Vanilla JavaScript
- Fetch API

## Getting Started

### Prerequisites
- Python 3.10+
- pip

### Installation

1. Clone the repository
\`\`\`bash
git clone https://github.com/YOUR_USERNAME/grafikapp.git
cd grafikapp
\`\`\`

2. Create and activate a virtual environment
\`\`\`bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
\`\`\`

3. Install dependencies
\`\`\`bash
pip install -r backend/requirements.txt
\`\`\`

4. Run the backend server
\`\`\`bash
cd backend
python app.py
\`\`\`

5. Open `frontend/index.html` in your browser

### Test Credentials

After the first run, a default manager account is created automatically:

| Field    | Value               |
|----------|---------------------|
| Email    | manager@test.com    |
| Password | admin123            |

## Project Structure

\`\`\`
├── backend/
│   ├── app.py              # App factory, blueprint registration
│   ├── config.py           # Configuration (DB, JWT secrets)
│   ├── models.py           # SQLAlchemy models
│   └── routes/
│       ├── auth.py         # Login, JWT
│       ├── users.py        # Employee & label management
│       ├── shifts.py       # Shift CRUD
│       ├── requests.py     # Leave & swap requests
│       ├── notifications.py
│       └── stats.py        # Work hour statistics
└── frontend/
    ├── index.html          # Login page
    ├── dashboard.html      # Main app
    └── assets/
        ├── css/
        │   └── style.css
        └── js/
            ├── api.js      # Fetch wrapper, JWT handling
            ├── auth.js     # Login logic
            └── dashboard.js # Calendar, views, modals
\`\`\`

## Roadmap

- [ ] Edit and delete shifts from calendar
- [ ] Employee profile page
- [ ] Export schedule to PDF
- [ ] Dark/light theme toggle
- [ ] Mobile responsive layout
   