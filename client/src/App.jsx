import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import AppLayout from './layouts/AppLayout';
import PortalLayout from './layouts/PortalLayout';
import Dashboard from './pages/reports/Dashboard';
import Subscriptions from './pages/reports/Subscriptions';
import InvoicePayments from './pages/invoices/InvoicePayments';
import MyPayments from './pages/portal/MyPayments';
import MyInvoices from './pages/portal/MyInvoices';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />

          {/* Admin / Staff app */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/reports/dashboard" replace />} />
            <Route path="reports/dashboard" element={<Dashboard />} />
            <Route path="reports/subscriptions" element={<Subscriptions />} />
            <Route
              path="invoices/:invoiceId/payments"
              element={<InvoicePayments invoice={{}} />}
            />
          </Route>

          {/* Customer Portal */}
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<Navigate to="/portal/my-payments" replace />} />
            <Route path="my-payments" element={<MyPayments />} />
            <Route path="my-invoices" element={<MyInvoices />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
