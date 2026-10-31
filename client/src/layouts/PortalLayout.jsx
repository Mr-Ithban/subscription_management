import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CreditCard, Receipt, LogOut, Menu, X, UserRound, Layers } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

const portalNav = [
  { label: 'My Payments', to: '/portal/my-payments', icon: CreditCard },
  { label: 'My Invoices', to: '/portal/my-invoices', icon: Receipt },
  { label: 'Subscriptions', to: '/portal/subscriptions', icon: Layers },
  { label: 'My Profile', to: '/portal/profile', icon: UserRound },
];

function SidebarLink({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
          isActive
            ? 'bg-emerald-700 text-white'
            : 'text-emerald-100 hover:bg-emerald-700/50 hover:text-white'
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {item.label}
    </NavLink>
  );
}

export default function PortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-emerald-800 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6">
          <span className="text-xl font-bold text-white tracking-tight">
            Bright<span className="text-emerald-300">loop</span>
            <span className="ml-2 text-xs font-normal text-emerald-300">Portal</span>
          </span>
          <button
            className="lg:hidden text-emerald-200 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {portalNav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="border-t border-emerald-700 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-700/50 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6 shadow-sm">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-gray-500">{user?.name || user?.email}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
