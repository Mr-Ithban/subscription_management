import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LandingPage from './pages/LandingPage';
import ProductsPage from './pages/catalog/ProductsPage';
import PlansPage from './pages/catalog/PlansPage';
import TaxesPage from './pages/catalog/TaxesPage';
import DiscountsPage from './pages/catalog/DiscountsPage';

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
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Catalog Module Routes under /app/catalog/* */}
            <Route
              path="/app"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/catalog/products" replace />} />
              <Route path="catalog">
                <Route index element={<Navigate to="/app/catalog/products" replace />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="plans" element={<PlansPage />} />
                <Route path="taxes" element={<TaxesPage />} />
                <Route path="discounts" element={<DiscountsPage />} />
              </Route>
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

