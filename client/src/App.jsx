import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import PortalLayout from './layouts/PortalLayout';
import LandingPage from './pages/LandingPage';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from './pages/auth';
import Dashboard from './pages/reports/Dashboard';
import Subscriptions from './pages/reports/Subscriptions';
import InvoicePayments from './pages/invoices/InvoicePayments';
import MyPayments from './pages/portal/MyPayments';
import MyInvoices from './pages/portal/MyInvoices';
import BillingPage from './pages/billing/BillingPage';
import PortalPage from './pages/portal/PortalPage';
import ProductsPage from './pages/catalog/ProductsPage';
import PlansPage from './pages/catalog/PlansPage';
import TaxesPage from './pages/catalog/TaxesPage';
import DiscountsPage from './pages/catalog/DiscountsPage';
import StaffList from './pages/staff/StaffList';
import PageHeader from './components/PageHeader';
import { useAuth } from './auth/useAuth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

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

function WorkspaceIndex() {
  const { role } = useAuth();
  return <Navigate to={role === 'ADMIN' || role === 'STAFF' ? '/app/reports/dashboard' : '/login'} replace />;
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
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<WorkspaceIndex />} />
                <Route path="reports/dashboard" element={<Dashboard />} />
                <Route path="reports/subscriptions" element={<Subscriptions />} />
                <Route path="invoices" element={<BillingPage />} />
                <Route path="invoices/:invoiceId/payments" element={<InvoicePayments />} />
                <Route path="payments" element={<Navigate to="/app/reports/dashboard" replace />} />
                <Route path="customers" element={<Navigate to="/app/reports/subscriptions" replace />} />
                <Route path="catalog">
                  <Route index element={<Navigate to="/app/catalog/products" replace />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="plans" element={<PlansPage />} />
                  <Route path="taxes" element={<TaxesPage />} />
                  <Route path="discounts" element={<DiscountsPage />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                  <Route path="staff" element={<StaffList />} />
                </Route>
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route path="/portal" element={<PortalLayout />}>
                <Route index element={<Navigate to="/portal/my-payments" replace />} />
                <Route path="my-payments" element={<MyPayments />} />
                <Route path="my-invoices" element={<MyInvoices />} />
                <Route path="subscriptions" element={<PortalPage />} />
                <Route path="profile" element={<CustomerProfile />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
