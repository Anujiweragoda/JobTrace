<<<<<<< HEAD
# JobTrace
=======
# Job Tracker (JobTrace)

A personal job-application tracker: Kanban pipeline, full job-description storage,
timeline, search, follow-up reminders, CV version tracking, and analytics.

Built from the "Version 1 + Version 2" scope of the original feature plan —
everything except the AI-powered features (JD import/summarization, CV↔JD
matching, interview prep) and the browser extension, which were left for a
later pass.

## Stack

- **Backend**: Node.js + Express + TypeScript, using Node's built-in
  `node:sqlite` module — there's no separate database to install. The
  database file is created automatically at `backend/data/job-tracker.db`
  the first time you run it.
- **Frontend**: React + TypeScript + Vite, plain CSS (no UI framework).

## Running it

You need Node.js 22.5+ installed (for built-in SQLite support).

**1. Backend** (in one terminal):
```bash
cd backend
npm install
npm run dev
```
This starts the API on `http://localhost:4000`.

**2. Frontend** (in a second terminal):
```bash
cd frontend
npm install
npm run dev
```
This starts the app on `http://localhost:5173` and proxies `/api` requests
to the backend automatically — open that URL in your browser.

To build the frontend for production: `npm run build` inside `frontend/`
(output goes to `frontend/dist`). To build the backend: `npm run build`
inside `backend/` (output goes to `backend/dist`, then run with
# Job Tracker (JobTrace)

A personal job-application tracker: Kanban pipeline, full job-description storage,
timeline, search, follow-up reminders, CV version tracking, and analytics.

Built from the "Version 1 + Version 2" scope of the original feature plan —
everything except the AI-powered features (JD import/summarization, CV↔JD
matching, interview prep) and the browser extension, which were left for a
later pass.

## Stack

- **Backend**: Node.js + Express + TypeScript, using Node's built-in
  `node:sqlite` module — there's no separate database to install. The
  database file is created automatically at `backend/data/job-tracker.db`
  the first time you run it.
- **Frontend**: React + TypeScript + Vite, plain CSS (no UI framework).

## Running it

You need Node.js 22.5+ installed (for built-in SQLite support).

**1. Backend** (in one terminal):
```bash
cd backend
npm install
npm run dev
```
This starts the API on `http://localhost:4000`.

**2. Frontend** (in a second terminal):
```bash
cd frontend
npm install
npm run dev
```
This starts the app on `http://localhost:5173` and proxies `/api` requests
to the backend automatically — open that URL in your browser.

To build the frontend for production: `npm run build` inside `frontend/`
(output goes to `frontend/dist`). To build the backend: `npm run build`
inside `backend/` (output goes to `backend/dist`, then run with
`npm start`).

## Features included

**Dashboard**
- Stat cards: total, applied, interviews, rejected, offers
- Kanban board with drag-and-drop across Saved → Applied → Screening →
  Interview → Offer → Rejected

**Applications**
- Add / edit / delete, with company, position, location, salary,
  employment type, source, job URL, deadline, interview date, skills,
  requirements, and the **full original job description** so you never
  have to go hunting for the original ad again
- Search across company, title, location, skills, description, and notes
- Filter by status and by source

**Application detail view**
- Overview tab (all the structured fields)
- Full job description tab
- Timeline tab — every status change is logged automatically, and you can
  add your own events (e.g. "Recruiter called")

**Follow-ups**
- Moving an application to "Applied" automatically schedules a 7-day
  follow-up reminder
- A computed "health" indicator per application: Active / Needs follow-up
  (7+ days quiet) / No response 14+ days / Interview coming up

**CV versions**
- Track your different tailored CVs (name + tag, e.g. "AI Research"),
  attach the one you used to each application

**Analytics**
- Total applications, interviews, offers, interview rate
- Breakdown by source, by employment type, by status

## Not included (left for a later version)

- AI-powered job-description import/summarization and CV↔JD matching
- Interview-preparation generator
- Browser extension for "Save to Job Tracker"
- File upload/storage for actual CV/cover-letter PDFs (CV versions are
  tracked by name/tag only in this version)
- User accounts / login (this is a single-user local app)

## Project structure

```
job-tracker/
├── backend/
│   ├── src/
│   │   ├── index.ts        # Express app entrypoint
│   │   ├── db.ts            # SQLite schema + connection
│   │   ├── types.ts
│   │   ├── utils.ts         # health-indicator logic, JSON helpers
│   │   └── routes/
│   │       ├── applications.ts
│   │       ├── reminders.ts
│   │       ├── cvVersions.ts
│   │       └── analytics.ts
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts            # fetch wrapper for the backend API
    │   ├── types.ts
    │   └── components/
    │       ├── Sidebar.tsx
    │       ├── Dashboard.tsx
    │       ├── KanbanBoard.tsx
    │       ├── ApplicationsList.tsx
    │       ├── ApplicationModal.tsx
    │       ├── ApplicationDetailModal.tsx
    │       ├── FollowUps.tsx
    │       ├── Analytics.tsx
    │       ├── CvVersions.tsx
    │       └── Badges.tsx
    └── package.json
```
