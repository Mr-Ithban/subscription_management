import { LogOut } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const links = [['/admin', 'Overview'], ['/admin/catalog', 'Catalog'], ['/admin/subscriptions', 'Subscriptions'], ['/admin/invoices', 'Invoices'], ['/admin/payments', 'Payments'], ['/admin/reports', 'Reports'], ['/admin/staff', 'Staff']];
  return <div className="min-h-screen bg-slate-950 text-slate-100"><header className="border-b border-slate-800"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link to="/admin" className="font-bold">Brightloop <span className="text-violet-300">Admin</span></Link><div className="flex items-center gap-4 text-sm text-slate-300"><span>{user?.name || user?.email}</span><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2"><LogOut size={16} /> Sign out</button></div></div></header><div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[190px_1fr]"><nav className="flex gap-2 overflow-x-auto md:block md:space-y-1">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => `block shrink-0 rounded-lg px-3 py-2.5 text-sm ${isActive ? 'bg-violet-500/15 text-violet-300' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>{label}</NavLink>)}</nav><main className="min-w-0"><Outlet /></main></div></div>;
}
