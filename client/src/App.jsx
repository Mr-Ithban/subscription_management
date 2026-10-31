import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from './pages/AuthPages';
import { PortalSection, RoleHome } from './pages/RoleHome';
import AdminLayout from './layouts/AdminLayout';
import PortalLayout from './layouts/PortalLayout';
import StaffLayout from './layouts/StaffLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

function ForbiddenPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-center text-slate-100"><div><h1 className="text-3xl font-bold">Access denied</h1><p className="mt-2 text-slate-400">Your account does not have permission to view this page.</p><Link className="mt-5 inline-block text-indigo-300" to="/">Return home</Link></div></main>;
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
            <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
              <Route path="/portal" element={<PortalLayout />}>
                <Route index element={<RoleHome role="CUSTOMER" />} />
                <Route path="subscriptions" element={<PortalSection title="Subscriptions" />} />
                <Route path="invoices" element={<PortalSection title="Invoices" />} />
                <Route path="payments" element={<PortalSection title="Payments" />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute roles={['STAFF']} />}>
              <Route path="/staff" element={<StaffLayout />}><Route index element={<RoleHome role="STAFF" />} /></Route>
            </Route>
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/admin" element={<AdminLayout />}><Route index element={<RoleHome role="ADMIN" />} /></Route>
            </Route>
            <Route path="*" element={<ForbiddenPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
