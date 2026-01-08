# Warlocks 1507 Attendance + Status (No Login)

**Student UI**
- Select name from dropdown
- Clock In / Clock Out (records date + time)
- Pick Subteam
- Buttons: **I need help** / **I need something to do**
- Field: what you're currently working on
- Blue & Yellow Warlocks aesthetic with subtle lightning accents

**Mentor UI (different URL path)**
- **/mentor** dashboard:
  - who is clocked in / who isn't
  - summary of students who clicked **I need help** or **I need something to do**
  - student cards (click to view subteam + current work + recent sessions)
  - attendance reports (date range) with CSV export

> This build has **no authentication** (as requested). Anyone with the links can submit/view.

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
```

Student UI: http://localhost:5173/  
Mentor UI: http://localhost:5173/mentor

---

## Deploy (Render quick notes)

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

### Different URL for mentors
Simplest: use the built-in route:
- `https://your-client.onrender.com/mentor`

If you truly want a *separate* URL (ex: mentor-warlocks.onrender.com):
- Create a second Render Static Site pointing at the same `client/` root
- (Optional) set a Redirect Rule to `/mentor` as the default.


## Access keys (privacy safeguard)
Set these on the **server** (Render Web Service env vars):
- `MENTOR_KEY` — required for /mentor and all /api/mentor calls
- `MANAGER_KEY` — required for /manage and all /api/admin calls

Mentors/managers will be prompted for the key in the browser. Keys are stored in `sessionStorage` (clears when the browser is closed).
