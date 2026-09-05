/**
 * ApprovalListPage — Governance Approval Queue (Lane A)
 *
 * Spec refs: §6.12–6.18, §7.4, §8.21
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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

  const filteredApprovals = approvals.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Commercial Approvals</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review and decide quotation discount exception requests for{' '}
          <span className="text-gray-200 font-medium">{user?.role}</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        {['PENDING', 'APPROVED', 'RETURNED', 'REJECTED', 'ALL'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === tab
                ? 'bg-brand-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-mono">Loading approval requests...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 text-sm">{error}</div>
        ) : filteredApprovals.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 font-mono text-sm">No approval requests found in &quot;{statusFilter}&quot; status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/80 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Quote #</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Risk Level</th>
                  <th className="px-6 py-3">Risk Score</th>
                  <th className="px-6 py-3">Workflow Status</th>
                  <th className="px-6 py-3">Pending Step</th>
                  <th className="px-6 py-3 text-right">Grand Total</th>
                  <th className="px-6 py-3 text-right">Submitted</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {filteredApprovals.map((req) => {
                  const pendingStep = req.steps.find((s) => s.status === 'PENDING');

                  return (
                    <tr key={req.id} className="hover:bg-gray-800/40 transition">
                      <td className="px-6 py-4 font-mono font-medium text-white">
                        <Link to={`/app/approvals/${req.id}`} className="hover:text-brand-400 transition">
                          {req.quotation?.quoteNumber ?? '—'}{' '}
                          <span className="text-xs text-gray-500">v{req.quotationVersion}</span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">{req.quotation?.customer?.name ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getRiskBadge(req.riskLevel)}`}>
                          {req.riskLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-brand-400 font-semibold">
                        {Number(req.riskScore).toFixed(1)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {pendingStep ? (
                          <span className="text-amber-400">
                            Step {pendingStep.sequenceNo}: {pendingStep.approvalLevel}
                          </span>
                        ) : (
                          <span className="text-gray-500">Completed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-white">
                        ${Number(req.quotation?.grandTotal ?? 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-gray-500 font-mono">
                        {new Date(req.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/app/approvals/${req.id}`}
                          className="text-xs font-medium text-brand-400 hover:text-brand-300 transition"
                        >
                          Review &rarr;
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
