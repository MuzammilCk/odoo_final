import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import PortalLayout from './components/PortalLayout';
import LoginPage from './features/auth/LoginPage';

// Lane A Pages
import DashboardPage from './features/dashboard/DashboardPage';
import QuotationListPage from './features/quotations/QuotationListPage';
import QuotationDetailPage from './features/quotations/QuotationDetailPage';
import ApprovalListPage from './features/approvals/ApprovalListPage';
import ApprovalDetailPage from './features/approvals/ApprovalDetailPage';
import DiscountConfigPage from './features/admin/discount-config/DiscountConfigPage';

// Lane B Pages
import FulfillmentListPage from './features/fulfillment/FulfillmentListPage';
import FulfillmentDetailPage from './features/fulfillment/FulfillmentDetailPage';
import PortalQuotationListPage from './features/portal/PortalQuotationListPage';
import PortalQuotationDetailPage from './features/portal/PortalQuotationDetailPage';

// ── Placeholder — replaced by each lane's real pages ──────────────────────────
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
              <Route path="/app/dashboard" element={<DashboardPage />} />
              <Route path="/app/quotations" element={<QuotationListPage />} />
              <Route path="/app/quotations/:id" element={<QuotationDetailPage />} />
              <Route path="/app/approvals" element={<ApprovalListPage />} />
              <Route path="/app/approvals/:id" element={<ApprovalDetailPage />} />
              <Route path="/app/config" element={<DiscountConfigPage />} />

              {/* Lane B */}
              <Route path="/app/fulfillment"     element={<FulfillmentListPage />} />
              <Route path="/app/fulfillment/:id" element={<FulfillmentDetailPage />} />

              {/* Lane C */}
              <Route path="/app/products/*"      element={<Placeholder name="Products (Lane C)" />} />
              <Route path="/app/subscriptions/*" element={<Placeholder name="Subscriptions (Lane C)" />} />
              <Route path="/app/invoices/*"      element={<Placeholder name="Invoices (Lane C)" />} />
              <Route path="/app/deal-health"     element={<Placeholder name="Deal Health (Lane C)" />} />
              <Route path="/app/reporting"       element={<Placeholder name="Reporting (Lane C)" />} />
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
              <Route path="/portal/quotations"     element={<PortalQuotationListPage />} />
              <Route path="/portal/quotations/:id" element={<PortalQuotationDetailPage />} />
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
