/**
 * SubscriptionListPage — Recurring Revenue Management (Lane C)
 *
 * UI/UX Upgrade:
 * - StatCards for active count and MRR
 * - Table primitives with SubscriptionStatusBadge
 * - Tabs-based filter replacing <select>
 * - SkeletonTable loading state
 * - Proper confirm modal instead of native alert/confirm
 * - EmptyState, AlertBanner, PageHeader
 *
 * Spec refs: §5.x (subscription billing)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { Repeat, DollarSign, LayoutList, Zap, ChevronRight } from 'lucide-react';
import { SubscriptionStatusBadge, Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/Modal';
import { SkeletonTable, SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PageHeader } from '../../components/ui/PageHeader';

interface SubscriptionInstance {
  id: string;
  quotationId: string;
  customerId: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  quantity: number | string;
  unitPrice: number | string;
  currencyCode: string;
  billingInterval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  customer?: { id: string; name: string };
  product?: { id: string; name: string; sku: string };
}

const FILTER_TABS = [
  { id: '', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'PAUSED', label: 'Paused' },
  { id: 'CANCELLED', label: 'Cancelled' },
  { id: 'EXPIRED', label: 'Expired' },
];

export default function SubscriptionListPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<SubscriptionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [runningRecurring, setRunningRecurring] = useState(false);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);
  const [billingResult, setBillingResult] = useState<string | null>(null);

  async function loadSubscriptions() {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter ? `/subscriptions?status=${statusFilter}` : '/subscriptions';
      const res = await apiFetch<{ subscriptions: SubscriptionInstance[] }>(url, {}, token);
      setSubscriptions(res.subscriptions || []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscriptions();
  }, [token, statusFilter]);

  async function handleTriggerRecurringRun() {
    setShowBillingConfirm(false);
    setRunningRecurring(true);
    setBillingResult(null);
    try {
      const res = await apiFetch<{ created: number }>('/invoices/generate-recurring', { method: 'POST' }, token);
      setBillingResult(`Recurring billing run complete. Generated ${res.created} invoices.`);
      loadSubscriptions();
    } catch (err: unknown) {
      setError((err as Error).message || 'Recurring billing failed');
    } finally {
      setRunningRecurring(false);
    }
  }

  const activeCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const mrr = subscriptions
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => {
      const monthlyMult = s.billingInterval === 'YEARLY' ? 1 / 12 : s.billingInterval === 'QUARTERLY' ? 1 / 3 : 1;
      return sum + Number(s.unitPrice) * Number(s.quantity) * monthlyMult;
    }, 0);

  const tabsWithCounts = FILTER_TABS.map((tab) => ({
    ...tab,
    count: tab.id === ''
      ? subscriptions.length
      : subscriptions.filter(s => s.status === tab.id).length,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Subscriptions"
        description="Manage recurring customer contracts, billing cycles, and proration"
        actions={
          (user?.role === 'ADMIN' || user?.role === 'FINANCE_OPS') && (
            <Button
              id="bill-due-subscriptions-btn"
              variant="secondary"
              loading={runningRecurring}
              leftIcon={<Zap size={14} />}
              onClick={() => setShowBillingConfirm(true)}
            >
              Bill Due Subscriptions
            </Button>
          )
        }
      />

      {billingResult && (
        <AlertBanner variant="success" message={billingResult} onDismiss={() => setBillingResult(null)} />
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0,1,2].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Active Subscriptions"
            value={activeCount}
            icon={<Repeat size={14} />}
            accent="deal"
            footnote="Currently billing"
          />
          <StatCard
            title="Estimated MRR"
            value={`$${mrr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign size={14} />}
            accent="brand"
            footnote="Monthly recurring revenue"
          />
          <StatCard
            title="Total Tracked"
            value={subscriptions.length}
            icon={<LayoutList size={14} />}
            accent="slate"
            footnote={`Across all statuses`}
          />
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs tabs={tabsWithCounts} active={statusFilter} onTabChange={setStatusFilter} />

      {error && <AlertBanner variant="error" message={error} live onDismiss={() => setError(null)} />}

      {/* Subscriptions Table */}
      {loading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : subscriptions.length === 0 ? (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card">
          <EmptyState
            icon={<Repeat size={20} />}
            title="No subscriptions found"
            description="Try changing the status filter above."
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead numeric>Qty</TableHead>
                <TableHead numeric>Period Amount</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead numeric> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => {
                const periodAmount = Number(sub.unitPrice) * Number(sub.quantity);
                const isDue = new Date(sub.nextBillingDate) <= new Date();

                return (
                  <TableRow key={sub.id} hoverable onClick={() => navigate(`/app/subscriptions/${sub.id}`)}>
                    <TableCell>{sub.customer?.name || 'Customer'}</TableCell>
                    <TableCell>
                      <div className="text-slate-200">{sub.product?.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{sub.product?.sku}</div>
                    </TableCell>
                    <TableCell>
                      <SubscriptionStatusBadge status={sub.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="slate">{sub.billingInterval}</Badge>
                    </TableCell>
                    <TableCell numeric mono>{Number(sub.quantity)}</TableCell>
                    <TableCell numeric mono>
                      <span className="text-deal-300 font-semibold">${periodAmount.toFixed(2)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono text-xs ${isDue && sub.status === 'ACTIVE' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                          {new Date(sub.nextBillingDate).toLocaleDateString()}
                        </span>
                        {isDue && sub.status === 'ACTIVE' && (
                          <Badge variant="amber">Due</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell numeric>
                      <Link
                        to={`/app/subscriptions/${sub.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors duration-150"
                      >
                        Details <ChevronRight size={12} aria-hidden="true" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Billing confirm modal */}
      <ConfirmModal
        open={showBillingConfirm}
        onClose={() => setShowBillingConfirm(false)}
        onConfirm={handleTriggerRecurringRun}
        title="Run Recurring Billing"
        description="This will generate invoices for all subscriptions due for billing today."
        confirmLabel="Run Billing"
        cancelLabel="Cancel"
        variant="primary"
        loading={runningRecurring}
      />
    </div>
  );
}
