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
import { FileText, LogOut, Building2 } from 'lucide-react';

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-canvas text-slate-100 antialiased">
      {/* Top nav bar — distinct from internal sidebar */}
      <header className="bg-surface-base/90 backdrop-blur border-b border-surface-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-deal-500 to-emerald-700 flex items-center justify-center text-white font-extrabold text-xs shadow-sm shadow-deal-500/20">
              D
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Deal<span className="text-deal-400">Flow</span>
            </span>
            <span className="text-[11px] font-medium text-deal-300 bg-deal-500/10 border border-deal-500/20 px-2 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-deal-400"></span>
              Customer Portal
            </span>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink
              to="/portal/quotations"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition duration-150 ${
                  isActive
                    ? 'bg-deal-500/15 text-deal-300 ring-1 ring-deal-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                }`
              }
            >
              <FileText size={15} />
              <span>My Quotations</span>
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-300 bg-surface-card px-3 py-1 rounded-full border border-surface-border">
              <Building2 size={13} className="text-slate-400" />
              <span className="font-medium text-xs">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <button
              id="portal-logout"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 px-2 py-1.5 rounded-lg hover:bg-surface-elevated transition cursor-pointer"
            >
              <LogOut size={13} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
