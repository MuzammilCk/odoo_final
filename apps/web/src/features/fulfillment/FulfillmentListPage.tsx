import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface FulfillmentSummary {
  id: string;
  quoteNumber: string;
  customerName: string;
  salesRepName: string;
  grandTotal: number;
  currencyCode: string;
  confirmedAt: string;
  allocationState: 'AWAITING_ALLOCATION' | 'PARTIAL_BACKORDER' | 'ALLOCATED';
  allocationsCount: number;
  backordersCount: number;
  totalAllocated: number;
  totalBackordered: number;
}

export default function FulfillmentListPage() {
  const { token } = useAuth();
  const [quotations, setQuotations] = useState<FulfillmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'AWAITING' | 'BACKORDER' | 'ALLOCATED'>('ALL');

  useEffect(() => {
    const fetchFulfillmentList = async () => {
      try {
        const res = await fetch('/api/v1/internal/fulfillment/quotations', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'Failed to load fulfillment list');
        }

        const data = await res.json();
        setQuotations(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFulfillmentList();
  }, [token]);

  const filtered = quotations.filter((q) => {
    if (filter === 'AWAITING') return q.allocationState === 'AWAITING_ALLOCATION';
    if (filter === 'BACKORDER') return q.allocationState === 'PARTIAL_BACKORDER' || q.backordersCount > 0;
    if (filter === 'ALLOCATED') return q.allocationState === 'ALLOCATED';
    return true;
  });

  const stateBadges: Record<string, { label: string; className: string }> = {
    AWAITING_ALLOCATION: {
      label: 'Awaiting Split',
      className: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    PARTIAL_BACKORDER: {
      label: 'Backorder Split',
      className: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    ALLOCATED: {
      label: 'Allocated / Ready',
      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Warehouse Fulfillment Operations</h1>
          <p className="text-xs text-gray-400 mt-1">
            Confirmed commercial deals ready for inventory allocation, multi-warehouse split resolution, and backorders.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-800/80 pb-2 text-xs">
        {(
          [
            { id: 'ALL', label: 'All Orders' },
            { id: 'AWAITING', label: 'Awaiting Allocation' },
            { id: 'BACKORDER', label: 'Backorders / Partial' },
            { id: 'ALLOCATED', label: 'Allocated' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-lg transition font-medium ${
              filter === t.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800 p-4 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center space-y-3">
          <div className="text-4xl">📦</div>
          <h3 className="text-base font-semibold text-white">No Fulfillment Orders</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            There are currently no confirmed quotations matching this filter.
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/60 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Quotation Ref</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Sales Rep</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Confirmed Date</th>
                  <th className="px-6 py-3.5 text-right">Order Value</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {filtered.map((quote) => {
                  const badge = stateBadges[quote.allocationState] ?? {
                    label: quote.allocationState,
                    className: 'bg-gray-800 text-gray-400',
                  };

                  return (
                    <tr key={quote.id} className="hover:bg-gray-800/30 transition">
                      <td className="px-6 py-4 font-mono font-semibold text-white">
                        {quote.quoteNumber}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-200">{quote.customerName}</td>
                      <td className="px-6 py-4 text-xs text-gray-400">{quote.salesRepName}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {quote.confirmedAt ? new Date(quote.confirmedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-white">
                        {quote.currencyCode} ${quote.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/app/fulfillment/${quote.id}`}
                          className="bg-brand-600 hover:bg-brand-500 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs transition inline-flex items-center gap-1 shadow-md shadow-brand-600/20"
                        >
                          Manage Split &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
