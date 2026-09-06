/**
 * DealHealthDashboardPage — Pipeline Exception Detection (Lane C)
 *
 * UI/UX Upgrade:
 * - StatCards replacing plain gray boxes
 * - Card component for flag cards
 * - Proper Button component (no emoji icons)
 * - AlertBanner for errors and results
 * - Tabs for filter, SkeletonCard for loading
 * - EmptyState for zero results
 * - PageHeader for structure
 * - ConfirmModal for evaluate action (instead of native alert)
 *
 * Spec refs: §6.41–§6.43 (deal health monitoring)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { Activity, AlertTriangle, TrendingDown, Truck, Scan, CheckCircle2, Bell } from 'lucide-react';
import { Badge, RiskBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { Card, CardContent } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PageHeader } from '../../components/ui/PageHeader';

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

const FLAG_TYPE_LABELS: Record<string, string> = {
  STALLED: 'Stalled Deal',
  DISCOUNT_ANOMALY: 'Discount Anomaly',
  DELIVERY_SLIPPAGE: 'Delivery Slippage',
};

const STATUS_TABS = [
  { id: 'OPEN', label: 'Open' },
  { id: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: '', label: 'All Flags' },
];

export default function DealHealthDashboardPage() {
  const { token, user } = useAuth();
  const [flags, setFlags] = useState<DealHealthFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadFlags() {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter ? `/deal-health?status=${statusFilter}` : '/deal-health';
      const res = await apiFetch<{ flags: DealHealthFlag[] }>(url, {}, token);
      setFlags(res.flags || []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load deal health flags');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlags();
  }, [token, statusFilter]);

  async function handleEvaluate() {
    setEvaluating(true);
    setSuccessMessage(null);
    try {
      const res = await apiFetch<{ stalled: number; anomalies: number; slippage: number; total: number }>(
        '/deal-health/evaluate',
        { method: 'POST' },
        token,
      );
      setSuccessMessage(
        `Evaluation complete — Found: ${res.stalled} stalled, ${res.anomalies} discount anomalies, ${res.slippage} delivery slippages`,
      );
      loadFlags();
    } catch (err: unknown) {
      setError((err as Error).message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  }

  async function handleAcknowledge(flagId: string) {
    try {
      await apiFetch(`/deal-health/${flagId}/acknowledge`, { method: 'POST' }, token);
      loadFlags();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to acknowledge');
    }
  }

  async function handleResolve(flagId: string) {
    try {
      await apiFetch(`/deal-health/${flagId}/resolve`, { method: 'POST' }, token);
      loadFlags();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to resolve');
    }
  }

  async function handleNudge(flagId: string) {
    try {
      const res = await apiFetch<{ message?: string }>(`/deal-health/${flagId}/nudge`, { method: 'POST' }, token);
      setSuccessMessage(res.message || 'Escalation nudge sent to sales rep');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to send nudge');
    }
  }

  const stalledCount = flags.filter((f) => f.type === 'STALLED').length;
  const anomalyCount = flags.filter((f) => f.type === 'DISCOUNT_ANOMALY').length;
  const slippageCount = flags.filter((f) => f.type === 'DELIVERY_SLIPPAGE').length;
  const highSeverityCount = flags.filter((f) => f.severity === 'HIGH').length;

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const tabsWithCounts = STATUS_TABS.map((tab) => ({
    ...tab,
    count: tab.id === '' ? flags.length : flags.filter(f => f.status === tab.id).length,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Deal Health & Monitoring"
        description="Proactive pipeline exception detection: stalled deals, discount anomalies, and shipping slippage (§6.41–§6.43)"
        actions={
          canManage && (
            <Button
              id="run-diagnostics-btn"
              variant="secondary"
              loading={evaluating}
              leftIcon={<Scan size={14} />}
              onClick={handleEvaluate}
            >
              Run Diagnostics
            </Button>
          )
        }
      />

      {successMessage && (
        <AlertBanner variant="success" message={successMessage} onDismiss={() => setSuccessMessage(null)} />
      )}
      {error && <AlertBanner variant="error" message={error} live onDismiss={() => setError(null)} />}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {loading ? (
          [0,1,2,3].map(i => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard title="Critical / High Risk" value={highSeverityCount} icon={<AlertTriangle size={14} />} accent="rose" />
            <StatCard title="Stalled Deals" value={stalledCount} icon={<Activity size={14} />} accent="amber" />
            <StatCard title="Discount Anomalies" value={anomalyCount} icon={<TrendingDown size={14} />} accent="purple" />
            <StatCard title="Delivery Slippages" value={slippageCount} icon={<Truck size={14} />} accent="blue" />
          </>
        )}
      </div>

      {/* Filter Tabs */}
      <Tabs tabs={tabsWithCounts} active={statusFilter} onTabChange={setStatusFilter} />

      {/* Flag Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0,1,2].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : flags.length === 0 ? (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card">
          <EmptyState
            icon={<CheckCircle2 size={20} />}
            title="Pipeline is Healthy"
            description="No active deal health alerts found for this filter."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flags.map((flag) => {
            const isAnomaly = flag.type === 'DISCOUNT_ANOMALY';

            return (
              <Card key={flag.id} hover>
                <CardContent className="space-y-4">
                  {/* Flag header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold tracking-wide text-slate-300">
                        {FLAG_TYPE_LABELS[flag.type] ?? flag.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RiskBadge level={flag.severity} />
                      <Badge variant={
                        flag.status === 'OPEN' ? 'rose' :
                        flag.status === 'ACKNOWLEDGED' ? 'amber' :
                        flag.status === 'RESOLVED' ? 'deal' : 'slate'
                      } dot>
                        {flag.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 leading-snug">{flag.message}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Quote:{' '}
                      <Link
                        to={`/app/billing/${flag.quotationId}`}
                        className="text-brand-400 font-mono hover:text-brand-300 transition-colors"
                      >
                        {flag.quotation?.quoteNumber || flag.quotationId.slice(0, 8)}
                      </Link>
                      {' · '}
                      <strong className="text-slate-300">{flag.quotation?.customer?.name || 'Customer'}</strong>
                    </p>
                  </div>

                  {/* Detection metric */}
                  {flag.detectedValue !== null && flag.detectedValue !== undefined && (
                    <div className="bg-surface-base/80 border border-surface-border rounded-xl p-3 grid grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Detected Value</span>
                        <span className="text-rose-400 font-bold">
                          {isAnomaly ? `${Number(flag.detectedValue).toFixed(1)}%` : `${Number(flag.detectedValue)} days`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block mb-0.5">Expected Baseline</span>
                        <span className="text-deal-400">
                          {isAnomaly ? `${Number(flag.expectedValue).toFixed(1)}%` : `< ${Number(flag.expectedValue)} days`}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 font-mono">
                    Detected: {new Date(flag.detectedAt).toLocaleString()}
                  </p>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center justify-between pt-3 border-t border-surface-border gap-2">
                      <div className="flex items-center gap-2">
                        {flag.status === 'OPEN' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleAcknowledge(flag.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        {flag.status !== 'RESOLVED' && (
                          <Button
                            variant="success"
                            size="xs"
                            leftIcon={<CheckCircle2 size={11} />}
                            onClick={() => handleResolve(flag.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                      {flag.status !== 'RESOLVED' && (
                        <Button
                          variant="outline"
                          size="xs"
                          leftIcon={<Bell size={11} />}
                          onClick={() => handleNudge(flag.id)}
                        >
                          Nudge Rep
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
