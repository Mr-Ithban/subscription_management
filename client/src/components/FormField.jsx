export default function FormField({ label, error, className = '', ...props }) {
  return <label className={`grid gap-1.5 text-sm text-slate-300 ${className}`}>{label}<input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" {...props} />{error && <span className="text-xs text-rose-300">{error}</span>}</label>;
}
