/**
 * DashboardPage — Commercial Core Overview (Lane A)
 * Upgraded with ui-ux-pro-max design system:
 * - Lucide SVG icons & trend indicators
 * - Elevated surface tokens and soft colored status pills
 * - Visual pipeline distribution progress bar
 * - Tabular financial typography
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
  Plus,
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';

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

export default function DashboardPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentQuotations, setRecentQuotations] = useState<RecentQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/internal/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to load dashboard: ${res.statusText}`);
        }
        const data = await res.json();
        setMetrics(data.metrics);
        setRecentQuotations(data.recentQuotations);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchDashboard();
    }
  }, [token]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return {
          bg: 'bg-slate-800/80 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
      case 'PENDING_APPROVAL':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
          dot: 'bg-amber-400',
        };
      case 'APPROVED':
        return {
          bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
          dot: 'bg-emerald-400',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
          dot: 'bg-blue-400',
        };
      case 'UNDER_NEGOTIATION':
        return {
          bg: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
          dot: 'bg-purple-400',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
          dot: 'bg-rose-400',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500',
        };
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[75vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-brand-500 animate-spin" />
          <p className="text-xs text-slate-400 font-mono tracking-wider">Syncing commercial telemetry...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-rose-950/30 border border-rose-800/80 text-rose-300 p-5 rounded-2xl flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-rose-200">Error loading dashboard</h3>
            <p className="text-sm mt-1 text-rose-300/90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Pipeline distribution percentages
  const totalInPipeline = metrics
    ? Object.values(metrics.statusCounts).reduce((a, b) => a + b, 0) || 1
    : 1;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Commercial Overview
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/15 text-brand-300 border border-brand-500/20">
              Live
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Welcome back, <span className="text-slate-200 font-medium">{user?.firstName}</span> &bull; Role: <span className="text-brand-400 font-mono">{user?.role}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'SALES_REP' && (
            <button
              onClick={() => navigate('/app/quotations')}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-600/25 transition duration-150 flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} />
              <span>New Quotation</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Quotations */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-border-light rounded-2xl p-5 shadow-card transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-brand-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Quotations</span>
              <span className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <FileText size={16} />
              </span>
            </div>
            <p className="text-3xl font-bold text-white mt-3 tracking-tight font-mono">{metrics.totalQuotations}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-brand-400 font-semibold">{metrics.statusCounts.DRAFT ?? 0}</span> in draft workflow
            </div>
          </div>

          {/* Card 2: Pending Approvals */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-border-light rounded-2xl p-5 shadow-card transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-amber-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Approvals</span>
              <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock size={16} />
              </span>
            </div>
            <p className="text-3xl font-bold text-amber-400 mt-3 tracking-tight font-mono">{metrics.pendingApprovalsCount}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <Link to="/app/approvals" className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1">
                <span>Open review queue</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 3: Recognized Revenue */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-border-light rounded-2xl p-5 shadow-card transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-deal-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recognized Revenue</span>
              <span className="p-2 rounded-lg bg-deal-500/10 text-deal-400 border border-deal-500/20">
                <DollarSign size={16} />
              </span>
            </div>
            <p className="text-3xl font-bold text-deal-400 mt-3 tracking-tight tabular-numbers font-mono">
              ${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <TrendingUp size={13} className="text-deal-400" />
              <span>Approved & confirmed orders</span>
            </div>
          </div>

          {/* Card 4: Avg Margin */}
          <div className="bg-surface-card border border-surface-border hover:border-surface-border-light rounded-2xl p-5 shadow-card transition-all duration-200 group relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Commercial Margin</span>
              <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Percent size={16} />
              </span>
            </div>
            <p className="text-3xl font-bold text-blue-400 mt-3 tracking-tight tabular-numbers font-mono">{metrics.avgMarginPercent}%</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <span>Target margin governance ceiling</span>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Pipeline Funnel */}
      {metrics && (
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Pipeline Breakdown & Velocity</h2>
              <p className="text-xs text-slate-400 mt-0.5">Distribution of quotes across lifecycle stages</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total in cycle: <strong className="text-white">{metrics.totalQuotations}</strong>
            </span>
          </div>

          {/* Proportional Segmented Bar */}
          <div className="h-2.5 w-full bg-surface-base rounded-full overflow-hidden flex gap-0.5">
            {Object.entries(metrics.statusCounts).map(([status, count]) => {
              if (count === 0) return null;
              const widthPct = Math.max((count / totalInPipeline) * 100, 3);
              let colorClass = 'bg-slate-600';
              if (status === 'DRAFT') colorClass = 'bg-slate-500';
              if (status === 'PENDING_APPROVAL') colorClass = 'bg-amber-400';
              if (status === 'APPROVED') colorClass = 'bg-emerald-400';
              if (status === 'CONFIRMED') colorClass = 'bg-blue-400';
              if (status === 'UNDER_NEGOTIATION') colorClass = 'bg-purple-400';
              if (status === 'REJECTED') colorClass = 'bg-rose-400';

              return (
                <div
                  key={status}
                  style={{ width: `${widthPct}%` }}
                  title={`${status.replace('_', ' ')}: ${count}`}
                  className={`${colorClass} h-full transition-all duration-300 hover:brightness-125`}
                />
              );
            })}
          </div>

          {/* Status Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
            {Object.entries(metrics.statusCounts).map(([status, count]) => {
              const badge = getStatusBadge(status);
              return (
                <div
                  key={status}
                  className="bg-surface-base/70 border border-surface-border rounded-xl p-3 flex flex-col items-center justify-center text-center hover:border-surface-border-light transition"
                >
                  <span className="text-xl font-bold text-white font-mono">{count}</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 mt-1.5 rounded-full border ${badge.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    <span>{status.replace('_', ' ')}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Quotations Table */}
      <div className="bg-surface-card border border-surface-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between bg-surface-card/60">
          <div>
            <h2 className="text-sm font-bold text-white">Recent Commercial Contracts</h2>
            <p className="text-xs text-slate-400 mt-0.5">Active quotes progressing through commercial governance</p>
          </div>
          <Link
            to="/app/quotations"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition flex items-center gap-1"
          >
            <span>View all quotations</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-base/80 border-b border-surface-border text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Quote #</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Sales Rep</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Risk Level</th>
                <th className="px-5 py-3 text-right">Grand Total</th>
                <th className="px-5 py-3 text-right">Margin %</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-slate-300 text-xs">
              {recentQuotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-mono">
                    No active commercial quotations found
                  </td>
                </tr>
              ) : (
                recentQuotations.map((quote) => {
                  const badge = getStatusBadge(quote.status);
                  return (
                    <tr
                      key={quote.id}
                      onClick={() => navigate(`/app/quotations/${quote.id}`)}
                      className="hover:bg-surface-elevated/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-white group-hover:text-brand-400 transition">
                            {quote.quoteNumber}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-400">
                            v{quote.currentVersion}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-200">
                        {quote.customer?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {quote.salesRep ? `${quote.salesRep.firstName} ${quote.salesRep.lastName}` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{quote.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${getRiskBadge(quote.riskLevel)}`}>
                          {quote.riskLevel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-white tabular-numbers">
                        ${Number(quote.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-400 tabular-numbers">
                        {Number(quote.marginPercent).toFixed(1)}%
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/app/quotations/${quote.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2 py-1 rounded hover:bg-surface-elevated transition"
                        >
                          <span>Open</span>
                          <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
