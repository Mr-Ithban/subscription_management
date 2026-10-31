import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import {
  LayoutDashboard,
  BarChart2,
  CreditCard,
  FileText,
  Users,
  Package,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const adminNav = [
  { label: 'Dashboard', to: '/app/reports/dashboard', icon: LayoutDashboard },
  { label: 'Subscriptions', to: '/app/reports/subscriptions', icon: BarChart2 },
  { label: 'Invoices', to: '/app/invoices', icon: FileText },
  { label: 'Payments', to: '/app/payments', icon: CreditCard },
  { label: 'Products', to: '/app/catalog', icon: Package },
  { label: 'Customers', to: '/app/customers', icon: Users },
];

function SidebarLink({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
          isActive
            ? 'bg-indigo-700 text-white'
            : 'text-indigo-100 hover:bg-indigo-700/50 hover:text-white'
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {item.label}
    </NavLink>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = role === 'ADMIN'
    ? [...adminNav, { label: 'Staff', to: '/app/staff', icon: Users }]
    : adminNav.filter((item) => item.to !== '/app/customers');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-indigo-800 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between px-6">
          <span className="text-xl font-bold text-white tracking-tight">
            Bright<span className="text-indigo-300">loop</span>
          </span>
          <button
            className="lg:hidden text-indigo-200 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {navigation.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-indigo-700 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-700/50 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6 shadow-sm">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-gray-500">{user?.name || user?.email} · {role}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
