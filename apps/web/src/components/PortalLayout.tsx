/**
 * PortalLayout — customer-facing layout (Screen 11)
 *
 * Completely separate branding and navigation from AppLayout.
 * NEVER renders internal fields (margin, cost, risk, approval notes).
 *
 * Spec ref: §8.21 — /portal/* is a hard security boundary.
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top nav bar — distinct from internal sidebar */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white">
              Deal<span className="text-brand-500">Flow</span>
            </span>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Customer Portal</span>
          </div>

          <nav className="flex items-center gap-6">
            <NavLink
              to="/portal/quotations"
              className={({ isActive }) =>
                `text-sm transition ${isActive ? 'text-brand-400 font-medium' : 'text-gray-400 hover:text-gray-200'}`
              }
            >
              My Quotations
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              id="portal-logout"
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-400 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
