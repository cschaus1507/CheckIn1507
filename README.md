# Warlocks 1507 Attendance
**Lockport Warlocks 1507 – Attendance & Task Tracking App**

CheckIn1507 is a full-stack web application built specifically for **FIRST Robotics Team 1507 (Lockport Warlocks)** to manage:

- Student attendance
- Mentor oversight & reporting
- Task assignment and progress tracking
- Roster management
- Safe yearly rollover between build seasons

The app is designed to be:
- **Simple for students**
- **Powerful for mentors**
- **Safe and controlled for administrators**
- **Reliable during a hectic build season**

---

## Core Features

### Student Features
- Clock **in / out** for meetings
- Join or leave tasks
- View tasks by subteam
- Comment on tasks
- Submit **attendance correction requests** if they forgot to clock in or out

---

### Mentor Features
- Live **attendance dashboard**
- Manual attendance entry (supports paper backfill)
- Approve or deny attendance correction requests
- Attendance reports
- Full task board control:
  - Assign students to tasks
  - Move tasks between columns
  - Archive / unarchive tasks
- Mobile-friendly task board (horizontal swipe + snap)

---

### Manager / Admin Features (`/manage`)
- Add or update students
- Assign subteams
- Activate / deactivate students
- **New Year / New Season rollover reset**

> ⚠️ The `/manage` page is intentionally **not linked** in the UI.  
> Navigate directly to `/manage`.

---

## App Structure
CheckIn1507/
├── client/ # React + Vite frontend
│ ├── src/
│ │ ├── pages/ # Student, Mentor, Manage pages
│ │ ├── components/ # Shared UI components
│ │ ├── api.js # API helper (access keys)
│ │ └── time.js # Eastern Time utilities
│ └── Dockerfile # Frontend Docker build
│
├── server/ # Node.js + Express backend
│ ├── src/
│ │ ├── index.js # Server entry + routes
│ │ └── db.js # PostgreSQL connection
│ └── Dockerfile # Backend Docker build
│
├── docker-compose.yml # Optional local setup
└── README.md
---
## Access Control & Roles

The app uses **simple key-based access** (no accounts or emails).

### Roles
- **Student** → no key required
- **Mentor** → requires `MENTOR_KEY`
- **Manager/Admin** → requires `MANAGER_KEY`

### How it works
- User is prompted once per session
- Keys are stored in `sessionStorage`
- Requests send the key as `x-access-key`

---

## Database (PostgreSQL)

### Key Tables
- `students`
- `daily_sessions` (attendance)
- `attendance_corrections`
- `tasks`
- `task_assignments`
- `task_comments`

### Timezone Handling
- All dates/times are handled in **America/New_York**
- PostgreSQL `DATE` fields are returned as strings to avoid UTC shift bugs
- Time inputs are minute-precision only

---

## Year Rollover (New Season Reset)

Available on the **/Manage** page.

### What it clears
- Attendance records
- Attendance correction requests
- Tasks
- Task assignments
- Task comments

### What it keeps
- Student roster
- Active/inactive status
- Subteams

### Safety Requirements (ALL must be true)
1. Valid `MANAGER_KEY`
2. Environment variable:
3. User must type **RESET** to confirm

The reset runs inside a database transaction (all-or-nothing).

---

## Docker Deployment (Recommended)

The app is designed to run **fully containerized**.

---

## Required Environment Variables

### Backend
DATABASE_URL=postgres://user:password@host:5432/dbname
MENTOR_KEY=your-mentor-key
MANAGER_KEY=your-manager-key
DATABASE_SSL=true
### Optional / Safety
ALLOW_YEAR_RESET=true
> Leave `ALLOW_YEAR_RESET` unset most of the year and enable it only during rollover.

---

## Docker Compose Example (Local Development)
```yaml
version: "3.9"

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: attendance1507
      POSTGRES_USER: warlocks
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"

  server:
    build: ./server
    environment:
      DATABASE_URL: postgres://warlocks:secret@db:5432/attendance1507
      MENTOR_KEY: mentor123
      MANAGER_KEY: manager123
      DATABASE_SSL: "false"
    ports:
      - "3001:3001"
    depends_on:
      - db

  client:
    build: ./client
    ports:
      - "3000:80"

###Tech Stack
Frontend: React, Vite, Tailwind CSS
Backend: Node.js, Express
Database: PostgreSQL
Deployment: Docker, Render

Auth: Key-based (school-friendly)



