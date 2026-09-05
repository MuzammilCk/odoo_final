import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PackageCheck, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';

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

  const stateBadges: Record<string, { label: string; bg: string; dot: string }> = {
    AWAITING_ALLOCATION: {
      label: 'Awaiting Split',
      bg: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
      dot: 'bg-amber-400',
    },
    PARTIAL_BACKORDER: {
      label: 'Backorder Split',
      bg: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
      dot: 'bg-rose-400',
    },
    ALLOCATED: {
      label: 'Allocated / Ready',
      bg: 'bg-deal-500/10 text-deal-300 border-deal-500/25',
      dot: 'bg-deal-400',
    },
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Warehouse Fulfillment Operations</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-surface-elevated text-slate-400 border border-surface-border">
              {filtered.length} orders
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Confirmed commercial deals ready for inventory allocation, multi-warehouse split resolution, and backorders.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 bg-surface-card border border-surface-border rounded-2xl p-2.5 shadow-card overflow-x-auto text-xs">
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
            className={`px-3 py-1.5 rounded-xl transition font-semibold whitespace-nowrap cursor-pointer ${
              filter === t.id
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 p-4 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 size={32} className="text-brand-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-2xl p-16 text-center space-y-3 shadow-card">
          <PackageCheck size={36} className="text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No Fulfillment Orders</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are currently no confirmed quotations matching this filter.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-base/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-surface-border">
                <tr>
                  <th className="px-5 py-3.5">Quotation Ref</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Sales Rep</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Confirmed Date</th>
                  <th className="px-5 py-3.5 text-right">Order Value</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300 text-xs">
                {filtered.map((quote) => {
                  const badge = stateBadges[quote.allocationState] ?? {
                    label: quote.allocationState,
                    bg: 'bg-slate-800 text-slate-400 border-slate-700',
                    dot: 'bg-slate-500',
                  };

                  return (
                    <tr key={quote.id} className="hover:bg-surface-elevated/40 transition">
                      <td className="px-5 py-4 font-mono font-bold text-white whitespace-nowrap">
                        {quote.quoteNumber}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-200">{quote.customerName}</td>
                      <td className="px-5 py-4 text-xs text-slate-400">{quote.salesRepName}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {quote.confirmedAt ? new Date(quote.confirmedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-white font-mono tabular-numbers whitespace-nowrap">
                        {quote.currencyCode} ${quote.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Link
                          to={`/app/fulfillment/${quote.id}`}
                          className="bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition inline-flex items-center gap-1 shadow-sm shadow-brand-600/25 cursor-pointer"
                        >
                          <span>Manage Split</span>
                          <ArrowUpRight size={13} />
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
