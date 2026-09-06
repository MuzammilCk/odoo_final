/**
 * AppLayout — internal staff layout with sidebar navigation
 *
 * UI/UX Upgrade (design-taste-frontend + emil-design-eng):
 * - Active pill with brand-500 fill (not harsh neon glow)
 * - Refined user profile card
 * - Section labels as muted dividers (not ALL-CAPS headers)
 * - Keyboard-accessible NavLinks with focus-visible rings
 * - Scroll-containment on nav for many items
 *
 * Spec ref: §8.21 (/app/* is internal boundary — no customer data leakage)
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  PackageCheck,
  Tag,
  Repeat,
  Receipt,
  Activity,
  BarChart3,
  Sliders,
  LogOut,
  Shield,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Commercial',
    items: [
      { to: '/app/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
      { to: '/app/quotations', label: 'Quotations', icon: FileText },
      { to: '/app/approvals',  label: 'Approvals',  icon: CheckCircle2 },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/app/fulfillment', label: 'Fulfillment', icon: PackageCheck },
    ],
  },
  {
    title: 'Revenue & Billing',
    items: [
      { to: '/app/products',      label: 'Products',      icon: Tag },
      { to: '/app/subscriptions', label: 'Subscriptions', icon: Repeat },
      { to: '/app/invoices',      label: 'Invoices',      icon: Receipt },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { to: '/app/deal-health', label: 'Deal Health', icon: Activity },
      { to: '/app/reporting',   label: 'Reporting',   icon: BarChart3 },
    ],
  },
  {
    title: 'System',
    items: [
      {
        to: '/app/config', label: 'Discount Config', icon: Sliders,
        roles: ['MANAGER', 'ADMIN'],
      },
    ],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex h-screen bg-surface-canvas text-slate-100 antialiased overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 bg-surface-base border-r border-surface-border flex flex-col z-20">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-black text-xs shadow-subtle ring-1 ring-white/15"
              aria-hidden="true"
            >
              D
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-bold text-white tracking-tight">
                Deal<span className="text-brand-400">Flow</span>360
              </span>
              <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500 mt-0.5">CPQ Engine</span>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-surface-elevated border border-surface-border text-slate-500"
            title="Internal access only"
          >
            <Shield size={9} className="text-slate-500" aria-hidden="true" />
            Internal
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4" aria-label="Main navigation">
          {NAV_SECTIONS.map(section => {
            const visibleItems = section.items.filter(
              item => !item.roles || item.roles.includes(user?.role as UserRole),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="px-2.5 mb-1 text-[10px] font-medium tracking-wider text-slate-600 uppercase select-none">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          [
                            'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium',
                            'transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                            isActive
                              ? 'bg-brand-500/15 text-white'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated/60',
                          ].join(' ')
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              size={15}
                              aria-hidden="true"
                              className={`shrink-0 transition-colors duration-150 ${isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                            />
                            <span className="truncate">{item.label}</span>
                            {isActive && (
                              <span
                                className="ml-auto w-1 h-4 rounded-full bg-brand-400"
                                aria-hidden="true"
                              />
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-2.5 border-t border-surface-border">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-surface-card/50 border border-surface-border min-w-0">
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0 ring-1 ring-white/10"
              aria-hidden="true"
            >
              {initials}
            </div>
            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-200 truncate leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[9px] font-mono text-slate-500 truncate mt-0.5 uppercase tracking-wide">
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
            {/* Logout */}
            <button
              id="sidebar-logout"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="shrink-0 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-surface-elevated rounded-lg transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              <LogOut size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto bg-surface-canvas" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
