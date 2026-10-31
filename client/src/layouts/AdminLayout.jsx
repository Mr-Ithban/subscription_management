import { LogOut } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  return <div className="min-h-screen bg-slate-950 text-slate-100"><header className="border-b border-slate-800"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link to="/admin" className="font-bold">Brightloop <span className="text-violet-300">Admin</span></Link><div className="flex items-center gap-4 text-sm text-slate-300"><span>{user?.name || user?.email}</span><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2"><LogOut size={16} /> Sign out</button></div></div></header><main className="mx-auto max-w-6xl px-5 py-8"><Outlet /></main></div>;
}
