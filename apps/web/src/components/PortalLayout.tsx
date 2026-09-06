/**
 * PortalLayout — customer-facing layout (Screen 11)
 *
 * UI/UX Upgrade:
 * - Trust-first header with refined brand mark
 * - Smooth nav tab transitions
 * - Polished user identity pill
 *
 * Spec ref: §8.21 — /portal/* is a hard security boundary.
 * NEVER renders internal fields (margin, cost, risk, approval notes).
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, LogOut, User } from 'lucide-react';

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-canvas text-slate-100 antialiased">
      {/* ── Top nav bar ───────────────────────────────────────────── */}
      <header className="bg-surface-base/90 backdrop-blur-md border-b border-surface-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-lg bg-gradient-to-br from-deal-500 to-deal-700 flex items-center justify-center text-white font-black text-[11px] shadow-subtle ring-1 ring-white/15"
              aria-hidden="true"
            >
              D
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-white tracking-tight leading-none">
                Deal<span className="text-deal-400">Flow</span>
              </span>
              <span className="text-[10px] font-semibold text-deal-300 bg-deal-500/10 border border-deal-500/20 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-deal-400" aria-hidden="true" />
                Customer Portal
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1" aria-label="Portal navigation">
            <NavLink
              to="/portal/quotations"
              className={({ isActive }) =>
                [
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium',
                  'transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deal-500/50',
                  isActive
                    ? 'bg-deal-500/12 text-deal-300 ring-1 ring-deal-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated',
                ].join(' ')
              }
            >
              <FileText size={13} aria-hidden="true" />
              <span>My Quotations</span>
            </NavLink>
          </nav>

          {/* User identity + logout */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-surface-card px-2.5 py-1.5 rounded-lg border border-surface-border">
              <User size={12} className="text-slate-400" aria-hidden="true" />
              <span className="font-medium">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <button
              id="portal-logout"
              onClick={handleLogout}
              aria-label="Sign out of portal"
              className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              <LogOut size={12} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-6 py-8" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
