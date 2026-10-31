import React from 'react';

const STATUS_STYLES = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CONFIRMED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  QUOTATION: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  DRAFT: 'bg-slate-50 text-slate-700 ring-slate-600/20',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  CLOSED: 'bg-zinc-100 text-zinc-700 ring-zinc-600/20',
  PAUSED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  OVERDUE: 'bg-red-50 text-red-700 ring-red-600/20',
};

export default function StatusBadge({ status, label }) {
  const norm = String(status || '').toUpperCase();
  const style = STATUS_STYLES[norm] || 'bg-gray-50 text-gray-700 ring-gray-600/20';

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label || status}
    </span>
  );
}

