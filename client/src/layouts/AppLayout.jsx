import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  CalendarDays,
  Percent,
  Receipt,
  Layers,
  ArrowLeft,
  Shield,
} from 'lucide-react';

const catalogNav = [
  { name: 'Products & Variants', path: '/app/catalog/products', icon: Package },
  { name: 'Subscription Plans', path: '/app/catalog/plans', icon: CalendarDays },
  { name: 'Tax Rates', path: '/app/catalog/taxes', icon: Receipt },
  { name: 'Discount Rules', path: '/app/catalog/discounts', icon: Percent },
];

export default function AppLayout() {
  const { user, role, switchRole } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
                ⚡
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-white block">
                  Brightloop
                </span>
                <span className="text-[10px] text-indigo-400 block -mt-0.5 font-medium">
                  Subscription Engine
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Section */}
          <div className="p-4 space-y-6">
            <div>
              <span className="px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                Catalog Management
              </span>
              <nav className="mt-2 space-y-1">
                {catalogNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <span className="px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                System
              </span>
              <div className="mt-2 space-y-1">
                <Link
                  to="/"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Landing Page</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* User & Role Switcher in Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3 h-3 text-indigo-400" />
              Demo Role Tester
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs mb-3">
            <button
              type="button"
              onClick={() => switchRole('ADMIN')}
              className={`py-1 text-center font-medium rounded transition ${
                role === 'ADMIN'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => switchRole('STAFF')}
              className={`py-1 text-center font-medium rounded transition ${
                role === 'STAFF'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Staff
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h1 className="text-sm font-semibold text-slate-200">Catalog Module &bull; Member 2</h1>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                role === 'ADMIN'
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              Active Role: {role}
            </span>
          </div>
        </header>

        {/* Screen Outlet */}
        <main className="p-6 md:p-8 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
