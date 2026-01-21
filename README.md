# Warlocks 1507 Attendance

Lockport Warlocks 1507 – Attendance & Task Tracking App

A full-stack web application built for FIRST Robotics Team 1507 (Lockport Warlocks) to manage:

Student attendance

Mentor oversight & reports

Task assignment and progress tracking

Roster management

Safe yearly rollover for new build seasons

Designed to be simple for students, powerful for mentors, and safe for administrators.

🧩 Core Features
👩‍🎓 Student Features

Clock in/out for meetings

Join or leave tasks

View task board by subteam

Comment on tasks

Submit attendance correction requests if they forgot to clock in/out

🧑‍🏫 Mentor Features

Live attendance dashboard

Manual attendance entry (paper backfill supported)

Approve or deny attendance correction requests

View attendance reports

Full task board control:

Assign students

Move tasks between columns

Archive / unarchive tasks

Mobile-friendly task board (horizontal swipe + snap)

🧑‍💼 Manager / Admin Features (/manage)

Add or update students

Assign subteams

Activate / deactivate students

Year rollover reset (clears attendance + tasks, keeps roster)

⚠️ The /manage page is intentionally not linked in the UI.
Access it directly at /manage.

🧠 App Structure Overview
CheckIn1507/
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── pages/        # Student, Mentor, Manage pages
│   │   ├── components/   # Reusable UI components
│   │   ├── api.js        # API helper (handles access keys)
│   │   └── time.js       # Eastern Time utilities
│   └── Dockerfile        # Frontend build container
│
├── server/               # Node.js + Express backend
│   ├── src/
│   │   ├── index.js      # Main server entry + routes
│   │   └── db.js         # PostgreSQL connection
│   └── Dockerfile        # Backend container
│
├── docker-compose.yml    # Optional local orchestration
└── README.md

🔐 Access Control & Roles

The app uses key-based access via HTTP headers.

Keys

Student → no key required

Mentor → MENTOR_KEY

Manager/Admin → MANAGER_KEY

Keys are:

Prompted for once per session

Stored in sessionStorage

Sent as x-access-key header on protected requests

🗄️ Database (PostgreSQL)
Key Tables

students

daily_sessions (attendance)

attendance_corrections

tasks

task_assignments

task_comments

Year Rollover Behavior

The year reset clears:

Attendance

Attendance corrections

Tasks & task data

It keeps:

Student roster

Active status

Subteams

🔄 Year Rollover (New Season Reset)

Accessible from /manage.

Safety Requirements (ALL must be true)

Valid MANAGER_KEY

Environment variable:

ALLOW_YEAR_RESET=true


User must type RESET to confirm

What it does

TRUNCATEs attendance + task tables

Preserves students

Resets IDs cleanly

Runs inside a DB transaction (all-or-nothing)

🐳 Docker Deployment (Recommended)

This app is designed to run fully containerized.

Environment Variables (Required)
Backend
DATABASE_URL=postgres://user:pass@host:5432/dbname
MENTOR_KEY=your-mentor-key
MANAGER_KEY=your-manager-key
DATABASE_SSL=true

Optional / Safety
ALLOW_YEAR_RESET=true

🐋 Dockerfiles
Backend (server/Dockerfile)

Node.js 20

Express API

PostgreSQL client

Production-ready

Frontend (client/Dockerfile)

Node.js 20

Vite build

Static output served via Nginx

SPA fallback for React routing

▶️ Example: Docker Compose (Local Dev)
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

☁️ Deploying on Render (Recommended)
1️⃣ Backend

Type: Web Service

Runtime: Docker

Root directory: /

Dockerfile path: server/Dockerfile

Add env vars in Render dashboard

2️⃣ Frontend

Type: Web Service

Runtime: Docker

Dockerfile path: client/Dockerfile

React routing is handled via Nginx fallback — routes like /mentor, /manage, /tasks will not 404.

🕒 Timezone Handling

All dates and times are handled in America/New_York

PostgreSQL DATE fields are returned as strings to avoid UTC shift bugs

Time inputs use minute-precision only (step="60")

📱 Mobile Support

Responsive layouts throughout

Task board supports:

Horizontal swipe

Column snap

Accessible mentor controls on small screens

🛠️ Tech Stack

Frontend: React, Vite, TailwindCSS

Backend: Node.js, Express

Database: PostgreSQL

Deployment: Docker, Render

Auth: Key-based (simple & school-friendly)
