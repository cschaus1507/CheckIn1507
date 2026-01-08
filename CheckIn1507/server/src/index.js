import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS allowlist (CLIENT_ORIGIN can be comma-separated)
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = process.env.CLIENT_ORIGIN;
      if (!origin) return cb(null, true);
      if (!allowed) return cb(null, true);
      const allowList = allowed.split(",").map(s => s.trim()).filter(Boolean);
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
    values ($1, current_date)
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

function pickStatus(session) {
  if (session.clock_in_at && !session.clock_out_at) return "clocked_in";
  if (session.clock_in_at && session.clock_out_at) return "clocked_out";
  return "not_clocked_in";
}

// --- Student: clock in ---
app.post("/api/student/clock-in", async (req, res) => {
  try {
    const { studentId, subteam, workingOn } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);
    let session = await upsertTodaySession(studentId);

    // If already clocked in and not out, keep clock_in_at as-is
    const r = await pool.query(
      `
      update daily_sessions
         set clock_in_at = coalesce(clock_in_at, now()),
             clock_out_at = null,
             subteam = coalesce(nullif($2,''), subteam),
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

// --- Student: clock out ---
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
  try {
    const studentId = Number(req.params.id);
    await assertStudentActive(studentId);

    const r = await pool.query(
      `select * from daily_sessions where student_id=$1 and meeting_date=current_date`,
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
  const date = req.query.date || null; // YYYY-MM-DD optional
  const r = await pool.query(
    `
    with d as (select coalesce($1::date, current_date) as meeting_date)
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
  const { fullName, subteam } = req.body || {};
  if (!fullName || !String(fullName).trim()) return res.status(400).json({ error: "Missing fullName" });

  const r = await pool.query(
    `
    insert into students (full_name, subteam, is_active)
    values ($1, $2, true)
    on conflict (full_name) do update
      set subteam = excluded.subteam,
          is_active = true
    returning id, full_name, subteam, is_active
    `,
    [String(fullName).trim(), (subteam || "").trim() || null]
  );
  res.json({ student: r.rows[0] });
});


app.patch("/api/admin/students/:id", requireKey("MANAGER_KEY"), async (req, res) => {
  const studentId = Number(req.params.id);
  const { fullName, subteam, isActive } = req.body || {};
  if (!studentId) return res.status(400).json({ error: "Invalid id" });

  const r = await pool.query(
    `
    update students
       set full_name = coalesce(nullif($2,''), full_name),
           subteam = coalesce($3, subteam),
           is_active = coalesce($4, is_active)
     where id = $1
     returning id, full_name, subteam, is_active
    `,
    [
      studentId,
      fullName ? String(fullName).trim() : "",
      subteam === undefined ? null : (subteam === "" ? null : String(subteam).trim()),
      typeof isActive === "boolean" ? isActive : null
    ]
  );

  if (r.rowCount === 0) return res.status(404).json({ error: "Student not found" });
  res.json({ student: r.rows[0] });
});


const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server listening on ${port}`));
