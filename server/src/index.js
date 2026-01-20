import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { pool } from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EASTERN_TZ = "America/New_York";

const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS allowlist (CLIENT_ORIGIN can be comma-separated)
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = process.env.CLIENT_ORIGIN;
      if (!origin) return cb(null, true);
      if (!allowed) return cb(null, true);
      const allowList = allowed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowList.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked for origin: " + origin));
    }
  })
);

app.get("/health", (_, res) => res.json({ ok: true }));

// --- Roster for dropdown ---
app.get("/api/students", async (_req, res) => {
  const r = await pool.query(
    `select id, full_name, subteam
     from students
     where is_active=true
     order by full_name asc`
  );
  res.json({ students: r.rows });
});

// --- Helper: get or create today's session row ---
async function upsertTodaySession(studentId) {
  const r = await pool.query(
    `
    insert into daily_sessions (student_id, meeting_date)
    values ($1, (timezone('America/New_York', now()))::date)
    on conflict (student_id, meeting_date) do update
      set updated_at = now()
    returning *
    `,
    [studentId]
  );
  return r.rows[0];
}

async function assertStudentActive(studentId) {
  const s = await pool.query(`select id from students where id=$1 and is_active=true`, [studentId]);
  if (s.rowCount === 0) {
    const err = new Error("Student not found");
    err.status = 404;
    throw err;
  }
}

function requireKey(envName) {
  return (req, res, next) => {
    const expected = process.env[envName];
    if (!expected) return res.status(500).json({ error: `${envName} not configured` });

    const provided = req.headers["x-access-key"];
    if (provided !== expected) return res.status(403).json({ error: "Access denied" });

    next();
  };
}

function easternDateSql() {
  return "(timezone('America/New_York', now()))::date";
}

async function autoCloseOldSessions() {
  // If a student forgets to clock out, auto clock-out at exactly 4 hours after clock-in.
  await pool.query(`
    update daily_sessions
       set clock_out_at = clock_in_at + interval '4 hours',
           updated_at = now()
     where clock_in_at is not null
       and clock_out_at is null
       and clock_in_at < now() - interval '4 hours'
  `);
}

function pickStatus(session) {
  if (session.clock_in_at && !session.clock_out_at) return "clocked_in";
  if (session.clock_in_at && session.clock_out_at) return "clocked_out";
  return "not_clocked_in";
}

