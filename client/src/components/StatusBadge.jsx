export default function StatusBadge({ status, className = '' }) {
  if (status === undefined || status === null) {
    return null;
  }

  const raw = String(status).toUpperCase();

  const config = {
    ACTIVE: {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-400',
      label: 'Active',
    },
    PAUSED: {
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      dot: 'bg-amber-400',
      label: 'Paused',
    },
    CLOSED: {
      bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      dot: 'bg-slate-400',
      label: 'Closed',
    },
    EXPIRED: {
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      dot: 'bg-rose-400',
      label: 'Expired',
    },
    EXHAUSTED: {
      bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      dot: 'bg-purple-400',
      label: 'Exhausted',
    },
    TRUE: {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-400',
      label: 'Active',
    },
    FALSE: {
      bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      dot: 'bg-slate-400',
      label: 'Inactive',
    },
    GOODS: {
      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      dot: 'bg-blue-400',
      label: 'Goods',
    },
    SERVICE: {
      bg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      dot: 'bg-violet-400',
      label: 'Service',
    },
    CONSUMABLE: {
      bg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      dot: 'bg-orange-400',
      label: 'Consumable',
    },
    PERCENT: {
      bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      dot: 'bg-indigo-400',
      label: 'Percentage',
    },
    FIXED: {
      bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      dot: 'bg-teal-400',
      label: 'Fixed Amount',
    },
    PRODUCT: {
      bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      dot: 'bg-sky-400',
      label: 'Product',
    },
    SUBSCRIPTION: {
      bg: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
      dot: 'bg-fuchsia-400',
      label: 'Subscription',
    },
  };

  const style = config[raw] || {
    bg: 'bg-slate-800 text-slate-300 border-slate-700',
    dot: 'bg-slate-400',
    label: String(status),
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
