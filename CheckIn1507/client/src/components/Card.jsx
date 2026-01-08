export default function Card({ title, children, right }) {
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
      {(title || right) && (
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="text-lg font-bold text-white">{title}</div>
          <div className="ml-auto">{right}</div>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
