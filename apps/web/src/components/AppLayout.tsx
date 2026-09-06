/**
 * AppLayout — internal staff layout with sidebar navigation
 * Upgraded with ui-ux-pro-max design system:
 * - Lucide SVG icons (no emojis)
 * - Sectioned navigation categories
 * - Brand badge & role indicator
 * - Polished surface elevation tokens
 *
 * Spec ref: §8.21 (/app/* is internal boundary — no customer data leakage)
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';
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
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles?: UserRole[]; // if set, only these roles see this link
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'COMMERCIAL',
    items: [
      { to: '/app/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
      { to: '/app/quotations', label: 'Quotations', icon: FileText },
      // All internal users can track approval status (Sales Rep tracks their own quotes)
      { to: '/app/approvals',  label: 'Approvals',  icon: CheckCircle2 },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { to: '/app/fulfillment', label: 'Fulfillment', icon: PackageCheck },
    ],
  },
  {
    title: 'REVENUE & BILLING',
    items: [
      { to: '/app/products', label: 'Products', icon: Tag },
      { to: '/app/subscriptions', label: 'Subscriptions', icon: Repeat },
      { to: '/app/invoices', label: 'Invoices', icon: Receipt },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { to: '/app/deal-health', label: 'Deal Health', icon: Activity },
      { to: '/app/reporting', label: 'Reporting', icon: BarChart3 },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      {
        // Manager configures discount tiers/approval chains; Admin manages all backend
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

  return (
    <div className="flex h-screen bg-surface-canvas text-slate-100 antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-surface-base border-r border-surface-border flex flex-col z-20">
        {/* Logo Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-brand-500/25 ring-1 ring-white/20">
              D
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-white tracking-tight leading-none">
                Deal<span className="text-brand-400">Flow</span>360
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mt-1">CPQ Engine</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-400">
            <Shield size={10} className="text-brand-400" />
            Internal
          </span>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_SECTIONS.map(section => {
            const visibleItems = section.items.filter(
              item => !item.roles || item.roles.includes(user?.role as UserRole)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title} className="space-y-1">
                <div className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                            isActive
                              ? 'bg-brand-500/15 text-white shadow-sm ring-1 ring-brand-500/30'
                              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-elevated/70'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={`transition-colors duration-150 ${
                                isActive ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                              }`}
                            >
                              <Icon size={17} />
                            </span>
                            <span className="truncate">{item.label}</span>
                            {isActive && (
                              <span className="absolute right-2.5 w-1.5 h-1.5 rounded-full bg-brand-400 shadow-[0_0_8px_#38bdf8]" />
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

        {/* User Profile Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-base/80">
          <div className="p-2 rounded-lg bg-surface-card/60 border border-surface-border/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-white/10 shrink-0">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-100 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[10px] font-mono text-brand-400 truncate uppercase tracking-tight">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
            <button
              id="sidebar-logout"
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-surface-elevated rounded-md transition cursor-pointer shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-surface-canvas relative">
        <Outlet />
      </main>
    </div>
  );
}
