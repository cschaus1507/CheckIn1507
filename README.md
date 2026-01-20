# Warlocks 1507 Attendance

**Student UI**
- Select name from dropdown
- Clock In / Clock Out (records date + time)
- Pick Subteam
- Buttons: **I need help** / **I need something to do**
- Field: what you're currently working on

**Mentor UI (different URL path)**
- **/mentor** dashboard:
  - who is clocked in / who isn't
  - summary of students who clicked **I need help** or **I need something to do**
  - student cards (click to view subteam + current work + recent sessions)
  - attendance reports (date range) with CSV export

> This build has **no authentication** - Anyone with the links can submit/view.

---

## Local Run

### 1) Database
Create Postgres and run:

```bash
psql "$DATABASE_URL" -f server/schema.sql
psql "$DATABASE_URL" -f server/seed.sql   # optional; edit names first
```

### 2) Server
```bash
cd server
cp .env.example .env
# set DATABASE_URL
npm install
npm run dev
```

### 3) Client
```bash
cd ../client
cp .env.example .env
# set VITE_API_URL (local server: http://localhost:3001)
npm install
npm run dev

---

## Deploy 
### Server (Web Service)
- Root Directory: `server`
- Build: `npm install`
- Start: `npm start`

Env vars:
- `DATABASE_URL` (Render internal DB URL)
- `DATABASE_SSL=true`
- `CLIENT_ORIGIN=<your client URL>`

### Client (Static Site)
- Root Directory: `client`
- Build: `npm install && npm run build`
- Publish: `dist`

Env var:
- `VITE_API_URL=<your server URL>`

## Access keys (privacy safeguard)
Set these on the **server** (Web Service env vars):
- `MENTOR_KEY` — required for /mentor and all /api/mentor calls
- `MANAGER_KEY` — required for /manage and all /api/admin calls

Mentors/managers will be prompted for the key in the browser. Keys are stored in `sessionStorage` (clears when the browser is closed).

## Tasks Board (/tasks)
- Stages: To Do → In Progress → Road Blocked → Done
- Filter chips by subteam
- Students can join/leave any task and post comments/notes.
- Mentors (with `MENTOR_KEY`) can create tasks, assign students, and move task stages.
- Stale indicator: tasks with no activity for 3+ days.

## Timezone
- All UI time/date displays are formatted for **America/New_York (Eastern)**.
- Server uses Eastern date for "today" computations.
