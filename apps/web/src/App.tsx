import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import PortalLayout from './components/PortalLayout';
import LoginPage from './features/auth/LoginPage';

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
              <Route path="/app/dashboard"    element={<Placeholder name="Dashboard (Lane A)" />} />
              <Route path="/app/quotations/*" element={<Placeholder name="Quotations (Lane A)" />} />
              <Route path="/app/approvals/*"  element={<Placeholder name="Approvals (Lane A)" />} />
              <Route path="/app/config"       element={<Placeholder name="Config (Lane A)" />} />
              {/* Lane B */}
              <Route path="/app/fulfillment/*" element={<Placeholder name="Fulfillment (Lane B)" />} />
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
