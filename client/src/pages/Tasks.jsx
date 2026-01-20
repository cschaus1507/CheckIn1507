import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import BoltMark from "../components/BoltMark.jsx";
import { api } from "../api.js";
import { formatDateTimeEastern } from "../time.js";

const SUBTEAMS = ["All", "Build", "Programming", "Electrical", "CAD/CAM", "Imagery & Outreach"];
const COLUMNS = [
  { key: "todo", title: "To Do" },
  { key: "in_progress", title: "In Progress" },
  { key: "blocked", title: "Road Blocked" },
  { key: "done", title: "Done" }
];

function pillStyle(key) {
  switch (key) {
    case "todo":
      return "bg-slate-950 border-slate-800 text-slate-200";
    case "in_progress":
      return "bg-blue-950 border-blue-800/60 text-blue-200";
    case "blocked":
      return "bg-yellow-950 border-yellow-700/60 text-yellow-200";
    case "done":
      return "bg-emerald-950 border-emerald-800/60 text-emerald-200";
    default:
      return "bg-slate-950 border-slate-800 text-slate-200";
  }
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [students, setStudents] = useState([]);
  const [subteam, setSubteam] = useState("All");
  const [studentId, setStudentId] = useState(() => localStorage.getItem("warlocks_studentId") || "");
  const [msg, setMsg] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const mentorMode = useMemo(() => !!sessionStorage.getItem("mentorKey"), []);

  // Mentor create
  const [newTitle, setNewTitle] = useState("");
  const [newSubteam, setNewSubteam] = useState("Build");
  const [newDesc, setNewDesc] = useState("");

  // Comments modal
  const [openTaskId, setOpenTaskId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");

  function showMessage(t) {
    setMsg(t);
    window.clearTimeout(showMessage._t);
    showMessage._t = window.setTimeout(() => setMsg(""), 2500);
  }

  async function load() {
    try {
      const base =
        subteam === "All" ? "/api/tasks" : `/api/tasks?subteam=${encodeURIComponent(subteam)}`;

      const url = mentorMode && showArchived
        ? base + (base.includes("?") ? "&" : "?") + "includeArchived=true"
        : base;

      const [{ tasks }, { students }] = await Promise.all([api(url), api("/api/students")]);

      setTasks(tasks);
      setStudents(students);
      setMsg("");
    } catch (e) {
      setMsg(e?.message || "Failed to load.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subteam, showArchived]);

  useEffect(() => {
    if (studentId) localStorage.setItem("warlocks_studentId", studentId);
  }, [studentId]);

  const grouped = useMemo(() => {
    const g = { todo: [], in_progress: [], blocked: [], done: [] };
    for (const t of tasks) (g[t.status] || g.todo).push(t);
    return g;
  }, [tasks]);

  function isAssigned(task) {
    if (!studentId) return false;
    return (task.assignees || []).some((a) => Number(a.student_id) === Number(studentId));
  }

  async function mentorCreate(e) {
    e.preventDefault();
    if (!newTitle.trim()) return showMessage("Need a title.");

    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          subteam: newSubteam,
          description: newDesc.trim(),
          status: "todo"
        })
      });
      setNewTitle("");
      setNewDesc("");
      await load();
      showMessage("✅ Created.");
    } catch (err) {
      console.error("Create failed:", err);
      showMessage(`❌ Create failed: ${err?.message || "unknown error"}`);
    }
  }

  async function mentorMove(taskId, status) {
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (err) {
      console.error("Move failed:", err);
      showMessage(`❌ Move failed: ${err?.message || "unknown error"}`);
    }
  }

  async function join(taskId) {
    if (!studentId) return showMessage("Select your name first.");
    try {
      await api(`/api/tasks/${taskId}/join`, {
        method: "POST",
        body: JSON.stringify({ studentId: Number(studentId) })
      });
      await load();
      showMessage("✅ Joined.");
    } catch (err) {
      console.error("Join failed:", err);
      showMessage(`❌ Join failed: ${err?.message || "unknown error"}`);
    }
  }

  async function leave(taskId) {
    if (!studentId) return showMessage("Select your name first.");
    try {
      await api(`/api/tasks/${taskId}/leave`, {
        method: "POST",
        body: JSON.stringify({ studentId: Number(studentId) })
      });
      await load();
      showMessage("✅ Left.");
    } catch (err) {
      console.error("Leave failed:", err);
      showMessage(`❌ Leave failed: ${err?.message || "unknown error"}`);
    }
  }

  async function openComments(taskId) {
    setOpenTaskId(taskId);
    const { comments } = await api(`/api/tasks/${taskId}/comments`);
    setComments(comments);
    setCommentText("");
  }

  async function postComment() {
    if (!openTaskId) return;
    if (!commentText.trim()) return;
    try {
      await api(`/api/tasks/${openTaskId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          studentId: studentId ? Number(studentId) : null,
          author_type: studentId ? "student" : "mentor",
          author_label: studentId ? "" : "Mentor",
          comment: commentText.trim()
        })
      });
      const { comments } = await api(`/api/tasks/${openTaskId}/comments`);
      setComments(comments);
      setCommentText("");
      await load();
    } catch (err) {
      console.error("Comment failed:", err);
      showMessage(`❌ Comment failed: ${err?.message || "unknown error"}`);
    }
  }

  async function mentorRemove(taskId, a) {
    // a = { student_id, full_name }
    try {
      await api(`/api/tasks/${taskId}/leave`, {
        method: "POST",
        body: JSON.stringify({ studentId: Number(a.student_id) })
      });
      await load();
      showMessage(`✅ Removed ${a.full_name}`);
    } catch (err) {
      console.error("Remove failed:", err);
      showMessage(`❌ Remove failed: ${err?.message || "unknown error"}`);
    }
  }

  async function archiveTask(taskId) {
    try {
      await api(`/api/tasks/${taskId}/archive`, { method: "POST" });
      await load();
      showMessage("✅ Archived.");
    } catch (err) {
      console.error("Archive failed:", err);
      showMessage(`❌ Archive failed: ${err?.message || "unknown error"}`);
    }
  }

  async function unarchiveTask(taskId) {
    try {
      await api(`/api/tasks/${taskId}/unarchive`, { method: "POST" });
      await load();
      showMessage("✅ Unarchived.");
    } catch (err) {
      console.error("Unarchive failed:", err);
      showMessage(`❌ Unarchive failed: ${err?.message || "unknown error"}`);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950/70 to-slate-900/20 p-6 flex items-start gap-4">
        <BoltMark className="w-12 h-12 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight">Task Board</h1>
          <p className="text-slate-300 mt-1">
            Students: pick your name, join tasks, leave tasks, and post comments.
            Mentors: create tasks, move tasks, remove students, and archive Done tasks.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {SUBTEAMS.map((st) => (
                <button
                  key={st}
                  onClick={() => setSubteam(st)}
                  className={[
                    "px-3 py-2 rounded-xl border text-sm font-semibold",
                    st === subteam
                      ? "bg-slate-950 border-slate-700 text-white"
                      : "bg-slate-950/30 border-slate-800 text-slate-200 hover:bg-slate-900/40"
                  ].join(" ")}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-semibold text-slate-200 mb-2">Select your name</label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-slate-100"
                >
                  <option value="">— Select —</option>
                  {students
                    .filter((s) => s.is_active)
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.subteam})
                      </option>
                    ))}
                </select>
              </div>

              {msg && (
                <div className="md:self-end rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                  {msg}
                </div>
              )}
            </div>

            {mentorMode && (
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  <span>Show archived</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {mentorMode && (
        <Card title="Mentor: Create a task">
          <form onSubmit={mentorCreate} className="grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2 min-w-0">
              <label className="block text-sm font-semibold text-slate-200 mb-2">Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-slate-100"
                placeholder="e.g. Wire the climber motor controller"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-sm font-semibold text-slate-200 mb-2">Subteam</label>
              <select
                value={newSubteam}
                onChange={(e) => setNewSubteam(e.target.value)}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-slate-100"
              >
                {SUBTEAMS.filter((s) => s !== "All").map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 min-w-0">
              <label className="block text-sm font-semibold text-slate-200 mb-2">Description (optional)</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-slate-100 min-h-[90px]"
                placeholder="Add context, steps, or links…"
              />
            </div>

            <div className="md:col-span-3">
              <button className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-white">
                Create Task
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black tracking-tight">{col.title}</h2>
              <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-900/40">
                {(grouped[col.key] || []).length}
              </span>
            </div>

            <div className="grid gap-3">
              {(grouped[col.key] || []).map((t) => (
                <div
                  key={t.id}
                  className={[
                    "rounded-2xl border border-slate-800 bg-slate-950/50 p-4 hover:bg-slate-900/40 transition",
                    t.is_stale ? "ring-2 ring-yellow-700/60" : ""
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={["text-xs px-2 py-1 rounded-full border", pillStyle(t.status)].join(" ")}>
                          {COLUMNS.find((c) => c.key === t.status)?.title || t.status}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-900/40">
                          {t.subteam}
                        </span>
                        {t.is_stale && (
                          <span className="text-xs px
