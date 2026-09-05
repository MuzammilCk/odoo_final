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

// Lane C Pages
import ProductDashboardPage from './features/admin/products/ProductDashboardPage';
import ProductDetailPage from './features/admin/products/ProductDetailPage';
import SubscriptionListPage from './features/subscriptions/SubscriptionListPage';
import SubscriptionDetailPage from './features/subscriptions/SubscriptionDetailPage';
import BillingDetailPage from './features/billing/BillingDetailPage';
import InvoiceListPage from './features/invoices/InvoiceListPage';
import InvoiceDetailPage from './features/invoices/InvoiceDetailPage';
import DealHealthDashboardPage from './features/deal-health/DealHealthDashboardPage';
import ReportingPage from './features/reporting/ReportingPage';

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
              <Route path="/app/products"            element={<ProductDashboardPage />} />
              <Route path="/app/products/:id"        element={<ProductDetailPage />} />
              <Route path="/app/subscriptions"       element={<SubscriptionListPage />} />
              <Route path="/app/subscriptions/:id"   element={<SubscriptionDetailPage />} />
              <Route path="/app/billing/:quotationId" element={<BillingDetailPage />} />
              <Route path="/app/invoices"            element={<InvoiceListPage />} />
              <Route path="/app/invoices/:id"        element={<InvoiceDetailPage />} />
              <Route path="/app/deal-health"         element={<DealHealthDashboardPage />} />
              <Route path="/app/reporting"           element={<ReportingPage />} />
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
