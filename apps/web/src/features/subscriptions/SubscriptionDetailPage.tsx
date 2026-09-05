import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

interface SubscriptionDetail {
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
  cancelledAt?: string | null;
  customer?: { id: string; name: string };
  product?: { id: string; name: string; sku: string };
  invoices: {
    id: string;
    invoiceNumber: string;
    totalAmount: number | string;
    status: string;
    dueAt: string;
  }[];
  creditNotes: {
    id: string;
    creditNoteNumber: string;
    amount: number | string;
    reason: string;
    status: string;
    createdAt: string;
  }[];
}

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();

  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modification
  const [isModOpen, setIsModOpen] = useState(false);
  const [newQty, setNewQty] = useState('');
  const [newInterval, setNewInterval] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');
  const [modifying, setModifying] = useState(false);

  // Cancellation
  const [cancelling, setCancelling] = useState(false);

  async function loadSubscription() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ subscription: SubscriptionDetail }>(`/subscriptions/${id}`, {}, token);
      setSub(res.subscription);
      setNewQty(String(res.subscription.quantity));
      setNewInterval(res.subscription.billingInterval as any);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscription();
  }, [id, token]);

  // Proration preview calculation
  function calculateProration() {
    if (!sub) {
      return {
        usedFraction: 0,
        remainingFraction: 0,
        daysUsed: 0,
        daysInPeriod: 1,
        adjustment: 0,
        refundOnCancel: 0,
      };
    }
    const today = new Date();
    const periodStart = new Date(sub.currentPeriodStart);
    const periodEnd = new Date(sub.currentPeriodEnd);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUsed = Math.max(0, Math.floor((today.getTime() - periodStart.getTime()) / msPerDay));
    const daysInPeriod = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / msPerDay));
    const usedFraction = Math.min(daysUsed / daysInPeriod, 1);
    const remainingFraction = 1 - usedFraction;

    const oldTotal = Number(sub.unitPrice) * Number(sub.quantity);
    const newQuantityNum = parseFloat(newQty) || Number(sub.quantity);
    const newTotal = Number(sub.unitPrice) * newQuantityNum;

    const creditForRemaining = oldTotal * remainingFraction;
    const chargeForRemaining = newTotal * remainingFraction;
    const adjustment = chargeForRemaining - creditForRemaining;

    return {
      usedFraction,
      remainingFraction,
      daysUsed,
      daysInPeriod,
      adjustment,
      refundOnCancel: oldTotal * remainingFraction,
    };
  }

  async function handleModifySubscription(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setModifying(true);
    try {
      const res = await apiFetch(
        `/subscriptions/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            newQuantity: parseFloat(newQty),
            newPlanInterval: newInterval,
          }),
        },
        token,
      );
      alert(`Subscription modified. Proration adjustment: $${res.prorataAdjustment}`);
      setIsModOpen(false);
      loadSubscription();
    } catch (err: any) {
      alert(err.message || 'Failed to modify subscription');
    } finally {
      setModifying(false);
    }
  }

  async function handleCancelSubscription() {
    if (!id) return;
    const proration = calculateProration();
    const confirmMsg = `Cancel subscription now?\n\nRefund due: $${proration.refundOnCancel.toFixed(
      2,
    )} (${Math.round(proration.remainingFraction * 100)}% of billing cycle remaining).\nA Credit Note will be generated.`;
    if (!confirm(confirmMsg)) return;

    setCancelling(true);
    try {
      const res = await apiFetch(`/subscriptions/${id}/cancel`, { method: 'POST' }, token);
      alert(`Subscription cancelled. Refund credit note amount: $${res.refundAmount}`);
      loadSubscription();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <div className="p-12 text-center text-gray-500">Loading subscription...</div>;
  if (error || !sub) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="text-red-400">{error || 'Subscription not found'}</div>
        <Link to="/app/subscriptions" className="text-brand-400 underline text-sm">
          &larr; Back to Subscriptions
        </Link>
      </div>
    );
  }

  const periodAmount = Number(sub.unitPrice) * Number(sub.quantity);
  const proration = calculateProration();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/app/subscriptions" className="text-gray-400 hover:text-white transition text-sm">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Subscription Detail
          </h1>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              sub.status === 'ACTIVE'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-red-950 text-red-300 border border-red-800'
            }`}
          >
            {sub.status}
          </span>
        </div>

        {canManage && sub.status === 'ACTIVE' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModOpen(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium border border-gray-700 transition"
            >
              Modify Plan / Quantity
            </button>
            <button
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800/80 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          </div>
        )}
      </div>

      {/* Subscription Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</p>
          <p className="text-lg font-bold text-white mt-1">{sub.customer?.name}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{sub.customerId}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Product</p>
          <p className="text-lg font-bold text-white mt-1">{sub.product?.name}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{sub.product?.sku}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recurring Amount</p>
          <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">
            ${periodAmount.toFixed(2)}
            <span className="text-xs text-gray-400 font-normal ml-1">/{sub.billingInterval.toLowerCase()}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            ${Number(sub.unitPrice).toFixed(2)} &times; {Number(sub.quantity)} units
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Next Billing Date</p>
          <p className="text-lg font-bold text-amber-400 mt-1 font-mono">
            {new Date(sub.nextBillingDate).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Period: {new Date(sub.currentPeriodStart).toLocaleDateString()} &ndash;{' '}
            {new Date(sub.currentPeriodEnd).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Proration Formula Explainer Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-2">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <span>📐</span> Proration Status (§6.35)
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Current billing period has elapsed{' '}
          <strong className="text-white">{proration.daysUsed} days</strong> out of{' '}
          <strong className="text-white">{proration.daysInPeriod} days</strong> (
          <span className="text-amber-400 font-bold font-mono">
            {Math.round(proration.usedFraction * 100)}% consumed
          </span>
          ,{' '}
          <span className="text-emerald-400 font-bold font-mono">
            {Math.round(proration.remainingFraction * 100)}% remaining
          </span>
          ). If cancelled today, customer receives a refund of{' '}
          <span className="text-emerald-400 font-bold font-mono">
            ${proration.refundOnCancel.toFixed(2)}
          </span>
          .
        </p>
      </div>

      {/* Generated Invoices */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-white">Invoices For This Subscription</h2>
        {sub.invoices.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No invoices recorded yet for this subscription instance.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {sub.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-mono font-medium text-white">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                      ${Number(inv.totalAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/app/invoices/${inv.id}`}
                        className="text-brand-400 hover:text-brand-300 text-xs underline"
                      >
                        View Invoice &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credit Notes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-white">Credit Notes Linked</h2>
        {sub.creditNotes.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No credit notes issued for this subscription.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-3">Credit Note #</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Issued Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {sub.creditNotes.map((cn) => (
                  <tr key={cn.id}>
                    <td className="px-4 py-3 font-mono text-white">{cn.creditNoteNumber}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                      ${Number(cn.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{cn.reason}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">
                        {cn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {new Date(cn.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modify Modal */}
      {isModOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Modify Subscription</h3>
            <p className="text-xs text-gray-400">
              Change quantity or billing interval. Proration will be calculated automatically.
            </p>

            <form onSubmit={handleModifySubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">New Quantity</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Billing Interval</label>
                <select
                  value={newInterval}
                  onChange={(e) => setNewInterval(e.target.value as any)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>

              <div className="p-3 bg-gray-800/80 border border-gray-700 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Est. Proration Adjustment:</span>
                  <span className="font-mono font-bold text-white">
                    {proration.adjustment >= 0 ? '+' : ''}${proration.adjustment.toFixed(2)}
                  </span>
                </div>
                {proration.adjustment < 0 && (
                  <p className="text-emerald-400 text-[11px]">
                    &bull; Downgrade credit note for ${Math.abs(proration.adjustment).toFixed(2)} will be generated
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modifying}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {modifying ? 'Applying...' : 'Apply Modification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
