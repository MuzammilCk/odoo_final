/**
 * DashboardPage — Commercial Core Overview (Lane A)
 *
 * Spec refs: §7.4 (internal dashboard), §8.21 (/app/*)
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-800 text-gray-300 border-gray-700';
      case 'PENDING_APPROVAL':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/80';
      case 'APPROVED':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80';
      case 'CONFIRMED':
        return 'bg-blue-950/60 text-blue-400 border-blue-800/80';
      case 'UNDER_NEGOTIATION':
        return 'bg-purple-950/60 text-purple-400 border-purple-800/80';
      case 'REJECTED':
        return 'bg-rose-950/60 text-rose-400 border-rose-800/80';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/60';
      case 'MEDIUM':
        return 'bg-amber-950/50 text-amber-400 border border-amber-800/60';
      case 'HIGH':
        return 'bg-rose-950/50 text-rose-400 border border-rose-800/60';
      default:
        return 'bg-gray-800 text-gray-400 border border-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-mono">Loading commercial telemetry...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-rose-950/30 border border-rose-800 text-rose-300 p-4 rounded-xl">
          <h3 className="font-semibold text-rose-200">Error loading dashboard</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Commercial Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Welcome back, <span className="text-gray-200 font-medium">{user?.firstName}</span> ({user?.role})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/quotations')}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg shadow-sm transition flex items-center gap-2"
          >
            <span>+</span>
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-gray-900/80 border border-gray-800/90 rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 h-1 w-full bg-brand-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Quotations</p>
            <p className="text-3xl font-bold text-white mt-2">{metrics.totalQuotations}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <span className="text-brand-400 font-medium">{metrics.statusCounts.DRAFT ?? 0}</span> in draft state
            </div>
          </div>

          <div className="bg-gray-900/80 border border-gray-800/90 rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 h-1 w-full bg-amber-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pending Approvals</p>
            <p className="text-3xl font-bold text-amber-400 mt-2">{metrics.pendingApprovalsCount}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <Link to="/app/approvals" className="text-amber-400 hover:underline font-medium">
                Review queue &rarr;
              </Link>
            </div>
          </div>

          <div className="bg-gray-900/80 border border-gray-800/90 rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recognized Revenue</p>
            <p className="text-3xl font-bold text-emerald-400 mt-2">
              ${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <span>From approved & confirmed orders</span>
            </div>
          </div>

          <div className="bg-gray-900/80 border border-gray-800/90 rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Avg Commercial Margin</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{metrics.avgMarginPercent}%</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <span>Healthy gross margin ceiling</span>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Pipeline Status Row */}
      {metrics && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Pipeline Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(metrics.statusCounts).map(([status, count]) => (
              <div
                key={status}
                className="bg-gray-950/60 border border-gray-800/80 rounded-lg p-3 flex flex-col items-center justify-center text-center"
              >
                <span className="text-xl font-bold text-white">{count}</span>
                <span className={`text-[11px] font-mono px-2 py-0.5 mt-1 rounded border ${getStatusColor(status)}`}>
                  {status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Quotations Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Recent Quotations</h2>
            <p className="text-xs text-gray-400 mt-0.5">Commercial contracts actively progressing through the pipeline</p>
          </div>
          <Link
            to="/app/quotations"
            className="text-xs font-medium text-brand-400 hover:text-brand-300 transition"
          >
            View all quotations &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/80 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Quote #</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Sales Rep</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Risk Level</th>
                <th className="px-6 py-3 text-right">Grand Total</th>
                <th className="px-6 py-3 text-right">Margin %</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-gray-300">
              {recentQuotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500 font-mono text-sm">
                    No quotations found
                  </td>
                </tr>
              ) : (
                recentQuotations.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4 font-mono font-medium text-white">
                      <Link to={`/app/quotations/${quote.id}`} className="hover:text-brand-400 transition">
                        {quote.quoteNumber} <span className="text-xs text-gray-500">v{quote.currentVersion}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4">{quote.customer?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {quote.salesRep ? `${quote.salesRep.firstName} ${quote.salesRep.lastName}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(quote.status)}`}>
                        {quote.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getRiskBadge(quote.riskLevel)}`}>
                        {quote.riskLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-white">
                      ${Number(quote.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-400">
                      {Number(quote.marginPercent).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/app/quotations/${quote.id}`}
                        className="text-xs font-medium text-brand-400 hover:text-brand-300 transition"
                      >
                        Open &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
