import React from 'react';

export default function FormField({ label, error, children, required, className = '', ...inputProps }) {
  if (!children) {
    return <label className={`grid gap-1.5 text-sm text-slate-700 ${className}`}>{label}{required && <span className="sr-only"> (required)</span>}<input className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-indigo-500" {...inputProps} />{error && <span className="text-xs text-rose-600">{error}</span>}</label>;
  }
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

