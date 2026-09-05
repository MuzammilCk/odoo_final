/**
 * ApprovalListPage — Governance Approval Queue (Lane A)
 * Upgraded with ui-ux-pro-max design system:
 * - Lucide SVG icons & soft status badges
 * - Non-wrapping quote numbers with monospace styling
 * - Tabular currency alignment
 * - Surface elevation tokens
 *
 * Spec refs: §6.12–6.18, §7.4, §8.21
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react';

interface ApprovalStep {
  id: string;
  sequenceNo: number;
  approvalLevel: string;
  status: string;
}

interface ApprovalRequestItem {
  id: string;
  quotationId: string;
  quotationVersion: number;
  status: string;
  riskScore: number | string;
  riskLevel: string;
  submittedAt: string;
  quotation?: {
    id: string;
    quoteNumber: string;
    grandTotal: number | string;
    customer?: { id: string; name: string };
    salesRep?: { id: string; firstName: string; lastName: string };
  };
  steps: ApprovalStep[];
}

export default function ApprovalListPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');

  useEffect(() => {
    fetchApprovals();
  }, [token]);

  async function fetchApprovals() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/internal/approvals', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load approval requests');
      }

      const data = await res.json();
      setApprovals(data.approvalRequests || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
          dot: 'bg-amber-400',
        };
      case 'APPROVED':
        return {
          bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
          dot: 'bg-emerald-400',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
          dot: 'bg-rose-400',
        };
      case 'RETURNED':
        return {
          bg: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
          dot: 'bg-blue-400',
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

  const filteredApprovals = approvals.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Commercial Approvals</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-surface-elevated text-slate-400 border border-surface-border">
              {filteredApprovals.length} requests
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review and decide quotation discount exception requests for{' '}
            <span className="text-slate-200 font-semibold">{user?.role?.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-1.5 bg-surface-card border border-surface-border rounded-2xl p-2.5 shadow-card overflow-x-auto">
        {['PENDING', 'APPROVED', 'RETURNED', 'REJECTED', 'ALL'].map((tab) => {
          const isActive = statusFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-surface-card border border-surface-border rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 size={28} className="text-brand-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-mono">Syncing approval requests...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 text-sm flex items-center justify-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Inbox size={32} className="text-slate-600 mx-auto" />
            <p className="text-slate-400 font-medium text-sm">No approval requests found in &quot;{statusFilter}&quot; status</p>
            <p className="text-slate-600 text-xs">All quotation governance items are up to date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-base/80 border-b border-surface-border text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Quote #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Risk Level</th>
                  <th className="px-5 py-3.5">Risk Score</th>
                  <th className="px-5 py-3.5">Workflow Status</th>
                  <th className="px-5 py-3.5">Pending Step</th>
                  <th className="px-5 py-3.5 text-right">Grand Total</th>
                  <th className="px-5 py-3.5 text-right">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300 text-xs">
                {filteredApprovals.map((req) => {
                  const pendingStep = req.steps.find((s) => s.status === 'PENDING');
                  const badge = getStatusBadge(req.status);

                  return (
                    <tr
                      key={req.id}
                      onClick={() => navigate(`/app/approvals/${req.id}`)}
                      className="hover:bg-surface-elevated/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-4 whitespace-nowrap min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white group-hover:text-brand-400 transition">
                            {req.quotation?.quoteNumber ?? '—'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-400">
                            v{req.quotationVersion}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-100">
                        {req.quotation?.customer?.name ?? '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${getRiskBadge(req.riskLevel)}`}>
                          {req.riskLevel}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-brand-400 font-semibold tabular-numbers">
                        {Number(req.riskScore).toFixed(1)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{req.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono whitespace-nowrap">
                        {pendingStep ? (
                          <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                            Step {pendingStep.sequenceNo}: {pendingStep.approvalLevel}
                          </span>
                        ) : (
                          <span className="text-slate-500">Completed</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-semibold text-white tabular-numbers whitespace-nowrap">
                        ${Number(req.quotation?.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-slate-400 font-mono whitespace-nowrap">
                        {new Date(req.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Link
                          to={`/app/approvals/${req.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2.5 py-1 rounded-lg hover:bg-surface-elevated transition"
                        >
                          <span>Review</span>
                          <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
