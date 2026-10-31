import { LogOut, UserRound } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

const nav = [
  { to: '/portal', label: 'Overview', end: true },
  { to: '/portal/subscriptions', label: 'Subscriptions' },
  { to: '/portal/invoices', label: 'Invoices' },
  { to: '/portal/payments', label: 'Payments' },
];

export default function PortalLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/portal" className="font-bold tracking-tight">Brightloop <span className="text-indigo-400">Portal</span></Link>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <span className="hidden sm:inline">{user?.name || user?.email}</span>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800" type="button"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[210px_1fr]">
        <aside className="space-y-2">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><UserRound size={15} /> Customer account</div>
          {nav.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm ${isActive ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>{item.label}</NavLink>)}
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
