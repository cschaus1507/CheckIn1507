import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import BoltMark from "../components/BoltMark.jsx";
import { api } from "../api.js";
import { formatDateEastern, formatTimeEastern } from "../time.js";

const SUBTEAMS = ["Build", "Programming", "Electrical", "CAD/CAM", "Imagery & Outreach"];

export default function StudentUI() {
  const [students, setStudents] = useState([]);

  const [studentId, setStudentId] = useState(() => localStorage.getItem("warlocks_studentId") || "");
  const [subteam, setSubteam] = useState(() => localStorage.getItem("warlocks_subteam") || "");
  const [workingOn, setWorkingOn] = useState("");

  // Optional: select a task when clocking in
  const [tasks, setTasks] = useState([]);
  const [taskId, setTaskId] = useState("");

  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("not_clocked_in");
  const [msg, setMsg] = useState("");

  const dateLabel = useMemo(() => formatDateEastern(), []);
  const isSelected = !!studentId;

  const clockedInAt = session?.clock_in_at ? formatTimeEastern(session.clock_in_at) : "—";
  const clockedOutAt = session?.clock_out_at ? formatTimeEastern(session.clock_out_at) : "—";

  const isClockedIn = status === "clocked_in";
  const isClockedOut = status === "clocked_out";

  function showMessage(text) {
    setMsg(text);
    window.clearTimeout(showMessage._t);
    showMessage._t = window.setTimeout(() => setMsg(""), 2500);
  }

  function resetForNextStudent() {
    setStudentId("");
    setSubteam("");
    setWorkingOn("");
    setTaskId("");
    setSession(null);
    setStatus("not_clocked_in");

    localStorage.removeItem("warlocks_studentId");
    localStorage.removeItem("warlocks_subteam");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Load roster + tasks list
  useEffect(() => {
    (async () => {
      try {
        const [{ students }, { tasks }] = await Promise.all([api("/api/students"), api("/api/tasks")]);
        setStudents(students);
        setTasks(tasks);
      } catch (e) {
        showMessage(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (studentId) localStorage.setItem("warlocks_studentId", studentId);
  }, [studentId]);

  useEffect(() => {
    if (subteam) localStorage.setItem("warlocks_subteam", subteam);
  }, [subteam]);

  // Load today's session when a student is selected
  useEffect(() => {
    if (!studentId) return;

    (async () => {
      try {
        const { session, status } = await api(`/api/student/today/${studentId}`);
        setSession(session);
        setStatus(status);
        setWorkingOn(session?.working_on ?? "");
        if (!subteam) setSubteam(session?.subteam ?? "");
        setMsg("");
      } catch (e) {
        showMessage(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function syncUpdate(next = {}) {
    if (!studentId) return;
    try {
      const { session, status } = await api("/api/student/update", {
        method: "POST",
        body: JSON.stringify({
          studentId: Number(studentId),
          subteam: next.subteam ?? subteam,
          workingOn: next.workingOn ?? workingOn
        })
      });
      setSession(session);
      setStatus(status);
    } catch (e) {
      showMessage(e.message);
    }
  }

  async function clockIn() {
    if (!studentId) return showMessage("Please select your name first.");
    try {
      await api("/api/student/clock-in", {
        method: "POST",
        body: JSON.stringify({
          studentId: Number(studentId),
          subteam,
          workingOn,
          taskId: taskId ? Number(taskId) : null
        })
      });

      showMessage("✅ Clocked in. Next student!");
      resetForNextStudent();
    } catch (e) {
      showMessage(e.message);
    }
  }

  async function clockOut() {
    if (!studentId) return showMessage("Please select your name first.");
    try {
      await api("/api/student/clock-out", {
        method: "POST",
        body: JSON.stringify({ studentId: Number(studentId) })
      });

      showMessage("✅ Clocked out. Next student!");
      resetForNextStudent();
    } catch (e) {
      showMessage(e.message);
    }
  }

  async function toggleNeed(type) {
    if (!studentId) return showMessage("Please select your name first.");
    const current = type === "help" ? !!session?.need_help : !!session?.need_task;

    try {
      const { session: s, status } = await api("/api/student/need", {
        method: "POST",
        body: JSON.stringify({
          studentId: Number(studentId),
          type,
          value: !current
        })
      });
      setSession(s);
      setStatus(status);
      showMessage(!current ? "✅ Noted." : "✅ Cleared.");
    } catch (e) {
      showMessage(e.message);
    }
  }

  return (
    <div className="grid gap-6 pb-28">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/70 to-slate-900/20 p-6 flex items-start gap-4">
        <BoltMark className="mt-1" />
        <div className="flex-1">
          <div className="text-3xl font-extrabold">
            <span className="text-warlocksGold">Student</span>{" "}
            <span className="text-blue-400">Check-In</span>
          </div>
          <div className="text-slate-300 mt-1">
            Select your name, pick your subteam, choose a task if you want, and log what you’re working on.
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Date (Eastern): <span className="text-white font-semibold">{dateLabel}</span>
          </div>

          {msg && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              {msg}
            </div>
          )}
        </div>
      </div>

      <Card title="1) Select your name">
        <label className="block text-sm font-semibold text-slate-200 mb-2">Name</label>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="w-full rounded-xl bg-slate-950 border-slate-800 text-white"
        >
          <option value="">-- Select --</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
              {s.subteam ? ` (${s.subteam})` : ""}
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs text-slate-400">
          (Kiosk mode) After clocking in/out, the page resets + scrolls to top for the next student.
        </div>
      </Card>

      <Card title="2) Subteam">
        <div className="flex flex-wrap gap-2">
          {SUBTEAMS.map((t) => {
            const on = subteam === t;
            return (
              <button
                key={t}
                disabled={!isSelected}
                onClick={() => {
                  setSubteam(t);
                  setTimeout(() => syncUpdate({ subteam: t }), 0);
                }}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                  !isSelected
                    ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
                    : on
                      ? "bg-warlocksGold text-slate-950 border-yellow-300"
                      : "bg-slate-950 border-slate-800 text-slate-200 hover:bg-slate-900/40"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-400">
          Current: <span className="text-white font-semibold">{subteam || "—"}</span>
        </div>
      </Card>

      <Card title="3) Pick a task (optional)">
        <div className="grid gap-2">
          <label className="block text-sm font-semibold text-slate-200">Task</label>
          <select
            value={taskId}
            disabled={!isSelected}
            onChange={(e) => setTaskId(e.target.value)}
            className={`w-full rounded-xl bg-slate-950 border-slate-800 text-white ${
              !isSelected ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <option value="">— None —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.subteam}] {t.title} ({t.status.replaceAll("_", " ")})
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-400">
            You can join any task regardless of its current stage.
          </div>
        </div>
      </Card>

      <Card title="4) What are you working on?">
        <div className="grid gap-3">
          <textarea
            value={workingOn}
            disabled={!isSelected}
            onChange={(e) => setWorkingOn(e.target.value)}
            onBlur={() => syncUpdate()}
            placeholder="Example: wiring the intake, CAD for bracket, testing auto path, updating outreach graphics..."
            className={`w-full min-h-[110px] rounded-xl bg-slate-950 border-slate-800 text-white ${
              !isSelected ? "opacity-60 cursor-not-allowed" : ""
            }`}
          />
          <div className="text-xs text-slate-400">Saves when you click out of the box.</div>
        </div>
      </Card>

      <Card title="5) Quick buttons">
        <div className="flex flex-wrap gap-3">
          <button
            disabled={!isSelected}
            onClick={() => toggleNeed("help")}
            className={`rounded-xl px-4 py-3 font-bold border transition ${
              !isSelected
                ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
                : session?.need_help
                  ? "bg-warlocksGold text-slate-950 border-yellow-300"
                  : "bg-slate-950 border-slate-800 hover:bg-slate-900/40"
            }`}
          >
            {session?.need_help ? "✅ Help requested" : "I need help"}
          </button>

          <button
            disabled={!isSelected}
            onClick={() => toggleNeed("task")}
            className={`rounded-xl px-4 py-3 font-bold border transition ${
              !isSelected
                ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
                : session?.need_task
                  ? "bg-warlocksGold text-slate-950 border-yellow-300"
                  : "bg-slate-950 border-slate-800 hover:bg-slate-900/40"
            }`}
          >
            {session?.need_task ? "✅ Task requested" : "I need something to do"}
          </button>
        </div>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur shadow-lg">
            <div className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={clockIn}
                  disabled={!isSelected}
                  className={`rounded-xl px-4 py-3 font-bold border transition shadow-lg ${
                    !isSelected
                      ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
                      : isClockedIn
                        ? "bg-blue-700 border-blue-500"
                        : "bg-blue-600 hover:bg-blue-500 border-blue-500/50"
                  }`}
                >
                  Clock In
                </button>

                <button
                  onClick={clockOut}
                  disabled={!isSelected}
                  className={`rounded-xl px-4 py-3 font-bold border transition ${
                    !isSelected
                      ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
                      : isClockedOut
                        ? "bg-slate-700 border-slate-500"
                        : "bg-slate-900 hover:bg-slate-800 border-slate-700"
                  }`}
                >
                  Clock Out
                </button>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-300">
                  Status: <span className="text-white font-semibold">{status.replaceAll("_", " ")}</span>
                </span>

                <span className="text-xs px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
                  In: <span className="text-white font-semibold">{clockedInAt}</span> • Out:{" "}
                  <span className="text-white font-semibold">{clockedOutAt}</span>
                </span>
              </div>
            </div>

            <div className="px-4 pb-3 text-xs text-slate-400">
              After clocking in/out, this page resets for the next student.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
