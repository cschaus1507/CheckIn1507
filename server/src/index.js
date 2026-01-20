import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";

const app = express();
app.use(express.json());

// CORS (dev convenience); when deployed as single-origin, this is effectively irrelevant
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

function requireKey(envName) {
  return (req, res, next) => {
    const expected = process.env[envName];
    if (!expected) return res.status(500).json({ error: `${envName} not set` });

    const provided =
      req.headers["x-app-key"] ||
      req.headers["x-api-key"] ||
      req.query.key ||
      (req.body && req.body.key);

    if (String(provided || "") !== String(expected)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };
}

async function assertStudentActive(studentId) {
  const r = await pool.query(`select id, is_active from students where id=$1`, [studentId]);
  if (!r.rows.length) {
    const e = new Error("Student not found");
    e.status = 404;
    throw e;
  }
  if (!r.rows[0].is_active) {
    const e = new Error("Student is inactive");
    e.status = 400;
    throw e;
  }
}

/* -------------------- Students -------------------- */

app.get("/api/students", async (req, res) => {
  try {
    const r = await pool.query(
      `
      select id, full_name, subteam, is_active, created_at
      from students
      order by full_name asc
      `
    );
    res.json({ students: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/students", requireKey("MANAGER_KEY"), async (req, res) => {
  try {
    const { full_name, subteam } = req.body || {};
    if (!full_name || !String(full_name).trim()) return res.status(400).json({ error: "Missing full_name" });
    if (!subteam || !String(subteam).trim()) return res.status(400).json({ error: "Missing subteam" });

    const r = await pool.query(
      `insert into students (full_name, subteam) values ($1,$2) returning id, full_name, subteam, is_active, created_at`,
      [String(full_name).trim(), String(subteam).trim()]
    );
    res.json({ student: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.patch("/api/students/:id", requireKey("MANAGER_KEY"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { full_name, subteam, is_active } = req.body || {};

    const r = await pool.query(
      `
      update students
         set full_name = coalesce($2, full_name),
             subteam = coalesce($3, subteam),
             is_active = coalesce($4, is_active)
       where id = $1
       returning id, full_name, subteam, is_active, created_at
      `,
      [
        id,
        full_name !== undefined ? String(full_name).trim() : null,
        subteam !== undefined ? String(subteam).trim() : null,
        is_active !== undefined ? !!is_active : null
      ]
    );

    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ student: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

/* -------------------- Checkins -------------------- */

app.post("/api/checkin", async (req, res) => {
  try {
    const { studentId, role } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);

    const r = await pool.query(
      `
      insert into checkins (student_id, role)
      values ($1, $2)
      returning id, student_id, role, created_at
      `,
      [Number(studentId), role === "mentor" ? "mentor" : "student"]
    );

    res.json({ checkin: r.rows[0] });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

app.get("/api/checkins/today", async (req, res) => {
  try {
    const r = await pool.query(
      `
      select c.id, c.student_id, s.full_name, s.subteam, c.role, c.created_at
      from checkins c
      join students s on s.id = c.student_id
      where c.created_at >= date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'
      order by c.created_at desc
      `
    );
    res.json({ checkins: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

/* -------------------- Tasks -------------------- */

/*
   TASKS:
   - Mentors can create and move tasks through columns.
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
        group by task_id
      )
      select
        t.id,
        t.title,
        t.subteam,
        t.status,
        t.description,
        t.created_at,
        t.updated_at,
        t.archived,
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

app.post("/api/tasks", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const { title, subteam, description } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: "Missing title" });
    if (!subteam || !String(subteam).trim()) return res.status(400).json({ error: "Missing subteam" });

    const r = await pool.query(
      `
      insert into tasks (title, subteam, description)
      values ($1,$2,$3)
      returning id, title, subteam, status, description, archived, created_at, updated_at
      `,
      [String(title).trim(), String(subteam).trim(), description ? String(description).trim() : ""]
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

    const okStatus = new Set(["todo", "in_progress", "blocked", "done"]);
    if (status && !okStatus.has(status)) return res.status(400).json({ error: "Invalid status" });

    const r = await pool.query(
      `
      update tasks
         set title = coalesce($2, title),
             subteam = coalesce($3, subteam),
             description = coalesce($4, description),
             status = coalesce($5, status),
             updated_at = now()
       where id = $1
       returning id, title, subteam, status, description, archived, created_at, updated_at
      `,
      [
        taskId,
        title !== undefined ? String(title).trim() : null,
        subteam !== undefined ? String(subteam).trim() : null,
        description !== undefined ? String(description).trim() : null,
        status !== undefined ? String(status).trim() : null
      ]
    );

    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ task: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/tasks/:id/archive", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    await pool.query(`update tasks set archived = true, updated_at = now() where id = $1`, [taskId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/tasks/:id/unarchive", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    await pool.query(`update tasks set archived = false, updated_at = now() where id = $1`, [taskId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// Optional hard delete (manager only)
app.delete("/api/tasks/:id", requireKey("MANAGER_KEY"), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    await pool.query(`delete from tasks where id = $1`, [taskId]);
    res.json({ ok: true });
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
      where task_id=$1
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
    const { author_type, author_label, studentId, comment } = req.body || {};
    if (!comment || !String(comment).trim()) return res.status(400).json({ error: "Missing comment" });

    let finalType = String(author_type || "").trim().toLowerCase();
    let finalLabel = author_label;

    if (studentId) {
      await assertStudentActive(studentId);
      const s = await pool.query(`select full_name from students where id=$1`, [Number(studentId)]);
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
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

app.post("/api/tasks/:id/join", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { studentId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);

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

app.post("/api/tasks/:id/assign", requireKey("MENTOR_KEY"), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { studentId } = req.body || {};
    if (!studentId) return res.status(400).json({ error: "Missing studentId" });

    await assertStudentActive(studentId);

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

/* -------------------- Serve Client -------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build output is copied to server/public by the Dockerfile build step
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("Server listening on", PORT);
});
