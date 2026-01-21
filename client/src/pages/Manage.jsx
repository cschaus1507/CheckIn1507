import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import BoltMark from "../components/BoltMark.jsx";
import { api } from "../api.js";

const SUBTEAMS = ["", "Build", "Programming", "Electrical", "CAD/CAM", "Imagery & Outreach"];

export default function Manage() {
  const [ready, setReady] = useState(false);
  const [students, setStudents] = useState([]);
  const [msg, setMsg] = useState("");

  const [fullName, setFullName] = useState("");
  const [subteam, setSubteam] = useState("");

  // Prompt for manager key once per session
  useEffect(() => {
    const existing = sessionStorage.getItem("managerKey");
    if (!existing) {
      const entered = window.prompt("Enter Manager Access Key");
      if (entered) sessionStorage.setItem("managerKey", entered);
    }
    setReady(true);
  }, []);

  async function load() {
    try {
      const { students } = await api("/api/admin/students");
      setStudents(students);
      setMsg("");
    } catch (e) {
      setMsg(e.message);
    }
  }

  useEffect(() => {
    if (!ready) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function addStudent(e) {
    e.preventDefault();
    try {
      const name = fullName.trim();
      if (!name) {
        setMsg("Missing full name.");
        return;
      }

      // Backend expects snake_case keys
      await api("/api/admin/students", {
        method: "POST",
        body: JSON.stringify({ full_name: name, subteam })
      });

      setFullName("");
      setSubteam("");
      await load();
      setMsg("✅ Added/updated.");
    } catch (e2) {
      setMsg(e2.message);
    }
  }

  async function toggleActive(s) {
    try {
      // Backend expects snake_case keys
      await api(`/api/admin/students/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !s.is_active })
      });
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function updateSubteam(s, next) {
    try {
      await api(`/api/admin/students/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ subteam: next })
      });
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  if (!ready) return null;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/70 to-slate-900/20 p-6 flex items-start gap-4">
        <BoltMark className="mt-1" />
        <div>
          <div className="text-3xl font-extrabold">
            <span className="text-warlocksGold">Manage</span>{" "}
            <span className="text-blue-400">Team Members</span>
          </div>
          <div className="text-slate-300 mt-1">Add, update, or deactivate students in the roster.</div>
          <div className="text-slate-500 text-sm mt-2">
            This page is intentionally not linked in the navbar: go directly to <span className="text-slate-300 font-semibold">/manage</span>.
          </div>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
          {msg}
        </div>
      )}

      <Card title="Add a student">
        <form onSubmit={addStudent} className="grid md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2 min-w-0">
            <label className="block text-sm font-semibold text-slate-200 mb-2">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border-slate-800 text-white"
              placeholder="Doe, Jane"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-semibold text-slate-200 mb-2">Subteam</label>
            <select
              value={subteam}
              onChange={(e) => setSubteam(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border-slate-800 text-white"
            >
              {SUBTEAMS.map((s) => (
                <option key={s} value={s}>
                  {s || "—"}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="md:col-span-3 rounded-xl px-4 py-3 font-bold bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/20"
          >
            Add / Update Student
          </button>
        </form>
      </Card>

      <Card title="Roster">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-300">
              <tr className="border-b border-slate-800">
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Subteam</th>
                <th className="py-2 text-left">Active</th>
                <th className="py-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-900">
                  <td className="py-2 text-slate-200 font-semibold">{s.full_name}</td>
                  <td className="py-2">
                    <select
                      value={s.subteam || ""}
                      onChange={(e) => updateSubteam(s, e.target.value)}
                      className="rounded-xl bg-slate-950 border-slate-800 text-white px-3 py-2"
                    >
                      {SUBTEAMS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt || "—"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-slate-200">{s.is_active ? "Yes" : "No"}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(s)}
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900/40 font-semibold text-white"
                    >
                      {s.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-4 text-slate-400">
                    No students yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
