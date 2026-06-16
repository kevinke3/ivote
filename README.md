# ElectroVote

A modern, secure **university electronic voting system**. Clean, minimalist
interface — pure white with soft blue accents, rounded cards, smooth shadows,
the [Outfit](https://fonts.google.com/specimen/Outfit) typeface and fully
responsive layouts.

- **Frontend** — plain HTML, CSS and JavaScript, one file per concern (`frontend/`).
- **Backend** — Flask JSON API that also serves the frontend (`backend/`).
- **Database** — SQLite, auto-created on first run (`instance/electrovote.db`).

## Features

- **Student & admin authentication** with hashed passwords and signed-cookie sessions.
- **One person, one vote** — enforced at the database level (unique constraint) and in the API.
- **Duplicate-vote prevention** with a race-condition-safe insert.
- **Election management** — create, edit, open/close and delete elections (admin).
- **Candidate management** — responsive candidate cards with positions, manifestos and photos.
- **Real-time results** — live-updating progress bars and percentages.
- **Admin dashboard** — live voting statistics (students, elections, active polls, votes).
- **Professional landing page** with About, Features and How It Works sections.

## Project structure

```
electrovote/
├── backend/
│   ├── app.py          # Flask app factory, JSON API, serves the frontend
│   ├── models.py       # SQLAlchemy models: User, Election, Candidate, Vote
│   └── seed.py         # Demo students, elections and candidates
├── frontend/
│   ├── index.html      # Landing page (About / Features / How It Works)
│   ├── login.html / register.html
│   ├── dashboard.html  # Student dashboard — list of elections
│   ├── vote.html       # Cast a vote (candidate cards)
│   ├── results.html    # Live results with progress bars
│   ├── admin.html      # Admin dashboard
│   ├── css/styles.css  # Design system
│   └── js/             # api.js, common.js, dashboard.js, vote.js, results.js, admin.js
├── instance/           # SQLite db (git-ignored, created at runtime)
└── requirements.txt
```

## Run locally

```bash
pip install -r requirements.txt
python -m backend.seed     # optional: load demo data
python -m backend.app
```

Then open http://localhost:5000.

A default admin is created automatically on first run even without seeding.

### Demo accounts

| Role    | Identifier | Password      |
| ------- | ---------- | ------------- |
| Admin   | `admin`    | `admin123`    |
| Student | `STU1001`  | `password123` |

> Other seeded students: `STU1002` … `STU1005` (all `password123`).

## API

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/api/register` | Create a student account |
| POST | `/api/login` | Sign in (student or admin) |
| POST | `/api/logout` | Sign out |
| GET | `/api/me` | Current user |
| GET | `/api/elections` | List elections (`?status=active`) |
| GET | `/api/elections/<id>` | Election detail + candidates |
| POST | `/api/elections` | Create election *(admin)* |
| PUT | `/api/elections/<id>` | Update election / status *(admin)* |
| DELETE | `/api/elections/<id>` | Delete election *(admin)* |
| POST | `/api/elections/<id>/candidates` | Add candidate *(admin)* |
| PUT | `/api/candidates/<id>` | Update candidate *(admin)* |
| DELETE | `/api/candidates/<id>` | Delete candidate *(admin)* |
| POST | `/api/elections/<id>/vote` | Cast a vote *(student, one per election)* |
| GET | `/api/elections/<id>/results` | Live results |
| GET | `/api/admin/stats` | Dashboard statistics *(admin)* |

Authentication uses Flask's signed-cookie sessions. Passwords are hashed with Werkzeug.

> Built as a university final-year project demonstration.
