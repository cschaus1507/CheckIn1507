import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Card from "../components/Card.jsx";
import { api } from "../api.js";

function toTime(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MentorStudent() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { student, sessions } = await api(`/api/mentor/student/${id}`);
        setStudent(student);
        setSessions(sessions);
        setMsg("");
      } catch (e) {
        setMsg(e.message);
      }
    })();
  }, [id]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <Link to="/mentor" className="text-blue-300 hover:text-blue-200 font-semibold">← Back to Mentor</Link>
      </div>

      {msg && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">{msg}</div>
      )}

      {student && (
        <Card
          title={student.full_name}
          right={student.subteam ? <span className="text-xs px-3 py-1 rounded-xl bg-slate-950 border border-slate-800">{student.subteam}</span> : null}
        >
          <div className="text-slate-300 text-sm mb-4">Recent sessions (last 30)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-300">
                <tr className="border-b border-slate-800">
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-left">Clock in</th>
                  <th className="py-2 text-left">Clock out</th>
                  <th className="py-2 text-left">Subteam</th>
                  <th className="py-2 text-left">Working on</th>
                  <th className="py-2 text-left">Help/Task</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-slate-900">
                    <td className="py-2 text-slate-200">{s.meeting_date}</td>
                    <td className="py-2 text-slate-200">{toTime(s.clock_in_at)}</td>
                    <td className="py-2 text-slate-200">{toTime(s.clock_out_at)}</td>
                    <td className="py-2 text-slate-200">{s.subteam || "—"}</td>
                    <td className="py-2 text-slate-200">{s.working_on}</td>
                    <td className="py-2">
                      {s.need_help && <span className="mr-2 px-2 py-1 rounded-lg bg-warlocksGold text-slate-950 font-bold text-xs">HELP</span>}
                      {s.need_task && <span className="px-2 py-1 rounded-lg bg-warlocksGold text-slate-950 font-bold text-xs">TASK</span>}
                      {!s.need_help && !s.need_task && <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan="6" className="py-4 text-slate-400">No sessions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