// --- Student: clock in ---
app.post("/api/student/clock-in", async (req, res) => {
  try {
    const { studentId, subteam, workingOn, taskId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);
    await autoCloseOldSessions();

    let session = await upsertTodaySession(studentId);

    const r = await pool.query(
      `
      update daily_sessions
         set clock_in_at = coalesce(clock_in_at, now()),
             clock_out_at = null,
             subteam = coalesce(nullif($2,''), subteam),
             working_on = coalesce($3, working_on),
             task_id = coalesce($4::bigint, task_id),
             updated_at = now()
       where id = $1
       returning *
      `,
      [session.id, subteam || "", workingOn ?? null, taskId ?? null]
    );

    if (taskId) {
      // ✅ Idempotent insert: prevents student being both "assigned" and "joined" as duplicates
      await pool.query(
        `
        insert into task_assignments (task_id, student_id)
        values ($1, $2)
        on conflict (task_id, student_id) where unassigned_at is null do nothing
        `,
        [taskId, studentId]
      );

      // If task is still To Do, bump to In Progress automatically. Otherwise keep current status.
      await pool.query(
        `
        update tasks
           set status = case when status = 'todo' then 'in_progress' else status end,
               updated_at = now()
         where id = $1
        `,
        [taskId]
      );
    }

    res.json({ session: r.rows[0], status: pickStatus(r.rows[0]) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/student/clock-out", async (req, res) => {
  try {
    const { studentId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);
    let session = await upsertTodaySession(studentId);

    const r = await pool.query(
      `
      update daily_sessions
         set clock_out_at = now(),
             updated_at = now()
       where id = $1
       returning *
      `,
      [session.id]
    );

    res.json({ session: r.rows[0], status: pickStatus(r.rows[0]) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

// --- Student: update subteam / working on ---
app.post("/api/student/update", async (req, res) => {
  try {
    const { studentId, subteam, workingOn } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);
    let session = await upsertTodaySession(studentId);

    const r = await pool.query(
      `
      update daily_sessions
         set subteam = coalesce(nullif($2,''), subteam),
             working_on = coalesce($3, working_on),
             updated_at = now()
       where id = $1
       returning *
      `,
      [session.id, subteam || "", workingOn ?? null]
    );

    res.json({ session: r.rows[0], status: pickStatus(r.rows[0]) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

// --- Student: need help / need task toggles ---
app.post("/api/student/need", async (req, res) => {
  try {
    const { studentId, type, value } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });
    if (!["help", "task"].includes(type)) return res.status(400).json({ error: "Invalid type" });

    await assertStudentActive(studentId);
    let session = await upsertTodaySession(studentId);

    const col = type === "help" ? "need_help" : "need_task";
    const colAt = type === "help" ? "need_help_at" : "need_task_at";

    const r = await pool.query(
      `
      update daily_sessions
         set ${col} = $2,
             ${colAt} = case when $2 = true then now() else null end,
             updated_at = now()
       where id = $1
       returning *
      `,
      [session.id, !!value]
    );

    res.json({ session: r.rows[0], status: pickStatus(r.rows[0]) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

// --- Student: get today's session (for UI state) ---
app.get("/api/student/today/:id", async (req, res) => {
  await autoCloseOldSessions();
  try {
    const studentId = Number(req.params.id);
    await assertStudentActive(studentId);

    const r = await pool.query(
      `select * from daily_sessions where student_id=$1 and meeting_date=(timezone('America/New_York', now()))::date`,
      [studentId]
    );

    const session = r.rows[0] || null;
    res.json({ session, status: session ? pickStatus(session) : "not_clocked_in" });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

// --- Mentor: current status board ---
app.get("/api/mentor/status", requireKey("MENTOR_KEY"), async (req, res) => {
  await autoCloseOldSessions();
  const date = req.query.date || null; // YYYY-MM-DD optional
  const r = await pool.query(
    `
    with d as (select coalesce($1::date, (timezone('America/New_York', now()))::date) as meeting_date)
    select
      s.id as student_id,
      s.full_name,
      coalesce(ds.subteam, s.subteam) as subteam,
      ds.meeting_date,
      ds.clock_in_at,
      ds.clock_out_at,
      ds.working_on,
      ds.need_help,
      ds.need_task,
      ds.need_help_at,
      ds.need_task_at,
      ds.updated_at
    from students s
    cross join d
    left join daily_sessions ds
      on ds.student_id = s.id
     and ds.meeting_date = d.meeting_date
    where s.is_active=true
    order by s.full_name asc
    `,
    [date]
  );

  res.json({ rows: r.rows });
});

// --- Mentor: student card ---
app.get("/api/mentor/student/:id", requireKey("MENTOR_KEY"), async (req, res) => {
  await autoCloseOldSessions();
  const studentId = Number(req.params.id);

  const s = await pool.query(`select id, full_name, subteam from students where id=$1`, [studentId]);
  if (s.rowCount === 0) return res.status(404).json({ error: "Student not found" });

  const sessions = await pool.query(
    `select * from daily_sessions where student_id=$1 order by meeting_date desc limit 30`,
    [studentId]
  );

  res.json({ student: s.rows[0], sessions: sessions.rows });
});

// --- Mentor: attendance report (date range) ---
app.get("/api/mentor/report", requireKey("MENTOR_KEY"), async (req, res) => {
  await autoCloseOldSessions();
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "Missing start/end (YYYY-MM-DD)" });

  const r = await pool.query(
    `
    with range_sessions as (
      select s.id as student_id, s.full_name, s.subteam,
             ds.meeting_date, ds.clock_in_at, ds.clock_out_at
      from students s
      left join daily_sessions ds
        on ds.student_id = s.id
       and ds.meeting_date between $1::date and $2::date
      where s.is_active=true
    ),
    totals as (
      select student_id, full_name, subteam,
             count(meeting_date) filter (where clock_in_at is not null) as days_clocked_in,
             max(meeting_date) filter (where clock_in_at is not null) as last_day
      from range_sessions
      group by student_id, full_name, subteam
    ),
    hours as (
      select student_id,
             sum(
               extract(epoch from (coalesce(clock_out_at, clock_in_at) - clock_in_at))
             ) / 3600.0 as hours_total
      from range_sessions
      where clock_in_at is not null
      group by student_id
    )
    select t.*,
           round(coalesce(h.hours_total, 0)::numeric, 2) as hours_total
    from totals t
    left join hours h on h.student_id = t.student_id
    order by t.full_name
    `,
    [start, end]
  );

  res.json({ rows: r.rows });
});

/* ---------------- Tasks (public board + mentor controls) ----------------
   - GET endpoints are public
   - Write endpoints require MENTOR_KEY via x-access-key
   - Students can join/leave tasks and post comments when they select their name
*/

app.get("/api/tasks", async (req, res) => {
  try {
    const subteam = (req.query.subteam || "").trim();
    const status = (req.query.status || "").trim();
    const includeArchived = String(req.query.includeArchived || "").toLowerCase() === "true";

    const filters = [];
    const params = [];
    let i = 1;

    if (subteam) {
      filters.push(`t.subteam = $${i++}`);
      params.push(subteam);
    }
    if (status) {
      filters.push(`t.status = $${i++}`);
      params.push(status);
    }

    // Default: hide archived unless explicitly requested
    if (!includeArchived) {
      filters.push(`t.archived = false`);
    }

    const where = filters.length ? `where ${filters.join(" and ")}` : "";

    const r = await pool.query(
      `
      with last_comment as (
        select task_id, max(created_at) as last_comment_at
        from task_comments
        group by task_id
      ),
      last_assign as (
        select task_id, max(assigned_at) as last_assigned_at
        from task_assignments
        where unassigned_at is null
        group by task_id
      )
      select
        t.id,
        t.title,
        t.subteam,
        t.status,
        t.description,
        t.archived,
        t.created_at,
        t.updated_at,
        greatest(
          t.updated_at,
          coalesce(lc.last_comment_at, 'epoch'::timestamptz),
          coalesce(la.last_assigned_at, 'epoch'::timestamptz)
        ) as last_activity_at,
        (
          greatest(
            t.updated_at,
            coalesce(lc.last_comment_at, 'epoch'::timestamptz),
            coalesce(la.last_assigned_at, 'epoch'::timestamptz)
          ) < now() - interval '3 days'
        ) as is_stale,
        coalesce(assignees.assignees, '[]'::json) as assignees
      from tasks t
      left join last_comment lc on lc.task_id = t.id
      left join last_assign la on la.task_id = t.id
      left join lateral (
        select json_agg(json_build_object('student_id', s.id, 'full_name', s.full_name) order by s.full_name) as assignees
        from task_assignments ta
        join students s on s.id = ta.student_id
        where ta.task_id = t.id and ta.unassigned_at is null
      ) assignees on true
      ${where}
      order by
        case t.status
          when 'todo' then 1
          when 'in_progress' then 2
          when 'blocked' then 3
          when 'done' then 4
          else 5
        end,
        t.updated_at desc
      `,
      params
    );

    res.json({ tasks: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.get("/api/tasks/:id/comments", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const r = await pool.query(
      `
      select id, task_id, author_type, author_label, comment, created_at
      from task_comments
      where task_id = $1
      order by created_at asc
      `,
      [taskId]
    );
    res.json({ comments: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/tasks/:id/comments", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { authorType, authorLabel, studentId, comment } = req.body || {};
    if (!comment || !String(comment).trim()) return res.status(400).json({ error: "Missing comment" });

    let finalType = authorType;
    let finalLabel = authorLabel;

    if (studentId) {
      const s = await pool.query(`select full_name from students where id=$1`, [studentId]);
      if (s.rowCount === 0) return res.status(404).json({ error: "Student not found" });
      finalType = "student";
      finalLabel = s.rows[0].full_name;
    } else {
      finalType = finalType === "mentor" ? "mentor" : "mentor";
      finalLabel = finalLabel && String(finalLabel).trim() ? String(finalLabel).trim() : "Mentor";
    }

    const r = await pool.query(
      `
      insert into task_comments (task_id, author_type, author_label, comment)
      values ($1, $2, $3, $4)
      returning id, task_id, author_type, author_label, comment, created_at
      `,
      [taskId, finalType, finalLabel, String(comment).trim()]
    );

    await pool.query(`update tasks set updated_at=now() where id=$1`, [taskId]);

    res.json({ comment: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/tasks/:id/join", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { studentId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);

    // ✅ Idempotent / no duplicates even if mentor assigned + student joined
    await pool.query(
      `
      insert into task_assignments (task_id, student_id)
      values ($1, $2)
      on conflict (task_id, student_id) where unassigned_at is null do nothing
      `,
      [taskId, studentId]
    );

    await pool.query(`update tasks set updated_at=now() where id=$1`, [taskId]);

    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/tasks/:id/leave", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { studentId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await pool.query(
      `
      update task_assignments
         set unassigned_at = now()
       where task_id = $1 and student_id = $2 and unassigned_at is null
      `,
      [taskId, studentId]
    );

    await pool.query(`update tasks set updated_at=now() where id=$1`, [taskId]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// Mentor-only task creation and status updates
app.post("/api/tasks", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const { title, subteam, description, status } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: "Missing title" });
    if (!subteam || !String(subteam).trim()) return res.status(400).json({ error: "Missing subteam" });

    const st = status && ["todo", "in_progress", "blocked", "done"].includes(status) ? status : "todo";

    const r = await pool.query(
      `
      insert into tasks (title, subteam, status, description)
      values ($1, $2, $3, $4)
      returning *
      `,
      [String(title).trim(), String(subteam).trim(), st, String(description || "").trim()]
    );

    res.json({ task: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.patch("/api/tasks/:id", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { title, subteam, description, status } = req.body || {};

    const st = status && ["todo", "in_progress", "blocked", "done"].includes(status) ? status : null;

    const r = await pool.query(
      `
      update tasks
         set title = coalesce(nullif($2,''), title),
             subteam = coalesce(nullif($3,''), subteam),
             description = coalesce($4, description),
             status = coalesce($5, status),
             updated_at = now()
       where id = $1
       returning *
      `,
      [
        taskId,
        title ? String(title).trim() : "",
        subteam ? String(subteam).trim() : "",
        description === undefined ? null : String(description),
        st
      ]
    );

    if (r.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    res.json({ task: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ✅ Archive / Unarchive (mentor only)
app.post("/api/tasks/:id/archive", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const r = await pool.query(
      `update tasks set archived=true, updated_at=now() where id=$1 returning *`,
      [taskId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    res.json({ task: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/tasks/:id/unarchive", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const r = await pool.query(
      `update tasks set archived=false, updated_at=now() where id=$1 returning *`,
      [taskId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    res.json({ task: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/tasks/:id/assign", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { studentId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);

    // ✅ Idempotent assignment (same rule as join)
    await pool.query(
      `
      insert into task_assignments (task_id, student_id)
      values ($1, $2)
      on conflict (task_id, student_id) where unassigned_at is null do nothing
      `,
      [taskId, studentId]
    );

    await pool.query(`update tasks set updated_at=now() where id=$1`, [taskId]);

    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

/* ---------------- Admin: Manage roster ----------------
   Protected by MANAGER_KEY via x-access-key header.
   Endpoints:
   - GET    /api/admin/students
   - POST   /api/admin/students
   - PATCH  /api/admin/students/:id
*/

app.get("/api/admin/students", requireKey("MANAGER_KEY"), async (_req, res) => {
  const r = await pool.query(
    `select id, full_name, subteam, is_active
     from students
     order by full_name asc`
  );
  res.json({ students: r.rows });
});

app.post("/api/admin/students", requireKey("MANAGER_KEY"), async (req, res) => {
  const { full_name, subteam } = req.body || {};
  if (!full_name) return res.status(400).json({ error: "Missing full_name" });

  const r = await pool.query(
    `insert into students (full_name, subteam)
     values ($1, $2)
     on conflict (full_name) do update set subteam=excluded.subteam
     returning *`,
    [String(full_name).trim(), subteam ? String(subteam).trim() : null]
  );
  res.json({ student: r.rows[0] });
});

app.patch("/api/admin/students/:id", requireKey("MANAGER_KEY"), async (req, res) => {
  const id = Number(req.params.id);
  const { full_name, subteam, is_active } = req.body || {};

  const r = await pool.query(
    `
    update students
       set full_name = coalesce(nullif($2,''), full_name),
           subteam = coalesce($3, subteam),
           is_active = coalesce($4, is_active)
     where id = $1
     returning *
    `,
    [id, full_name ? String(full_name).trim() : "", subteam ?? null, is_active ?? null]
  );

  if (r.rowCount === 0) return res.status(404).json({ error: "Student not found" });
  res.json({ student: r.rows[0] });
});

/* ---------------- Serve client (built assets) ---------------- */

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server listening on", PORT));
