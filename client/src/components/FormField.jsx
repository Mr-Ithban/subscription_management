export default function FormField({
  label,
  error,
  required = false,
  helperText,
  className = '',
  children,
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-300">
          {label}
          {required && <span className="text-rose-400 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-rose-400 flex items-center gap-1 mt-1 font-medium">
          <span>⚠️</span> {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-[11px] text-slate-400 mt-1">{helperText}</p>
      )}
    </div>
  );
}
