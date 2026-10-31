import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import BillingPage from './pages/billing/BillingPage';
import PortalPage from './pages/portal/PortalPage';

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
          <Route path="/" element={<LandingPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/portal" element={<PortalPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
