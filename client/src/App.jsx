import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from './pages/auth';
import { PortalSection, RoleHome } from './pages/RoleHome';
import AdminLayout from './layouts/AdminLayout';
import CustomerLayout from './layouts/CustomerLayout';
import StaffLayout from './layouts/StaffLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import StaffList from './pages/staff/StaffList';
import PageHeader from './components/PageHeader';
import { useAuth } from './auth/useAuth';
import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

function ForbiddenPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-center text-slate-100"><div><h1 className="text-3xl font-bold">Access denied</h1><p className="mt-2 text-slate-400">Your account does not have permission to view this page.</p><Link className="mt-5 inline-block text-indigo-300" to="/">Return home</Link></div></main>;
}

function NotFoundPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-center text-slate-100"><div><p className="text-sm font-semibold text-indigo-300">404</p><h1 className="mt-2 text-3xl font-bold">Page not found</h1><p className="mt-2 text-slate-400">The page you requested does not exist.</p><Link className="mt-5 inline-block text-indigo-300" to="/">Return home</Link></div></main>;
}

function CustomerProfile() {
  const { user, customer } = useAuth();
  return <><PageHeader title="My profile" description="Your account details." /><div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs uppercase text-slate-500">Name</dt><dd className="mt-1">{customer?.name || user?.name || '—'}</dd></div><div><dt className="text-xs uppercase text-slate-500">Email</dt><dd className="mt-1">{user?.email}</dd></div><div><dt className="text-xs uppercase text-slate-500">Phone</dt><dd className="mt-1">{customer?.phone || '—'}</dd></div><div><dt className="text-xs uppercase text-slate-500">Address</dt><dd className="mt-1">{customer?.address || '—'}</dd></div></dl></div></>;
}

function WorkspaceLayout() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <AdminLayout /> : <StaffLayout />;
}

function WorkspaceHome() {
  const { user } = useAuth();
  return <RoleHome role={user?.role} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']} />}>
              <Route path="/app" element={<WorkspaceLayout />}>
                <Route index element={<WorkspaceHome />} />
                <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                  <Route path="staff" element={<StaffList />} />
                </Route>
                <Route path="catalog" element={<PortalSection title="Catalog" />} />
                <Route path="subscriptions" element={<PortalSection title="Subscriptions" />} />
                <Route path="invoices" element={<PortalSection title="Invoices" />} />
                <Route path="payments" element={<PortalSection title="Payments" />} />
                <Route path="reports" element={<PortalSection title="Reports" />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route path="/portal" element={<CustomerLayout />}>
                <Route index element={<RoleHome role="CUSTOMER" />} />
                <Route path="subscriptions" element={<PortalSection title="Subscriptions" />} />
                <Route path="invoices" element={<PortalSection title="Invoices" />} />
              <Route path="payments" element={<PortalSection title="Payments" />} />
                <Route path="profile" element={<CustomerProfile />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['STAFF']} />}>
              <Route path="/staff" element={<StaffLayout />}><Route index element={<RoleHome role="STAFF" />} /></Route>
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin" element={<AdminLayout />}><Route index element={<RoleHome role="ADMIN" />} /><Route path="staff" element={<StaffList />} /><Route path="catalog" element={<PortalSection title="Catalog" />} /><Route path="subscriptions" element={<PortalSection title="Subscriptions" />} /><Route path="invoices" element={<PortalSection title="Invoices" />} /><Route path="payments" element={<PortalSection title="Payments" />} /><Route path="reports" element={<PortalSection title="Reports" />} /></Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
