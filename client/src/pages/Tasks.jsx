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
      return "bg-slate-900/50 border-slate-700 text-slate-200";
    case "in_progress":
      return "bg-blue-950/40 border-blue-800 text-blue-200";
    case "blocked":
      return "bg-amber-950/40 border-amber-700 text-amber-200";
    case "done":
      return "bg-emerald-950/40 border-emerald-700 text-emerald-200";
    default:
      return "bg-slate-900/50 border-slate-700 text-slate-200";
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
      const [{ tasks }, { students }] = await Promise.all([
        api(
          (() => {
            const base = subteam === "All" ? "/api/tasks" : `/api/tasks?subteam=${encodeURIComponent(subteam)}`;
            if (showArchived) return base + (base.includes("?") ? "&" : "?") + "includeArchived=true";
            return base;
          })()
        ),
        api("/api/students")
      ]);
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
    if (!newTitle.trim()) return showMessage("Title required.");
    try {
      await api("/api/tasks", {
        method: "POST",
        headers: { "x-app-key": sessionStorage.getItem("mentorKey") || "" },
        body: JSON.stringify({
          title: newTitle.trim(),
          subteam: newSubteam,
          description: newDesc.trim()
        })
      });
      setNewTitle("");
      setNewDesc("");
      await load();
      showMessage("✅ Task created.");
    } catch (err) {
      console.error("Create failed:", err);
      showMessage(`❌ Create failed: ${err?.message || "unknown error"}`);
    }
  }

  async function mentorMove(taskId, status) {
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "x-app-key": sessionStorage.getItem("mentorKey") || "" },
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

  async function mentorRemove(taskId, student) {
    // Uses the existing "leave" endpoint, but sends the chosen student's id.
    // Adds stopPropagation + try/catch so clicks aren't swallowed and errors surface.
    try {
      await api(`/api/tasks/${taskId}/leave`, {
        method: "POST",
        body: JSON.stringify({ studentId: Number(student.student_id ?? student.studentId ?? student.id) })
      });
      await load();
      showMessage(`✅ Removed ${student.full_name}`);
    } catch (err) {
      console.error("Remove failed:", err);
      showMessage(`❌ Remove failed: ${err?.message || "unknown error"}`);
    }
  }

  async function archiveTask(taskId) {
    if (!mentorMode) return;
    try {
      await api(`/api/tasks/${taskId}/archive`, { method: "POST" });
      await load();
      showMessage("✅ Task archived.");
    } catch (err) {
      console.error("Archive failed:", err);
      showMessage(`❌ Archive failed: ${err?.message || "unknown error"}`);
    }
  }

  async function unarchiveTask(taskId) {
    if (!mentorMode) return;
    try {
      await api(`/api/tasks/${taskId}/unarchive`, { method: "POST" });
      await load();
      showMessage("✅ Task unarchived.");
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
            Mentors: create tasks, move them through columns, and remove students.
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
          </div>
        </div>
      </div>

      {mentorMode && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            <span>Show archived</span>
          </label>
        </div>
      )}

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
                    t.is_stale ? "ring-2 ring-amber-700/60" : ""
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
                          <span className="text-xs px-2 py-1 rounded-full border border-amber-700/60 bg-amber-950/30 text-amber-200">
                            Stale
                          </span>
                        )}
                        {t.archived && (
                          <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-900/40 text-slate-200">
                            Archived
                          </span>
                        )}
                      </div>

                      <h3 className="font-black text-lg mt-2 break-words">{t.title}</h3>

                      {t.description ? (
                        <p className="text-slate-300 mt-2 whitespace-pre-wrap break-words">{t.description}</p>
                      ) : null}

                      <p className="text-xs text-slate-400 mt-3">
                        Updated: {formatDateTimeEastern(t.updated_at)}
                      </p>

                      <div className="mt-3">
                        <div className="text-xs font-semibold text-slate-300 mb-2">Assignees</div>
                        <div className="flex flex-wrap gap-2">
                          {(t.assignees || []).length ? (
                            (t.assignees || []).map((a) => (
                              <span
                                key={a.student_id}
                                className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-900/40"
                              >
                                <span className="truncate max-w-[220px]">{a.full_name}</span>

                                {mentorMode && (
                                  <button
                                    className="w-5 h-5 rounded-full border border-slate-700 bg-slate-950 hover:bg-slate-900 text-slate-100 leading-none"
                                    title="Remove student"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      showMessage(`Removing ${a.full_name}…`);
                                      await mentorRemove(t.id, a);
                                    }}
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      <button
                        onClick={() => openComments(t.id)}
                        className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
                      >
                        Comments
                      </button>

                      {mentorMode && (
                        <select
                          value={t.status}
                          onChange={(e) => mentorMove(t.id, e.target.value)}
                          className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      )}

                      {mentorMode && t.status === "done" && (
                        <>
                          {!t.archived ? (
                            <button
                              onClick={() => archiveTask(t.id)}
                              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              onClick={() => unarchiveTask(t.id)}
                              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
                            >
                              Unarchive
                            </button>
                          )}
                        </>
                      )}

                      {!isAssigned(t) ? (
                        <button
                          onClick={() => join(t.id)}
                          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
                        >
                          Join
                        </button>
                      ) : (
                        <button
                          onClick={() => leave(t.id)}
                          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
                        >
                          Leave
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {!grouped[col.key]?.length ? (
                <div className="text-sm text-slate-400 border border-dashed border-slate-800 rounded-2xl p-4">
                  No tasks.
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Comments Modal */}
      {openTaskId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Comments</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {studentId ? "Posting as selected student." : "Posting as Mentor."}
                </p>
              </div>
              <button
                onClick={() => setOpenTaskId(null)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
              >
                Close
              </button>
            </div>

            <div className="mt-4 max-h-[50vh] overflow-auto grid gap-3 pr-1">
              {comments.length ? (
                comments.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-100">
                        {c.author_label}{" "}
                        <span className="text-xs font-semibold text-slate-400">({c.author_type})</span>
                      </div>
                      <div className="text-xs text-slate-400">{formatDateTimeEastern(c.created_at)}</div>
                    </div>
                    <div className="text-slate-200 mt-2 whitespace-pre-wrap break-words">{c.comment}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400 border border-dashed border-slate-800 rounded-2xl p-4">
                  No comments yet.
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-slate-100 min-h-[90px]"
                placeholder="Write a comment…"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={postComment}
                  className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-white"
                >
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

