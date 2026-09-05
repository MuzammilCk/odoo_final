/**
 * AppLayout — internal staff layout with sidebar navigation
 *
 * Screens owned by each lane (§8.21, 01_Team_Role_Division.md):
 *   Lane A: Dashboard, Quotations, Approvals, Config
 *   Lane B: Fulfillment
 *   Lane C: Products, Subscriptions, Billing/Invoices, Deal Health, Reporting
 *
 * Spec ref: §8.21 (/app/* is internal boundary — no customer data leakage)
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  // Lane A
  { to: '/app/dashboard',   label: 'Dashboard',       icon: '⬛', lane: 'A' },
  { to: '/app/quotations',  label: 'Quotations',      icon: '📋', lane: 'A' },
  { to: '/app/approvals',   label: 'Approvals',       icon: '✅', lane: 'A' },
  // Lane B
  { to: '/app/fulfillment', label: 'Fulfillment',     icon: '📦', lane: 'B' },
  // Lane C
  { to: '/app/products',    label: 'Products',        icon: '🏷️', lane: 'C' },
  { to: '/app/subscriptions', label: 'Subscriptions', icon: '🔄', lane: 'C' },
  { to: '/app/invoices',    label: 'Invoices',        icon: '💰', lane: 'C' },
  { to: '/app/deal-health', label: 'Deal Health',     icon: '🩺', lane: 'C' },
  { to: '/app/reporting',   label: 'Reporting',       icon: '📊', lane: 'C' },
  // Lane A (config)
  { to: '/app/config',      label: 'Config',          icon: '⚙️', lane: 'A' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-800">
          <span className="text-xl font-bold text-white">
            Deal<span className="text-brand-500">Flow</span>360
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-3">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-100 ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold text-white">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {user?.role?.toLowerCase().replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            id="sidebar-logout"
            onClick={handleLogout}
            className="w-full text-sm text-gray-400 hover:text-red-400 transition text-left px-2 py-1 rounded hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
