import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import BoltMark from "../components/BoltMark.jsx";
import { api } from "../api.js";

function nowLocalTimeLabel(dt) {
  try {
    return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const SUBTEAMS = ["Mechanical", "Programming", "Electrical", "CAD", "Media", "Business", "Strategy"];

export default function StudentUI() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState(() => localStorage.getItem("warlocks_studentId") || "");
  const [subteam, setSubteam] = useState(() => localStorage.getItem("warlocks_subteam") || "");
  const [workingOn, setWorkingOn] = useState("");
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("not_clocked_in");
  const [msg, setMsg] = useState("");

  const date = useMemo(() => todayISO(), []);

  useEffect(() => {
    (async () => {
      try {
        const { students } = await api("/api/students");
        setStudents(students);
      } catch (e) {
        setMsg(e.message);
      }
    })();
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
        // default subteam from roster/session if not set locally
        if (!subteam) setSubteam(session?.subteam ?? "");
        setMsg("");
      } catch (e) {
        setMsg(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function syncUpdate(next = {}) {
    if (!studentId) return setMsg("Please select your name first.");
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
      setMsg("");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function clockIn() {
    if (!studentId) return setMsg("Please select your name first.");
    try {
      const { session, status } = await api("/api/student/clock-in", {
        method: "POST",
        body: JSON.stringify({
          studentId: Number(studentId),
          subteam,
          workingOn
        })
      });
      setSession(session);
      setStatus(status);
      setMsg("✅ Clocked in.");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function clockOut() {
    if (!studentId) return setMsg("Please select your name first.");
    try {
      const { session, status } = await api("/api/student/clock-out", {
        method: "POST",
        body: JSON.stringify({ studentId: Number(studentId) })
      });
      setSession(session);
      setStatus(status);
      setMsg("✅ Clocked out.");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function toggleNeed(type) {
    if (!studentId) return setMsg("Please select your name first.");
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
      setMsg(!current ? "✅ Noted." : "✅ Cleared.");
    } catch (e) {
      setMsg(e.message);
    }
  }

  const clockedInAt = session?.clock_in_at ? nowLocalTimeLabel(session.clock_in_at) : "—";
  const clockedOutAt = session?.clock_out_at ? nowLocalTimeLabel(session.clock_out_at) : "—";

  const isClockedIn = status === "clocked_in";
  const isClockedOut = status === "clocked_out";

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/70 to-slate-900/20 p-6 flex items-start gap-4">
        <BoltMark className="mt-1" />
        <div>
          <div className="text-3xl font-extrabold">
            <span className="text-warlocksGold">Student</span>{" "}
            <span className="text-blue-400">Check-In</span>
          </div>
          <div className="text-slate-300 mt-1">
            Select your name, clock in/out, pick your subteam, and log what you’re working on.
          </div>
          <div className="text-xs text-slate-400 mt-2">Date auto-recorded as <span className="text-white font-semibold">{date}</span>.</div>
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
              {s.full_name}{s.subteam ? ` (${s.subteam})` : ""}
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs text-slate-400">
          Your last selection is remembered on this device.
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="2) Clock In / Out" right={
          <span className="text-xs px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
            In: <span className="text-white font-semibold">{clockedInAt}</span> • Out: <span className="text-white font-semibold">{clockedOutAt}</span>
          </span>
        }>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={clockIn}
              className={`rounded-xl px-4 py-3 font-bold border transition shadow-lg ${
                isClockedIn ? "bg-blue-700 border-blue-500" : "bg-blue-600 hover:bg-blue-500 border-blue-500/50"
              }`}
            >
              Clock In
            </button>
            <button
              onClick={clockOut}
              className={`rounded-xl px-4 py-3 font-bold border transition ${
                isClockedOut ? "bg-slate-700 border-slate-500" : "bg-slate-900 hover:bg-slate-800 border-slate-700"
              }`}
            >
              Clock Out
            </button>
            <div className="text-sm text-slate-300 self-center">
              Status:{" "}
              <span className="font-semibold text-white">
                {status.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-400">
            Tip: Clock In creates/updates today’s session. Clock Out stamps the time.
          </div>
        </Card>

        <Card title="3) Subteam">
          <div className="flex flex-wrap gap-2">
            {SUBTEAMS.map((t) => {
              const on = subteam === t;
              return (
                <button
                  key={t}
                  onClick={() => {
                    setSubteam(t);
                    // save immediately to today's session
                    setTimeout(() => syncUpdate({ subteam: t }), 0);
                  }}
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
          <div className="mt-3 text-xs text-slate-400">
            Current: <span className="text-white font-semibold">{subteam || "—"}</span>
          </div>
        </Card>
      </div>

      <Card title="4) What are you working on?">
        <div className="grid gap-3">
          <textarea
            value={workingOn}
            onChange={(e) => setWorkingOn(e.target.value)}
            onBlur={() => syncUpdate()}
            placeholder="Example: wiring the intake, CAD for bracket, testing auto path, updating scouting..."
            className="w-full min-h-[110px] rounded-xl bg-slate-950 border-slate-800 text-white"
          />
          <div className="text-xs text-slate-400">
            This saves when you click out of the box (on blur).
          </div>
        </div>
      </Card>

      <Card title="5) Quick buttons">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => toggleNeed("help")}
            className={`rounded-xl px-4 py-3 font-bold border transition ${
              session?.need_help
                ? "bg-warlocksGold text-slate-950 border-yellow-300"
                : "bg-slate-950 border-slate-800 hover:bg-slate-900/40"
            }`}
          >
            {session?.need_help ? "✅ Help requested" : "I need help"}
          </button>

          <button
            onClick={() => toggleNeed("task")}
            className={`rounded-xl px-4 py-3 font-bold border transition ${
              session?.need_task
                ? "bg-warlocksGold text-slate-950 border-yellow-300"
                : "bg-slate-950 border-slate-800 hover:bg-slate-900/40"
            }`}
          >
            {session?.need_task ? "✅ Task requested" : "I need something to do"}
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
            {msg}
          </div>
        )}
      </Card>
    </div>
  );
}
