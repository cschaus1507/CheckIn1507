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
      const url =
        mentorMode && showArchived
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
    return (task.assignees || []).some((a) => String(a.student_id) === String(studentId));
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

    const payload = studentId
      ? { studentId: Number(studentId), comment: commentText.trim() }
      : { authorType: "mentor", authorLabel: "Mentor", comment: commentText.trim() };

    try {
      await api(`/api/tasks/${openTaskId}/comments`, {
        method: "POST",
        body: JSON.stringify(payload)
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
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      console.error("Move failed:", err);
      showMessage(`❌ Move failed: ${err?.message || "unknown error"}`);
    }
  }

  async function mentorAssign(taskId, sid) {
    if (!sid) return;
    try {
      await api(`/api/tasks/${taskId}/assign`, {
        method: "POST",
        body: JSON.stringify({ studentId: Number(sid) })
      });
      await load();
      showMessage("✅ Assigned.");
    } catch (err) {
      console.error("Assign failed:", err);
      showMessage(`❌ Assign failed: ${err?.message || "unknown error"}`);
    }
  }

  async function mentorRemove(taskId, student) {
    try {
      await api(`/api/tasks/${taskId}/leave`, {
        method: "POST",
        body: JSON.stringify({ studentId: Number(student.student_id) })
      });
      await load();
      showMessage(`✅ Removed ${student.full_name}`);
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
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/70 to-slate-900/20 p-6 flex items-start gap-4">
        <BoltMark className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-extrabold">
            <span className="text-blue-400">Tasks</span>{" "}
            <span className="text-warlocksGold">Board</span>
          </div>
          <div className="text-slate-300 mt-1">As they say... "Many hands make light work"</div>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <div className="text-xs text-slate-300 mr-2 font-semibold">Filter:</div>
            {SUBTEAMS.map((t) => {
              const on = subteam === t;
              return (
                <button
                  key={t}
                  onClick={() => setSubteam(t)}
                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                    on
                      ? "bg-warlocksGold text-slate-950 border-yellow-300"
                      : "bg-slate-950 border-slate-800 text-slate-200 hover:bg-slate-900/40"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-3 items-end">
            <div className="min-w-0">
              <label className="block text-sm font-semibold text-slate-200 mb-2">I am</label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border-slate-800 text-white"
              >
                <option value="">-- Select your name (enables Join + student comments) --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-400">
                If you don’t select a name, you can still browse tasks.
              </div>

              {mentorMode && (
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-200 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show archived
                </label>
              )}
            </div>

            <div className="min-w-0">
              {msg && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                  {msg}
                </div>
              )}
            </div>
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
                className="w-full rounded-xl bg-slate-950 border-slate-800 text-white"
                placeholder="Short, actionable task..."
              />
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-semibold text-slate-200 mb-2">Subteam</label>
              <select
                value={newSubteam}
                onChange={(e) => setNewSubteam(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border-slate-800 text-white"
              >
                {SUBTEAMS.filter((s) => s !== "All").map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 min-w-0">
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Short notes / link (optional)
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full min-h-[80px] rounded-xl bg-slate-950 border-slate-800 text-white"
                placeholder="Optional. Paste a link or 1–2 sentences."
              />
            </div>
            <button className="md:col-span-3 rounded-xl px-4 py-3 font-bold bg-blue-600 hover:bg-blue-500 transition">
              Create Task
            </button>
          </form>
        </Card>
      )}

      {/* Board layout fix: horizontal scroll + snap (Trello-style) */}
      <div className="md:hidden text-xs text-slate-400 flex items-center justify-between px-2 -mt-2">
        <span>Swipe left/right to see more columns</span>
        <span aria-hidden className="text-slate-500">↔</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-px-4 px-4 -mx-4">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="min-w-[85vw] sm:min-w-0 sm:w-[340px] flex-shrink-0 snap-start rounded-2xl border border-slate-800 bg-slate-900/40 p-3 flex flex-col min-w-0"
          >
            <div className="px-2 py-1 flex items-center gap-2">
              <div className="font-extrabold">{col.title}</div>
              <div className="text-xs text-slate-400">({(grouped[col.key] || []).length})</div>
            </div>

            <div className="grid gap-3 mt-2 overflow-y-auto max-h-[70vh] min-w-0">
              {(grouped[col.key] || []).map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 min-w-0 overflow-visible"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={`px-2 py-1 rounded-lg border text-xs font-bold ${pillStyle(t.status)}`}>
                      {t.status.replaceAll("_", " ")}
                    </div>

                    {t.archived && (
                      <div className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-extrabold border border-slate-700">
                        ARCHIVED
                      </div>
                    )}

                    {t.is_stale && (
                      <div className="px-2 py-1 rounded-lg bg-warlocksGold text-slate-950 text-xs font-extrabold">
                        STALE
                      </div>
                    )}

                    <div className="ml-auto text-xs text-slate-400 whitespace-nowrap">
                      Updated:{" "}
                      <span className="text-slate-200">
                        {formatDateTimeEastern(t.last_activity_at)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 font-extrabold text-white break-words">{t.title}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    <span className="text-slate-200 font-semibold">Subteam:</span> {t.subteam}
                  </div>

                  {t.description && (
                    <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap break-words">
                      {t.description}
                    </div>
                  )}

                  <div className="mt-3 min-w-0">
                    <div className="text-xs text-slate-400 mb-1">Assigned</div>
                    <div className="flex flex-wrap gap-2 max-w-full">
                      {(t.assignees || []).length === 0 && (
                        <span className="text-slate-400 text-sm">—</span>
                      )}

                      {(t.assignees || []).map((a) => (
                        <span
                          key={a.student_id}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-sm inline-flex items-center gap-2"
                        >
                          <span className="break-words">{a.full_name}</span>

                          {mentorMode && (
                            <button
                              type="button"
                              title="Remove from task"
                              className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-900/60 pointer-events-auto"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showMessage(`Removing ${a.full_name}…`);
                                await mentorRemove(t.id, a);
                              }}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 max-w-full">
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

                    <button
                      onClick={() => openComments(t.id)}
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
                    >
                      Comments
                    </button>

                    {mentorMode && (
                      <div className="ml-auto flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
                        <select
                          defaultValue=""
                          onChange={(e) => mentorAssign(t.id, e.target.value)}
                          className="rounded-xl bg-slate-950 border-slate-800 text-white text-sm max-w-full"
                        >
                          <option value="">Assign…</option>
                          {students.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={t.status}
                          onChange={(e) => mentorMove(t.id, e.target.value)}
                          className="rounded-xl bg-slate-950 border-slate-800 text-white text-sm max-w-full"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.title}
                            </option>
                          ))}
                        </select>

                        {t.status === "done" &&
                          (!t.archived ? (
                            <button
                              type="button"
                              onClick={() => archiveTask(t.id)}
                              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => unarchiveTask(t.id)}
                              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
                            >
                              Unarchive
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(grouped[col.key] || []).length === 0 && (
                <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4 text-slate-400 text-sm min-w-0 overflow-hidden">
                  No tasks here.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {openTaskId && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl min-w-0">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3 min-w-0">
              <div className="font-extrabold text-white">Task Comments</div>
              <button
                onClick={() => setOpenTaskId(null)}
                className="ml-auto px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 font-semibold"
              >
                Close
              </button>
            </div>

            <div className="p-5 grid gap-4 min-w-0">
              <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-800 bg-slate-900/30 p-4 min-w-0">
                {comments.length === 0 && <div className="text-slate-400">No comments yet.</div>}
                <div className="grid gap-3 min-w-0">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 min-w-0 overflow-hidden"
                    >
                      <div className="text-xs text-slate-400">
                        <span className="text-slate-200 font-semibold">{c.author_label}</span>{" "}
                        <span className="text-slate-500">({c.author_type})</span> •{" "}
                        {formatDateTimeEastern(c.created_at)}
                      </div>
                      <div className="text-sm text-slate-200 mt-1 whitespace-pre-wrap break-words">
                        {c.comment}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-xs text-slate-400 mb-2">
                  Posting as:{" "}
                  <span className="text-slate-200 font-semibold">
                    {studentId
                      ? students.find((s) => String(s.id) === String(studentId))?.full_name || "Student"
                      : "Mentor"}
                  </span>
                </div>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full min-h-[90px] rounded-xl bg-slate-950 border-slate-800 text-white"
                  placeholder="Add a short note, link, or what you tried..."
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={postComment}
                    className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-bold"
                  >
                    Post Comment
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Stale indicator: tasks with no activity (assignment/comment/status update) for 3+ days.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

