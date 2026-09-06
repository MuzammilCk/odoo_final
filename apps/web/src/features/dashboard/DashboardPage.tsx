/**
 * DashboardPage — Commercial Core Overview (Lane A)
 *
 * UI/UX Upgrade:
 * - StatCard components with refined optical shadows and subtle accent bars
 * - Skeleton loading states (no centered spinner)
 * - Pipeline breakdown with segmented bar and mini status grid
 * - Recent contracts table using Table primitives with hover rows
 * - StatusBadge and RiskBadge semantic helpers
 *
 * Spec refs: §7.4 (internal dashboard), §8.21 (/app/*)
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Clock,
  DollarSign,
  Percent,
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge, RiskBadge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { SkeletonCard, SkeletonTable, SkeletonPageHeader } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

interface DashboardMetrics {
  totalQuotations: number;
  statusCounts: Record<string, number>;
  pendingApprovalsCount: number;
  totalRevenue: number;
  avgMarginPercent: number;
}

interface RecentQuotation {
  id: string;
  quoteNumber: string;
  currentVersion: number;
  status: string;
  riskLevel: string;
  grandTotal: number | string;
  marginPercent: number | string;
  updatedAt: string;
  customer?: { id: string; name: string };
  salesRep?: { id: string; firstName: string; lastName: string };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:             'bg-slate-600',
  PENDING_APPROVAL:  'bg-amber-400',
  APPROVED:          'bg-emerald-400',
  CONFIRMED:         'bg-brand-400',
  UNDER_NEGOTIATION: 'bg-purple-400',
  REJECTED:          'bg-rose-400',
};

export default function DashboardPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentQuotations, setRecentQuotations] = useState<RecentQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      logout();
      navigate('/login', { replace: true });
      return;
    }

    async function fetchDashboard() {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/internal/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        if (!res.ok) throw new Error(`Failed to load dashboard: ${res.statusText}`);
        const data = await res.json();
        setMetrics(data.metrics);
        setRecentQuotations(data.recentQuotations);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [token, logout, navigate]);

  const totalInPipeline = metrics
    ? Object.values(metrics.statusCounts).reduce((a, b) => a + b, 0) || 1
    : 1;

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-7">
        <SkeletonPageHeader />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={5} cols={7} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <AlertBanner variant="error" title="Error loading dashboard" message={error} live />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Commercial Overview</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-deal-500/10 text-deal-300 border border-deal-500/20">
              Live
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Welcome back,{' '}
            <span className="text-slate-200 font-medium">{user?.firstName}</span>
            {' · '}
            <span className="font-mono text-brand-400 text-[11px]">{user?.role?.replace(/_/g, ' ')}</span>
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Quotations"
            value={metrics.totalQuotations}
            icon={<FileText size={14} />}
            footnote={`${metrics.statusCounts.DRAFT ?? 0} in draft`}
            accent="brand"
          />
          <StatCard
            title="Pending Approvals"
            value={metrics.pendingApprovalsCount}
            icon={<Clock size={14} />}
            accent="amber"
            action={
              <Link
                to="/app/approvals"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Review <ArrowUpRight size={11} />
              </Link>
            }
          />
          <StatCard
            title="Recognized Revenue"
            value={`$${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign size={14} />}
            footnote="Approved & confirmed orders"
            footnoteIcon={<TrendingUp size={11} className="text-deal-400" />}
            accent="deal"
          />
          <StatCard
            title="Avg Commercial Margin"
            value={`${metrics.avgMarginPercent}%`}
            icon={<Percent size={14} />}
            footnote="Target margin governance ceiling"
            accent="blue"
          />
        </div>
      )}

      {/* Pipeline Breakdown */}
      {metrics && (
        <Card>
          <CardHeader bordered>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pipeline Breakdown & Velocity</CardTitle>
                <CardDescription>Distribution of quotes across lifecycle stages</CardDescription>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Total: <strong className="text-slate-200">{metrics.totalQuotations}</strong>
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Segmented progress bar */}
            <div className="h-2 w-full bg-surface-base rounded-full overflow-hidden flex gap-0.5 mb-5" aria-hidden="true">
              {Object.entries(metrics.statusCounts).map(([status, count]) => {
                if (count === 0) return null;
                const widthPct = Math.max((count / totalInPipeline) * 100, 2);
                return (
                  <div
                    key={status}
                    style={{ width: `${widthPct}%` }}
                    title={`${status.replace(/_/g, ' ')}: ${count}`}
                    className={`${STATUS_COLORS[status] ?? 'bg-slate-600'} h-full rounded-sm opacity-80 transition-all duration-300 hover:opacity-100`}
                  />
                );
              })}
            </div>

            {/* Status count grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {Object.entries(metrics.statusCounts).map(([status, count]) => (
                <div
                  key={status}
                  className="bg-surface-base/70 border border-surface-border rounded-xl p-3 flex flex-col items-center text-center hover:border-surface-border-light transition-colors duration-150"
                >
                  <span className="text-xl font-bold text-slate-100 font-mono tabular-numbers">{count}</span>
                  <StatusBadge status={status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Quotations Table */}
      <Card>
        <CardHeader bordered>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Commercial Contracts</CardTitle>
              <CardDescription>Active quotes progressing through commercial governance</CardDescription>
            </div>
            <Link
              to="/app/quotations"
              className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
            >
              View all <ChevronRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Sales Rep</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead numeric>Grand Total</TableHead>
              <TableHead numeric>Margin %</TableHead>
              <TableHead numeric> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentQuotations.length === 0 ? (
              <TableRow>
                <td colSpan={8}>
                  <EmptyState
                    icon={<FileText size={20} />}
                    title="No active quotations"
                    description="New quotes will appear here once created by your sales reps."
                  />
                </td>
              </TableRow>
            ) : (
              recentQuotations.map((quote) => (
                <TableRow
                  key={quote.id}
                  hoverable
                  onClick={() => navigate(`/app/quotations/${quote.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="font-mono font-semibold text-slate-100">{quote.quoteNumber}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-400">
                        v{quote.currentVersion}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{quote.customer?.name ?? '—'}</TableCell>
                  <TableCell muted>
                    {quote.salesRep ? `${quote.salesRep.firstName} ${quote.salesRep.lastName}` : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={quote.status} />
                  </TableCell>
                  <TableCell>
                    <RiskBadge level={quote.riskLevel} />
                  </TableCell>
                  <TableCell numeric mono>
                    ${Number(quote.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell numeric mono muted>
                    {Number(quote.marginPercent).toFixed(1)}%
                  </TableCell>
                  <TableCell numeric>
                    <Link
                      to={`/app/quotations/${quote.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors duration-150"
                      aria-label={`Open quotation ${quote.quoteNumber}`}
                    >
                      Open <ArrowUpRight size={12} aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
