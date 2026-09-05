import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import PortalLayout from './components/PortalLayout';
import LoginPage from './features/auth/LoginPage';

// Lane C Feature Pages
import ProductDashboardPage from './features/admin/products/ProductDashboardPage';
import ProductDetailPage from './features/admin/products/ProductDetailPage';
import SubscriptionListPage from './features/subscriptions/SubscriptionListPage';
import SubscriptionDetailPage from './features/subscriptions/SubscriptionDetailPage';
import BillingDetailPage from './features/billing/BillingDetailPage';
import InvoiceListPage from './features/invoices/InvoiceListPage';
import InvoiceDetailPage from './features/invoices/InvoiceDetailPage';
import DealHealthDashboardPage from './features/deal-health/DealHealthDashboardPage';
import ReportingPage from './features/reporting/ReportingPage';

// ── Placeholder — for other lanes' pending screens ──────────────────────────
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-gray-500">
      <div className="text-4xl mb-4">🚧</div>
      <p className="font-mono text-lg">{name}</p>
      <p className="text-sm mt-1 text-gray-600">Under construction — check the lane plan</p>
    </div>
  );
}

const INTERNAL_ROLES = ['ADMIN', 'SALES_REP', 'MANAGER', 'FINANCE_OPS'] as const;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Internal app (/app/*) — requires internal role ── */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[...INTERNAL_ROLES]}
                redirectTo="/login"
              />
            }
          >
            <Route element={<AppLayout />}>
              {/* Lane A */}
              <Route path="/app/dashboard"    element={<Placeholder name="Dashboard (Lane A)" />} />
              <Route path="/app/quotations/*" element={<Placeholder name="Quotations (Lane A)" />} />
              <Route path="/app/approvals/*"  element={<Placeholder name="Approvals (Lane A)" />} />
              <Route path="/app/config"       element={<Placeholder name="Config (Lane A)" />} />
              
              {/* Lane B */}
              <Route path="/app/fulfillment/*" element={<Placeholder name="Fulfillment (Lane B)" />} />
              
              {/* Lane C — Complete */}
              <Route path="/app/products"         element={<ProductDashboardPage />} />
              <Route path="/app/products/:id"     element={<ProductDetailPage />} />
              <Route path="/app/subscriptions"     element={<SubscriptionListPage />} />
              <Route path="/app/subscriptions/:id" element={<SubscriptionDetailPage />} />
              <Route path="/app/billing/:quotationId" element={<BillingDetailPage />} />
              <Route path="/app/invoices"         element={<InvoiceListPage />} />
              <Route path="/app/invoices/:id"     element={<InvoiceDetailPage />} />
              <Route path="/app/deal-health"      element={<DealHealthDashboardPage />} />
              <Route path="/app/reporting"        element={<ReportingPage />} />
            </Route>
          </Route>

          {/* ── Customer portal (/portal/*) — requires CUSTOMER role ── */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={['CUSTOMER']}
                redirectTo="/login"
              />
            }
          >
            <Route element={<PortalLayout />}>
              <Route path="/portal/quotations/*" element={<Placeholder name="My Quotations (Lane B)" />} />
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
