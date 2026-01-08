import { NavLink } from "react-router-dom";

const base =
  "px-3 py-2 rounded-xl text-sm font-semibold transition border border-transparent";
const active = "bg-slate-900/60 border-slate-800 text-white";
const inactive = "text-slate-300 hover:text-white hover:bg-slate-900/40 hover:border-slate-800";

export default function Nav() {
  return (
    <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="font-extrabold tracking-tight flex items-center gap-2">
          <span className="text-warlocksGold">⚡</span>
          <span className="text-warlocksGold">Warlocks</span>{" "}
          <span className="text-blue-400">1507</span>
        </div>

        <div className="ml-auto flex gap-2">
          <NavLink to="/" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
            Student
          </NavLink>
          <NavLink to="/mentor" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
            Mentor
          </NavLink>
        </div>
      </div>
    </div>
  );
}
