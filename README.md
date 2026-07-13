# FlowExpense 💸

A modern, dark-themed expense tracker built with **Flask + MySQL**, featuring role-based access (admin/user), a live dashboard with category analytics, and a **TypeScript** frontend.

## Features

- **Sign up / Sign in** — create a User or Admin account; passwords hashed with Werkzeug
- **Role-based access** — users record and review expenses; admins can also delete them and access the protected admin dashboard
- **Expense tracking** — title, amount (₹), category, date, and notes
- **Live dashboard** — total spent, item count, top category, and a Chart.js doughnut showing the category breakdown
- **Search & filter** — debounced keyword search plus category filtering, with expenses grouped by day (Today / Yesterday / date)
- **Modern UI** — dark glassmorphism theme with aurora background, gradient accents, and a colorblind-safe, contrast-validated category palette

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| Database | MySQL (`mysql-connector-python`) |
| Frontend | TypeScript → vanilla JS, Chart.js, Font Awesome |
| Styling | Hand-written CSS (no framework) |

## Getting Started

### Prerequisites

- Python 3.9+
- MySQL server running locally
- Node.js (only if you want to edit the TypeScript frontend)

### 1. Clone and install

```bash
git clone https://github.com/Jit23456/Expense-Tracker.git
cd Expense-Tracker

python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

### 2. Configure the database

Create a MySQL database (default name `py_use_db`), or point the app at your own using environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | *(empty)* | MySQL password |
| `DB_NAME` | `py_use_db` | Database name |
| `FLASK_SECRET_KEY` | dev placeholder | Session signing key — set a random string in production |
| `ADMIN_PASSWORD` | `admin123` | Seeded admin account password |
| `USER_PASSWORD` | `user123` | Seeded user account password |

Tables are created and default accounts are seeded automatically on first launch.

### 3. Run

```bash
python app.py
```

Open **http://127.0.0.1:5000** and sign in:

- Admin: `admin / admin123`
- User: `user / user123`

…or create your own account from the **Sign Up** tab.

## Frontend Development (TypeScript)

The browser loads the compiled `static/js/main.js`. To change frontend behavior, edit `src/main.ts` and rebuild:

```bash
npm install
npm run build    # compile once
npm run watch    # recompile on save
```

## Project Structure

```
├── app.py               # Flask app: routes, auth, REST API
├── passenger_wsgi.py    # cPanel/Passenger entry point
├── requirements.txt     # Python dependencies
├── src/main.ts          # TypeScript frontend source
├── tsconfig.json        # TS build config (outputs to static/js)
├── static/
│   ├── css/style.css    # Theme and components
│   └── js/main.js       # Compiled frontend (do not edit by hand)
└── templates/           # Jinja2 pages (dashboard, auth, services, contact)
```

## API Overview

All endpoints require a logged-in session.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/expenses` | user | List expenses (`?category=`, `?search=`) |
| `POST` | `/api/expenses` | user | Add an expense |
| `DELETE` | `/api/expenses/<id>` | admin | Delete an expense |
| `GET` | `/api/summary` | user | Totals and category breakdown |

## Deploying to cPanel

1. Create a MySQL database and user in **MySQL® Databases**.
2. Upload the project (without `venv/`, `node_modules/`, `.git/`) outside `public_html`.
3. In **Setup Python App**: startup file `passenger_wsgi.py`, entry point `application`.
4. Set the environment variables from the table above (real passwords and a random `FLASK_SECRET_KEY`).
5. Run `pip install -r requirements.txt` in the app's virtualenv and restart.

> ⚠️ Before hosting publicly: remove the demo credentials from the login page and consider restricting Admin self-registration.
