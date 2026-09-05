/**
 * ApprovalDetailPage — Multi-step Approval Review & Decision Screen (Lane A)
 *
 * Spec refs: §6.12–6.18, §7.4, §8.21
 * Allows authorized managers and finance operators to inspect frozen terms snapshot
 * and execute APPROVE, RETURN, or REJECT decisions with audit commentary.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
        return 'bg-amber-950/60 text-amber-400 border-amber-800/80';
      case 'APPROVED':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80';
      case 'REJECTED':
        return 'bg-rose-950/60 text-rose-400 border-rose-800/80';
      case 'RETURNED':
        return 'bg-blue-950/60 text-blue-400 border-blue-800/80';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60';
      case 'MEDIUM':
        return 'bg-amber-950/50 text-amber-400 border-amber-800/60';
      case 'HIGH':
        return 'bg-rose-950/50 text-rose-400 border-rose-800/60';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-mono">Loading approval telemetry...</p>
        </div>
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className="p-8">
        <div className="bg-rose-950/30 border border-rose-800 text-rose-300 p-4 rounded-xl">
          <h3 className="font-semibold text-rose-200">Error</h3>
          <p className="text-sm mt-1">{error || 'Approval request not found'}</p>
          <Link to="/app/approvals" className="text-xs text-brand-400 hover:underline mt-3 inline-block">
            &larr; Back to Approvals
          </Link>
        </div>
      </div>
    );
  }

  const snapshot = approval.termsSnapshot;
  const isStale = approval.quotation && approval.quotationVersion !== approval.quotation.currentVersion;

  // Find the active step awaiting decision
  const activeStep = approval.steps.find((s) => s.status === 'PENDING');
  const userCanDecideActiveStep =
    activeStep &&
    (user?.role === 'ADMIN' ||
      (activeStep.approvalLevel === 'MANAGER' && user?.role === 'MANAGER') ||
      (activeStep.approvalLevel === 'FINANCE' && user?.role === 'FINANCE_OPS'));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/app/approvals" className="text-xs text-gray-400 hover:text-brand-400 transition font-mono">
          &larr; Back to Approval Queue
        </Link>
        {actionSuccess && (
          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs px-4 py-2 rounded-lg">
            {actionSuccess}
          </div>
        )}
      </div>

      {/* Main Status Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-mono font-bold text-white tracking-tight">
              {snapshot?.quoteNumber ?? approval.quotation?.quoteNumber}
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
              Snapshot v{approval.quotationVersion}
            </span>
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadge(approval.status)}`}>
              {approval.status}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            Customer: <span className="text-gray-200 font-medium">{snapshot?.customer?.name}</span> | Submitted:{' '}
            <span className="text-gray-300">{new Date(approval.submittedAt).toLocaleString()}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-xs font-semibold rounded ${getRiskBadge(approval.riskLevel)}`}>
              {approval.riskLevel} RISK
            </span>
            <span className="text-xs font-mono bg-gray-950 px-2.5 py-1 rounded border border-gray-800 text-brand-400 font-bold">
              Score: {Number(approval.riskScore).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Stale Warning Banner (§6.18) */}
      {isStale && (
        <div className="bg-amber-950/40 border border-amber-800/80 p-4 rounded-xl text-amber-200 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">Stale Approval Notice (§6.18)</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              This quotation has been materially modified since this approval was requested (Current quote version is v
              {approval.quotation?.currentVersion}, while snapshot is v{approval.quotationVersion}).
            </p>
          </div>
        </div>
      )}

      {/* Multi-Step Approval Flow (§6.14–6.16) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Approval Workflow Steps ({approval.steps.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {approval.steps.map((step) => (
            <div
              key={step.id}
              className={`p-4 rounded-xl border ${
                step.status === 'PENDING'
                  ? 'bg-gray-950 border-amber-800/70'
                  : step.status === 'APPROVED'
                  ? 'bg-gray-950/60 border-emerald-800/60'
                  : 'bg-gray-950/60 border-gray-800'
              } space-y-2`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-800 text-xs font-mono flex items-center justify-center text-gray-300 font-bold">
                    {step.sequenceNo}
                  </span>
                  <span className="font-semibold text-white text-sm">
                    {step.approvalLevel === 'MANAGER' ? 'Commercial Manager Review' : 'Finance Operations Review'}
                  </span>
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusBadge(step.status)}`}>
                  {step.status}
                </span>
              </div>

              {step.actedAt && (
                <div className="text-xs text-gray-400 font-mono space-y-0.5 pt-1">
                  <p>Decided at: {new Date(step.actedAt).toLocaleString()}</p>
                  {step.decisionReason && (
                    <p className="text-gray-300 bg-gray-900 p-2 rounded border border-gray-800 mt-1 italic">
                      &quot;{step.decisionReason}&quot;
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active Decision Panel (if user has required role & step is pending) */}
      {approval.status === 'PENDING' && !isStale && activeStep && (
        <div className="bg-gray-900 border border-brand-900/60 rounded-xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">
              Act on Step {activeStep.sequenceNo}: {activeStep.approvalLevel} Review
            </h3>
            {!userCanDecideActiveStep && (
              <span className="text-xs text-amber-400 font-mono bg-amber-950/60 px-3 py-1 rounded border border-amber-800">
                Awaiting {activeStep.approvalLevel} role decision
              </span>
            )}
          </div>

          {userCanDecideActiveStep ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                  Decision Comment / Audit Rationale <span className="text-brand-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Enter detailed reason for your approval, return, or rejection..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecide(activeStep.id, 'RETURN')}
                  className="px-4 py-2 bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 border border-blue-700/60 text-sm font-medium rounded-lg transition"
                >
                  Return for Revision (DRAFT)
                </button>

                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecide(activeStep.id, 'REJECT')}
                  className="px-4 py-2 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-sm font-medium rounded-lg transition"
                >
                  Reject Quote
                </button>

                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecide(activeStep.id, 'APPROVE')}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-2"
                >
                  {deciding && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Approve Step</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 font-mono">
              Your role ({user?.role}) does not match the role required for this pending step ({activeStep.approvalLevel}).
            </p>
          )}
        </div>
      )}

      {/* Terms Snapshot Table (§6.4) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-sm overflow-hidden space-y-0">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Immutable Terms Snapshot</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Frozen commercial quotation state captured at submission time
            </p>
          </div>
          <div className="text-xs font-mono text-gray-400">
            Grand Total: <span className="font-bold text-white">${Number(snapshot?.grandTotal ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/80 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Disc %</th>
                <th className="px-4 py-3 text-right">Allowed %</th>
                <th className="px-4 py-3 text-right">Overage</th>
                <th className="px-6 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-gray-300 font-mono">
              {snapshot?.lines?.map((line) => {
                const overage = Number(line.discountOveragePercent ?? 0);
                return (
                  <tr key={line.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-6 py-3.5 font-sans font-medium text-white">
                      {line.product?.name ?? 'Item'}
                    </td>
                    <td className="px-4 py-3.5 text-center">{line.quantity}</td>
                    <td className="px-4 py-3.5 text-right">${Number(line.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={overage > 0 ? 'text-rose-400 font-semibold' : 'text-gray-300'}>
                        {Number(line.discountPercent).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-gray-400">
                      {Number(line.allowedDiscountPercent ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {overage > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                          +{overage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">0.0%</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-white">
                      ${Number(line.lineSubtotal).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Snapshot Financial Summary Footer */}
        <div className="bg-gray-950/60 p-6 border-t border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono text-gray-400">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              Subtotal: <span className="text-gray-200 font-medium">${Number(snapshot?.subtotal ?? 0).toFixed(2)}</span>
            </div>
            <div>
              Discount Total: <span className="text-rose-400 font-medium">-${Number(snapshot?.discountTotal ?? 0).toFixed(2)}</span>
            </div>
            <div>
              Tax Total: <span className="text-gray-200 font-medium">${Number(snapshot?.taxTotal ?? 0).toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              Gross Margin: <span className="text-emerald-400 font-semibold">{Number(snapshot?.marginPercent ?? 0).toFixed(1)}%</span>
            </div>
            <div className="text-sm font-bold text-brand-400 font-sans">
              Grand Total: ${Number(snapshot?.grandTotal ?? 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
