# ⚡ CheckIn1507  
**Lockport Warlocks 1507 – Attendance & Task Tracking App**

CheckIn1507 is a full-stack web application built specifically for **FIRST Robotics Team 1507 (Lockport Warlocks)**, with the assistance of AI, to manage attendance, tasks, and roster data throughout the build season.

The app is designed to be:
- **Simple for students**
- **Powerful for mentors**
- **Safe and controlled for administrators**
- **Reliable during high-stress build weeks**

---

# Docker Deployment (START HERE)

This application is designed to run **fully containerized** using Docker.  
This is the **recommended and supported deployment method**.

---

## Required Environment Variables

### Backend (REQUIRED)

```
DATABASE_URL=postgres://user:password@host:5432/dbname
MENTOR_KEY=your-mentor-access-key
MANAGER_KEY=your-manager-access-key
DATABASE_SSL=true
```

### Optional / Safety (Recommended)

```
ALLOW_YEAR_RESET=true
```

> ⚠️ Leave `ALLOW_YEAR_RESET` **unset or false** most of the year.  
> Enable it only when performing a season rollover.

---

## Docker Compose (Local Development Example)

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
```

---

## Deploying on Render (Recommended Production Setup)

### Backend Service
- Service Type: **Web Service**
- Runtime: **Docker**
- Root Directory: `/`
- Dockerfile Path: `server/Dockerfile`
- Add all backend environment variables in Render

### Frontend Service
- Service Type: **Web Service**
- Runtime: **Docker**
- Dockerfile Path: `client/Dockerfile`

> The frontend uses **Nginx with SPA fallback**, so routes like  
> `/mentor`, `/tasks`, `/manage` will NOT 404.

---

## New Year / New Season Rollover

Available on the **Manage** page (`/manage`).

### What the rollover clears
- Attendance records
- Attendance correction requests
- Tasks
- Task assignments
- Task comments

### What it preserves
- Student roster
- Active / inactive status
- Subteams

### Safety Requirements (ALL must be true)
1. Valid `MANAGER_KEY`
2. Environment variable:
   ```
   ALLOW_YEAR_RESET=true
   ```
3. User must type **RESET** to confirm

---

# Core App Features

## Student Features
- Clock **in / out** for meetings
- Join or leave tasks
- View tasks by subteam
- Comment on tasks
- Submit **attendance correction requests**

## Mentor Features
- Attendance dashboard
- Manual attendance entry
- Approve or deny corrections
- Task board management
- Mobile-friendly UI

## Manager Features
- Manage roster
- Activate/deactivate students
- Perform year rollover

---

# Project Structure

```
CheckIn1507/
├── client/
├── server/
├── docker-compose.yml
└── README.md
```

---

# Tech Stack
- React + Vite
- Node.js + Express
- PostgreSQL
- Docker + Render

---

**Go Warlocks ⚡🤖**
