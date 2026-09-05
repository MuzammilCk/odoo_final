/**
 * ApprovalDetailPage — Multi-step Approval Review & Decision Screen (Lane A)
 * Upgraded with ui-ux-pro-max design system:
 * - Lucide SVG icons (CheckCircle2, RotateCcw, XCircle, ShieldAlert, ArrowLeft, Loader2)
 * - Elevated cards & timeline step indicators
 * - Tabular currency alignment
 * - High-clarity decision action bar
 *
 * Spec refs: §6.12–6.18, §7.4, §8.21
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  MessageSquare,
} from 'lucide-react';

interface ApprovalStep {
  id: string;
  sequenceNo: number;
  approvalLevel: 'MANAGER' | 'FINANCE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  approverUserId?: string;
  actedAt?: string;
  decisionReason?: string;
  approverUser?: { firstName: string; lastName: string; role: string };
}

interface TermsSnapshot {
  quotationId: string;
  quoteNumber: string;
  version: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  marginAmount: number;
  marginPercent: number;
  riskScore: number;
  riskLevel: string;
  customer?: { id: string; name: string };
  lines?: Array<{
    id: string;
    product?: { name: string; sku?: string };
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    allowedDiscountPercent?: number;
    discountOveragePercent?: number;
    lineSubtotal: number;
  }>;
}

interface ApprovalDetail {
  id: string;
  quotationId: string;
  quotationVersion: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  termsSnapshot: TermsSnapshot;
  submittedAt: string;
  completedAt?: string;
  quotation?: {
    id: string;
    quoteNumber: string;
    currentVersion: number;
    status: string;
    customer?: { id: string; name: string };
  };
  steps: ApprovalStep[];
}

export default function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();

  const [approval, setApproval] = useState<ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decision state
  const [decisionComment, setDecisionComment] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (id && token) {
      fetchApprovalDetail();
    }
  }, [id, token]);

  async function fetchApprovalDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/internal/approvals/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load approval request');
      }

      const data = await res.json();
      setApproval(data.approvalRequest);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecide(stepId: string, decision: 'APPROVE' | 'REJECT' | 'RETURN') {
    if (!decisionComment.trim()) {
      alert('Please provide a decision rationale / comment before submitting.');
      return;
    }

    try {
      setDeciding(true);
      setActionSuccess(null);
      const res = await fetch(`/api/v1/internal/approvals/${id}/steps/${stepId}/decide`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision,
          comment: decisionComment.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit decision');
      }

      setDecisionComment('');
      setActionSuccess(`Successfully applied decision: ${decision}`);
      await fetchApprovalDetail();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setDeciding(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[75vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-brand-500 animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Loading approval telemetry...</p>
        </div>
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-rose-950/30 border border-rose-800/80 text-rose-300 p-5 rounded-2xl flex items-start gap-3">
          <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-rose-200">Error Loading Approval Request</h3>
            <p className="text-sm mt-1 text-rose-300/90">{error || 'Approval request not found'}</p>
            <Link to="/app/approvals" className="text-xs text-brand-400 hover:underline mt-3 inline-flex items-center gap-1">
              <ArrowLeft size={13} />
              <span>Back to Approvals</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const snapshot = approval.termsSnapshot;
  const isStale = approval.quotation && approval.quotationVersion !== approval.quotation.currentVersion;
  const statusBadge = getStatusBadge(approval.status);

  // Find the active step awaiting decision
  const activeStep = approval.steps.find((s) => s.status === 'PENDING');
  const userCanDecideActiveStep =
    activeStep &&
    (user?.role === 'ADMIN' ||
      (activeStep.approvalLevel === 'MANAGER' && user?.role === 'MANAGER') ||
      (activeStep.approvalLevel === 'FINANCE' && user?.role === 'FINANCE_OPS'));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          to="/app/approvals"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition font-medium"
        >
          <ArrowLeft size={14} />
          <span>Back to Approval Queue</span>
        </Link>
        {actionSuccess && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-1.5 rounded-xl animate-fade-in flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}
      </div>

      {/* Main Status Header */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-mono font-bold text-white tracking-tight">
              {snapshot?.quoteNumber ?? approval.quotation?.quoteNumber}
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-surface-elevated text-slate-300 border border-surface-border">
              Snapshot v{approval.quotationVersion}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border ${statusBadge.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
              <span>{approval.status}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
            <span>Customer: <strong className="text-slate-200">{snapshot?.customer?.name}</strong></span>
            <span>&bull;</span>
            <span>Submitted: <strong className="text-slate-300">{new Date(approval.submittedAt).toLocaleString()}</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider ${getRiskBadge(approval.riskLevel)}`}>
            {approval.riskLevel} RISK
          </span>
          <span className="text-xs font-mono bg-surface-base px-3 py-1.5 rounded-lg border border-surface-border text-brand-400 font-bold">
            Risk Score: {Number(approval.riskScore).toFixed(1)}
          </span>
        </div>
      </div>

      {/* Stale Warning Banner (§6.18) */}
      {isStale && (
        <div className="bg-amber-950/40 border border-amber-800/80 p-4 rounded-2xl text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-100">Stale Approval Notice (§6.18)</p>
            <p className="text-amber-300/80 mt-0.5">
              This quotation has been materially modified since this approval was requested (Current quote version is v
              {approval.quotation?.currentVersion}, while snapshot is v{approval.quotationVersion}).
            </p>
          </div>
        </div>
      )}

      {/* Multi-Step Approval Flow (§6.14–6.16) */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-card space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Approval Workflow Steps ({approval.steps.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {approval.steps.map((step) => {
            const stepBadge = getStatusBadge(step.status);
            return (
              <div
                key={step.id}
                className={`p-4 rounded-xl border ${
                  step.status === 'PENDING'
                    ? 'bg-surface-elevated/70 border-amber-500/40'
                    : step.status === 'APPROVED'
                    ? 'bg-surface-elevated/40 border-emerald-500/30'
                    : 'bg-surface-elevated/30 border-surface-border'
                } space-y-2.5`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-surface-base text-xs font-mono flex items-center justify-center text-slate-300 font-bold border border-surface-border">
                      {step.sequenceNo}
                    </span>
                    <span className="font-bold text-white text-xs">
                      {step.approvalLevel === 'MANAGER' ? 'Commercial Manager Review' : 'Finance Operations Review'}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-medium rounded-full border ${stepBadge.bg}`}>
                    <span className={`w-1 h-1 rounded-full ${stepBadge.dot}`} />
                    <span>{step.status}</span>
                  </span>
                </div>

                {step.actedAt && (
                  <div className="text-xs text-slate-400 font-mono space-y-1 pt-1 border-t border-surface-border/50">
                    <p>Decided at: {new Date(step.actedAt).toLocaleString()}</p>
                    {step.decisionReason && (
                      <p className="text-slate-300 bg-surface-base p-2.5 rounded-lg border border-surface-border text-xs italic">
                        &quot;{step.decisionReason}&quot;
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Decision Panel (if user has required role & step is pending) */}
      {approval.status === 'PENDING' && !isStale && activeStep && (
        <div className="bg-surface-card border border-brand-500/40 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-400" />
              <span>Act on Step {activeStep.sequenceNo}: {activeStep.approvalLevel} Review</span>
            </h3>
            {!userCanDecideActiveStep && (
              <span className="text-[11px] text-amber-300 font-mono bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/25">
                Awaiting {activeStep.approvalLevel} role decision
              </span>
            )}
          </div>

          {userCanDecideActiveStep ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Decision Comment / Audit Rationale <span className="text-brand-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Enter detailed reason for your approval, return, or rejection..."
                  className="w-full bg-surface-base border border-surface-border rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecide(activeStep.id, 'RETURN')}
                  className="px-4 py-2 bg-surface-elevated hover:bg-slate-700/80 text-blue-300 border border-blue-500/40 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Return for Revision (DRAFT)</span>
                </button>

                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecide(activeStep.id, 'REJECT')}
                  className="px-4 py-2 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <XCircle size={13} />
                  <span>Reject Quote</span>
                </button>

                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecide(activeStep.id, 'APPROVE')}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {deciding ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Approve Step</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-mono">
              Your current role ({user?.role}) does not match the role required for this pending step ({activeStep.approvalLevel}).
            </p>
          )}
        </div>
      )}

      {/* Terms Snapshot Table (§6.4) */}
      <div className="bg-surface-card border border-surface-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between bg-surface-card/60">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-brand-400" />
              <span>Immutable Terms Snapshot</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Frozen commercial quotation state captured at submission time
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Grand Total: <span className="font-bold text-white tabular-numbers">${Number(snapshot?.grandTotal ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-base/80 border-b border-surface-border text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-4 py-3.5 text-center">Qty</th>
                <th className="px-4 py-3.5 text-right">Unit Price</th>
                <th className="px-4 py-3.5 text-right">Disc %</th>
                <th className="px-4 py-3.5 text-right">Allowed %</th>
                <th className="px-4 py-3.5 text-right">Overage</th>
                <th className="px-5 py-3.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-slate-300 font-mono text-xs">
              {snapshot?.lines?.map((line) => {
                const overage = Number(line.discountOveragePercent ?? 0);
                return (
                  <tr key={line.id} className="hover:bg-surface-elevated/40 transition">
                    <td className="px-5 py-3.5 font-sans font-semibold text-white">
                      {line.product?.name ?? 'Item'}
                    </td>
                    <td className="px-4 py-3.5 text-center">{line.quantity}</td>
                    <td className="px-4 py-3.5 text-right tabular-numbers">${Number(line.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-right tabular-numbers">
                      <span className={overage > 0 ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                        {Number(line.discountPercent).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-400 tabular-numbers">
                      {Number(line.allowedDiscountPercent ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-numbers">
                      {overage > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                          +{overage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">0.0%</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-white tabular-numbers">
                      ${Number(line.lineSubtotal).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Snapshot Financial Summary Footer */}
        <div className="bg-surface-base/60 p-5 border-t border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              Subtotal: <span className="text-slate-200 font-medium tabular-numbers">${Number(snapshot?.subtotal ?? 0).toFixed(2)}</span>
            </div>
            <div>
              Discount Total: <span className="text-rose-400 font-medium tabular-numbers">-${Number(snapshot?.discountTotal ?? 0).toFixed(2)}</span>
            </div>
            <div>
              Tax Total: <span className="text-slate-200 font-medium tabular-numbers">${Number(snapshot?.taxTotal ?? 0).toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              Gross Margin: <span className="text-deal-400 font-bold tabular-numbers">{Number(snapshot?.marginPercent ?? 0).toFixed(1)}%</span>
            </div>
            <div className="text-sm font-bold text-brand-400 font-sans tabular-numbers">
              Grand Total: ${Number(snapshot?.grandTotal ?? 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
