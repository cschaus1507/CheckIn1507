import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card.jsx";
import BoltMark from "../components/BoltMark.jsx";
import { api } from "../api.js";
import { formatDateEastern, formatTimeEastern } from "../time.js";

// ✅ Eastern-safe "YYYY-MM-DD" (America/New_York)
function todayISOEastern() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

// ✅ Subtract N days in Eastern and return "YYYY-MM-DD"
function isoEasternDaysAgo(daysAgo) {
  // Use noon UTC to avoid DST edge weirdness, then format into Eastern date parts.
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() - daysAgo);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(dt); // en-CA gives YYYY-MM-DD
}

function toTime(dt) {
  return formatTimeEastern(dt);
}

function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const headers = Object.keys(rows[0] || {});
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MentorUI() {
  const [tab, setTab] = useState("status"); // status | report | corrections
  const [msg, setMsg] = useState("");

  // ✅ Keep mentor key in state so data fetch waits and refreshes after entry
  const [mentorKey, setMentorKey] = useState(() => sessionStorage.getItem("mentorKey") || "");

  // ✅ Eastern "today"
  const date = useMemo(() => todayISOEastern(), []);

  const [rows, setRows] = useState([]);

  const [start, setStart] = useState(() => isoEasternDaysAgo(14));
  const [end, setEnd] = useState(() => todayISOEastern());
  const [reportRows, setReportRows] = useState([]);

  // Corrections
  const [correctionRows, setCorrectionRows] = useState([]);
  const [correctionStatus, setCorrectionStatus] = useState("pending");

  // Manual attendance entry (paper backfill)
  const [roster, setRoster] = useState([]);
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualDate, setManualDate] = useState(() => todayISOEastern());
  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");
  const [manualWorkingOn, setManualWorkingOn] = useState("");
  const [manualSubteam, setManualSubteam] = useState("");

  // Access key prompt (stored only for this browser session)
  useEffect(() => {
    const existing = sessionStorage.getItem("mentorKey");
    if (existing) {
      setMentorKey(existing);
      return;
    }
    const entered = window.prompt("Enter Mentor Access Key");
    if (entered) {
      sessionStorage.setItem("mentorKey", entered);
      setMentorKey(entered);
    }
  }, []);

  useEffect(() => {
    // ✅ If mentor key is required and missing, don't fetch yet.
    if (!mentorKey) return;

    (async () => {
      try {
        if (tab === "status") {
          const { rows } = await api(`/api/mentor/status?date=${date}`);
          setRows(rows);
        } else if (tab === "report") {
          const { rows } = await api(`/api/mentor/report?start=${start}&end=${end}`);
          setReportRows(rows);
        } else {
          const { rows } = await api(`/api/mentor/corrections?status=${correctionStatus}`);
          setCorrectionRows(rows);
        }
        setMsg("");
      } catch (e) {
        setMsg(e?.message || "Request failed.");
      }
    })();
  }, [tab, date, start, end, mentorKey, correctionStatus]);

  // Load roster once (for manual entry dropdown)
  useEffect(() => {
    (async () => {
      try {
        const { students } = await api("/api/students");
        setRoster(students);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  async function refreshCorrections() {
    const qs = new URLSearchParams();
    qs.set("status", correctionStatus);
    const { rows } = await api(`/api/mentor/corrections?${qs.toString()}`);
    setCorrectionRows(rows);
  }

  async function decideCorrection(id, status) {
    await api(`/api/mentor/corrections/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
    await refreshCorrections();
  }

  async function submitManualAttendance() {
    if (!manualStudentId) return setMsg("Select a student.");
    if (!manualDate) return setMsg("Choose a date.");
    try {
      await api("/api/mentor/attendance/manual", {
        method: "POST",
        body: JSON.stringify({
          studentId: Number(manualStudentId),
          meetingDate: manualDate,
          clockInTime: manualIn || "",
          clockOutTime: manualOut || "",
          subteam: manualSubteam || "",
          workingOn: manualWorkingOn || ""
        })
      });
      setMsg("✅ Attendance saved.");
      setManualIn("");
      setManualOut("");
      setManualWorkingOn("");
      setManualSubteam("");
    } catch (e) {
      setMsg(e?.message || "Save failed.");
    }
  }

  const clockedIn = rows.filter(r => r.clock_in_at && !r.clock_out_at);
  const clockedOut = rows.filter(r => r.clock_in_at && r.clock_out_at);
  const notIn = rows.filter(r => !r.clock_in_at);

  const needHelp = rows.filter(r => r.need_help);
  const needTask = rows.filter(r => r.need_task);

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/70 to-slate-900/20 p-6 flex items-start gap-4">
        <BoltMark className="mt-1" />
        <div className="flex-1">
          <div className="text-3xl font-extrabold">
            <span className="text-blue-400">Mentor</span>{" "}
            <span className="text-warlocksGold">Dashboard</span>
          </div>
          <div className="text-slate-300 mt-1">
            Current attendance + help/task requests + reports.
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setTab("status")}
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                tab === "status"
                  ? "bg-blue-600 border-blue-500"
                  : "bg-slate-950 border-slate-800 hover:bg-slate-900/40"
              }`}
            >
              Current Status
            </button>
            <button
              onClick={() => setTab("report")}
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                tab === "report"
                  ? "bg-blue-600 border-blue-500"
                  : "bg-slate-950 border-slate-800 hover:bg-slate-900/40"
              }`}
            >
              Attendance Reports
            </button>

            <button
              onClick={() => setTab("corrections")}
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                tab === "corrections"
                  ? "bg-blue-600 border-blue-500"
                  : "bg-slate-950 border-slate-800 hover:bg-slate-900/40"
              }`}
            >
              Corrections & Manual Entry
            </button>
          </div>
        </div>

        <div className="text-xs px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
          Date: <span className="text-white font-semibold">{formatDateEastern(date)}</span>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
          {msg}
        </div>
      )}

      {tab === "status" && (
        <div className="grid gap-6">
          <Card title="Today summary">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
                <div className="text-slate-300 text-sm">Clocked in</div>
                <div className="text-3xl font-extrabold">{clockedIn.length}</div>
              </div>
              <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
                <div className="text-slate-300 text-sm">Clocked out</div>
                <div className="text-3xl font-extrabold">{clockedOut.length}</div>
              </div>
              <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
                <div className="text-slate-300 text-sm">Not clocked in</div>
                <div className="text-3xl font-extrabold">{notIn.length}</div>
              </div>
              <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
                <div className="text-slate-300 text-sm">Help / Task</div>
                <div className="text-3xl font-extrabold">{needHelp.length + needTask.length}</div>
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="⚡ I need help">
              <div className="grid gap-2">
                {needHelp.map(r => (
                  <div key={r.student_id} className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
                    <div className="font-bold">{r.full_name}</div>
                    <div className="text-xs text-slate-400">
                      {r.subteam || "—"} • clicked {toTime(r.need_help_at)}
                    </div>
                    <div className="text-sm text-slate-200 mt-1">{r.working_on || ""}</div>
                    <Link className="text-blue-300 hover:text-blue-200 font-semibold text-sm" to={`/mentor/student/${r.student_id}`}>
                      View student
                    </Link>
                  </div>
                ))}
                {needHelp.length === 0 && <div className="text-slate-400">No help requests right now.</div>}
              </div>
            </Card>

            <Card title="⚡ I need something to do">
              <div className="grid gap-2">
                {needTask.map(r => (
                  <div key={r.student_id} className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
                    <div className="font-bold">{r.full_name}</div>
                    <div className="text-xs text-slate-400">
                      {r.subteam || "—"} • clicked {toTime(r.need_task_at)}
                    </div>
                    <div className="text-sm text-slate-200 mt-1">{r.working_on || ""}</div>
                    <Link className="text-blue-300 hover:text-blue-200 font-semibold text-sm" to={`/mentor/student/${r.student_id}`}>
                      View student
                    </Link>
                  </div>
                ))}
                {needTask.length === 0 && <div className="text-slate-400">No “task” requests right now.</div>}
              </div>
            </Card>
          </div>

          <Card title="All students (click a card)">
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {rows.map(r => {
                const state = r.clock_in_at && !r.clock_out_at ? "IN" : r.clock_in_at && r.clock_out_at ? "OUT" : "—";
                const badge =
                  state === "IN" ? "bg-blue-600 border-blue-500" :
                  state === "OUT" ? "bg-slate-700 border-slate-500" :
                  "bg-slate-950 border-slate-800";

                return (
                  <Link
                    key={r.student_id}
                    to={`/mentor/student/${r.student_id}`}
                    className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 hover:bg-slate-900/40 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`px-2 py-1 rounded-lg border text-xs font-bold ${badge}`}>{state}</div>
                      <div className="flex-1">
                        <div className="font-extrabold">{r.full_name}</div>
                        <div className="text-xs text-slate-400">{r.subteam || "—"}</div>
                        <div className="text-sm text-slate-200 mt-2 line-clamp-2">{r.working_on || ""}</div>
                        <div className="text-xs text-slate-400 mt-2">
                          In: <span className="text-white">{toTime(r.clock_in_at)}</span> • Out:{" "}
                          <span className="text-white">{toTime(r.clock_out_at)}</span>
                        </div>
                        {(r.need_help || r.need_task) && (
                          <div className="mt-2 text-xs">
                            {r.need_help && (
                              <span className="mr-2 px-2 py-1 rounded-lg bg-warlocksGold text-slate-950 font-bold">
                                HELP
                              </span>
                            )}
                            {r.need_task && (
                              <span className="px-2 py-1 rounded-lg bg-warlocksGold text-slate-950 font-bold">
                                TASK
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === "report" && (
        <Card
          title="Attendance report (date range)"
          right={
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-300">Start</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-xl bg-slate-950 border-slate-800 text-white"
              />
              <span className="text-slate-300">End</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-xl bg-slate-950 border-slate-800 text-white"
              />
              <button
                onClick={() => reportRows.length && downloadCSV(`warlocks1507_attendance_${start}_to_${end}.csv`, reportRows)}
                className="ml-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold"
              >
                Export CSV
              </button>
            </div>
          }
        >
          <div className="text-xs text-slate-400 mb-4">
            Counts days clocked in and totals hours (clock-in to clock-out; if no clock-out, hours are treated as 0 for that day).
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-300">
                <tr className="border-b border-slate-800">
                  <th className="py-2 text-left">Student</th>
                  <th className="py-2 text-left">Subteam</th>
                  <th className="py-2 text-left">Days clocked in</th>
                  <th className="py-2 text-left">Hours total</th>
                  <th className="py-2 text-left">Last day</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map(r => (
                  <tr key={r.student_id} className="border-b border-slate-900">
                    <td className="py-2 font-semibold text-slate-200">{r.full_name}</td>
                    <td className="py-2 text-slate-200">{r.subteam || "—"}</td>
                    <td className="py-2 text-slate-200">{r.days_clocked_in}</td>
                    <td className="py-2 text-slate-200">{r.hours_total}</td>
                    <td className="py-2 text-slate-200">{r.last_day ? formatDateEastern(r.last_day) : "—"}</td>
                  </tr>
                ))}
                {reportRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-4 text-slate-400">No data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "corrections" && (
        <div className="grid gap-6">
          <Card
            title="Attendance correction requests"
            right={
              <div className="flex items-center gap-2">
                <select
                  value={correctionStatus}
                  onChange={(e) => setCorrectionStatus(e.target.value)}
                  className="rounded-xl bg-slate-950 border-slate-800 text-white text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="denied">Denied</option>
                  <option value="all">All</option>
                </select>
                <button
                  onClick={refreshCorrections}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold text-sm"
                >
                  Refresh
                </button>
              </div>
            }
          >
            <div className="grid gap-3">
              {correctionRows.map((r) => (
                <div key={r.id} className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-extrabold text-slate-100">{r.full_name}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Date: <span className="text-slate-200 font-semibold">{formatDateEastern(r.meeting_date)}</span>
                        {" "}• In: <span className="text-slate-200 font-semibold">{r.requested_clock_in?.slice(0,5)}</span>
                        {" "}• Out: <span className="text-slate-200 font-semibold">{r.requested_clock_out ? r.requested_clock_out.slice(0,5) : "—"}</span>
                        {" "}• Status: <span className="text-slate-200 font-semibold">{r.status}</span>
                      </div>
                      <div className="text-sm text-slate-200 mt-2">{r.reason}</div>
                    </div>

                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => decideCorrection(r.id, "approved")}
                          className="rounded-xl px-3 py-2 font-bold border bg-blue-600 hover:bg-blue-500 border-blue-500/50 text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => decideCorrection(r.id, "denied")}
                          className="rounded-xl px-3 py-2 font-bold border bg-slate-900 hover:bg-slate-800 border-slate-700 text-sm"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {correctionRows.length === 0 && (
                <div className="text-slate-400">No correction requests.</div>
              )}
            </div>
          </Card>

          <Card title="Manual attendance entry (paper backfill)">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-slate-200">
                Student
                <select
                  value={manualStudentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setManualStudentId(id);
                    const s = roster.find(x => String(x.id) === String(id));
                    setManualSubteam(s?.subteam || "");
                  }}
                  className="mt-1 w-full rounded-xl bg-slate-950 border-slate-800 text-white"
                >
                  <option value="">-- Select --</option>
                  {roster.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}{s.subteam ? ` (${s.subteam})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-200">
                Date
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-950 border-slate-800 text-white"
                />
              </label>

              <label className="text-sm font-semibold text-slate-200">
                Clock-in
                <input
                  type="time"
                  value={manualIn}
                  onChange={(e) => setManualIn(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-950 border-slate-800 text-white"
                />
              </label>

              <label className="text-sm font-semibold text-slate-200">
                Clock-out
                <input
                  type="time"
                  value={manualOut}
                  onChange={(e) => setManualOut(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-950 border-slate-800 text-white"
                />
              </label>

              <label className="text-sm font-semibold text-slate-200">
                Subteam (optional)
                <input
                  value={manualSubteam}
                  onChange={(e) => setManualSubteam(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-950 border-slate-800 text-white px-3 py-2"
                />
              </label>

              <label className="text-sm font-semibold text-slate-200">
                Working on (optional)
                <input
                  value={manualWorkingOn}
                  onChange={(e) => setManualWorkingOn(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-950 border-slate-800 text-white px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4">
              <button
                onClick={submitManualAttendance}
                className="rounded-xl px-4 py-2 font-bold border bg-blue-600 hover:bg-blue-500 border-blue-500/50"
              >
                Save Attendance
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
