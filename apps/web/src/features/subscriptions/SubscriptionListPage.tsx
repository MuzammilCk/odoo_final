import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

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

export default function SubscriptionListPage() {
  const { token, user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [runningRecurring, setRunningRecurring] = useState(false);

  async function loadSubscriptions() {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter
        ? `/subscriptions?status=${statusFilter}`
        : '/subscriptions';
      const res = await apiFetch<{ subscriptions: SubscriptionInstance[] }>(url, {}, token);
      setSubscriptions(res.subscriptions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscriptions();
  }, [token, statusFilter]);

  async function handleTriggerRecurringRun() {
    if (!confirm('Run recurring invoice batch for due subscriptions today?')) return;
    setRunningRecurring(true);
    try {
      const res = await apiFetch<{ created: number }>('/invoices/generate-recurring', { method: 'POST' }, token);
      alert(`Recurring billing run complete. Generated ${res.created} invoices.`);
      loadSubscriptions();
    } catch (err: any) {
      alert(err.message || 'Recurring billing failed');
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subscriptions</h1>
          <p className="text-sm text-gray-400 mt-1">Manage recurring customer contracts, billing cycles, and proration</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'FINANCE_OPS') && (
          <button
            onClick={handleTriggerRecurringRun}
            disabled={runningRecurring}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
          >
            <span>⚡</span> {runningRecurring ? 'Billing in progress...' : 'Bill Due Subscriptions'}
          </button>
        )}
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active Subscriptions</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Estimated MRR</p>
          <p className="text-2xl font-bold text-white mt-1">
            ${mrr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Tracked</p>
          <p className="text-2xl font-bold text-gray-300 mt-1">{subscriptions.length}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="PAUSED">Paused</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading subscriptions...</div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No subscriptions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Interval</th>
                  <th className="px-6 py-3.5">Qty</th>
                  <th className="px-6 py-3.5">Period Amount</th>
                  <th className="px-6 py-3.5">Next Billing</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {subscriptions.map((sub) => {
                  const periodAmount = Number(sub.unitPrice) * Number(sub.quantity);
                  const isDue = new Date(sub.nextBillingDate) <= new Date();

                  return (
                    <tr key={sub.id} className="hover:bg-gray-800/40 transition">
                      <td className="px-6 py-4 font-medium text-white">
                        {sub.customer?.name || 'Customer'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-200">{sub.product?.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{sub.product?.sku}</div>
                      </td>
                      <td className="px-6 py-4">
                        {sub.status === 'ACTIVE' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                            Active
                          </span>
                        ) : sub.status === 'CANCELLED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-950 text-red-300 border border-red-800/60">
                            Cancelled
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400">
                            {sub.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs">
                          {sub.billingInterval}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono">{Number(sub.quantity)}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-emerald-400">
                        ${periodAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className={isDue && sub.status === 'ACTIVE' ? 'text-amber-400 font-bold' : 'text-gray-400'}>
                          {new Date(sub.nextBillingDate).toLocaleDateString()}
                        </span>
                        {isDue && sub.status === 'ACTIVE' && (
                          <span className="ml-1.5 px-1.5 py-0.2 text-[10px] rounded bg-amber-950 text-amber-300 border border-amber-800">
                            Due
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/app/subscriptions/${sub.id}`}
                          className="text-brand-400 hover:text-brand-300 font-medium text-xs transition underline"
                        >
                          Details &rarr;
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
