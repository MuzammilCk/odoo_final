import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

interface DealHealthFlag {
  id: string;
  quotationId: string;
  type: 'STALLED' | 'DISCOUNT_ANOMALY' | 'DELIVERY_SLIPPAGE';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  detectedValue?: number | string | null;
  expectedValue?: number | string | null;
  detectedAt: string;
  quotation?: {
    quoteNumber: string;
    customer?: { name: string };
  };
}

export default function DealHealthDashboardPage() {
  const { token, user } = useAuth();
  const [flags, setFlags] = useState<DealHealthFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [error, setError] = useState<string | null>(null);

  async function loadFlags() {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter ? `/deal-health?status=${statusFilter}` : '/deal-health';
      const res = await apiFetch<{ flags: DealHealthFlag[] }>(url, {}, token);
      setFlags(res.flags || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load deal health flags');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlags();
  }, [token, statusFilter]);

  async function handleEvaluate() {
    setEvaluating(true);
    try {
      const res = await apiFetch<{ stalled: number; anomalies: number; slippage: number; total: number }>(
        '/deal-health/evaluate',
        { method: 'POST' },
        token,
      );
      alert(
        `Evaluation complete! Found:\n• ${res.stalled} stalled quotations\n• ${res.anomalies} discount anomalies\n• ${res.slippage} delivery slippages`,
      );
      loadFlags();
    } catch (err: any) {
      alert(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  }

  async function handleAcknowledge(flagId: string) {
    try {
      await apiFetch(`/deal-health/${flagId}/acknowledge`, { method: 'POST' }, token);
      loadFlags();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge');
    }
  }

  async function handleResolve(flagId: string) {
    try {
      await apiFetch(`/deal-health/${flagId}/resolve`, { method: 'POST' }, token);
      loadFlags();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve');
    }
  }

  async function handleNudge(flagId: string) {
    try {
      const res = await apiFetch(`/deal-health/${flagId}/nudge`, { method: 'POST' }, token);
      alert(res.message || 'Escalation nudge sent to sales rep');
    } catch (err: any) {
      alert(err.message || 'Failed to send nudge');
    }
  }

  const stalledCount = flags.filter((f) => f.type === 'STALLED').length;
  const anomalyCount = flags.filter((f) => f.type === 'DISCOUNT_ANOMALY').length;
  const slippageCount = flags.filter((f) => f.type === 'DELIVERY_SLIPPAGE').length;
  const highSeverityCount = flags.filter((f) => f.severity === 'HIGH').length;

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>🩺</span> Deal Health & Monitoring
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Proactive pipeline exception detection: stalled deals, discount anomalies, and shipping slippage (§6.41–§6.43)
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
          >
            <span>🔍</span> {evaluating ? 'Analyzing deals...' : 'Run Diagnostics'}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Critical / High Risk</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{highSeverityCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Stalled Deals</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stalledCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Discount Anomalies</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{anomalyCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Delivery Slippages</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{slippageCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        {['OPEN', 'ACKNOWLEDGED', 'RESOLVED', ''].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === tab
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === '' ? 'All Flags' : tab}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Flag Cards */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Scanning deals for health signals...</div>
      ) : flags.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-400">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-lg font-medium text-white">Pipeline is Healthy</p>
          <p className="text-sm text-gray-500 mt-1">No active deal health alerts found for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flags.map((flag) => {
            const isStalled = flag.type === 'STALLED';
            const isAnomaly = flag.type === 'DISCOUNT_ANOMALY';
            const isSlippage = flag.type === 'DELIVERY_SLIPPAGE';

            return (
              <div
                key={flag.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-gray-700 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          flag.severity === 'HIGH'
                            ? 'bg-red-500'
                            : flag.severity === 'MEDIUM'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                      ></span>
                      <span className="text-xs font-mono font-bold tracking-wider uppercase text-gray-300">
                        {flag.type.replace('_', ' ')}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        flag.severity === 'HIGH'
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : flag.severity === 'MEDIUM'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {flag.severity} RISK
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white leading-snug">{flag.message}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Quote:{' '}
                      <Link
                        to={`/app/billing/${flag.quotationId}`}
                        className="text-brand-400 font-mono underline hover:text-brand-300"
                      >
                        {flag.quotation?.quoteNumber || flag.quotationId.slice(0, 8)}
                      </Link>{' '}
                      &bull; Customer: <strong className="text-gray-300">{flag.quotation?.customer?.name || 'Customer'}</strong>
                    </p>
                  </div>

                  {/* Anomaly / Detection Metric Details */}
                  {(flag.detectedValue !== null && flag.detectedValue !== undefined) && (
                    <div className="bg-gray-950/60 border border-gray-800/80 rounded-lg p-3 text-xs flex justify-between font-mono">
                      <div>
                        <span className="text-gray-500 block">Detected Value:</span>
                        <span className="text-red-400 font-bold">
                          {isAnomaly ? `${Number(flag.detectedValue).toFixed(1)}%` : `${Number(flag.detectedValue)} days`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block">Expected Baseline:</span>
                        <span className="text-emerald-400">
                          {isAnomaly ? `${Number(flag.expectedValue).toFixed(1)}%` : `< ${Number(flag.expectedValue)} days`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-gray-500">
                    Detected: {new Date(flag.detectedAt).toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800/80">
                  <div className="flex items-center gap-2">
                    {flag.status === 'OPEN' && canManage && (
                      <button
                        onClick={() => handleAcknowledge(flag.id)}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs transition"
                      >
                        Acknowledge
                      </button>
                    )}
                    {flag.status !== 'RESOLVED' && canManage && (
                      <button
                        onClick={() => handleResolve(flag.id)}
                        className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded text-xs transition"
                      >
                        Resolve
                      </button>
                    )}
                  </div>

                  {canManage && flag.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleNudge(flag.id)}
                      className="px-3 py-1 bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-800/60 rounded text-xs font-medium transition"
                    >
                      ⚡ Nudge Rep
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
