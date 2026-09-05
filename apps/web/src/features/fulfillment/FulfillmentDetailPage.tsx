import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface AllocationProposalItem {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  shippingCostWeight: number;
}

interface ProposedLine {
  lineId: string;
  productId: string;
  productName: string;
  quantityNeeded: number;
  allocations: AllocationProposalItem[];
  backorderQuantity: number;
}

interface AllocationRecommendation {
  quotationId: string;
  quoteNumber: string;
  lines: ProposedLine[];
  hasSplit: boolean;
  hasBackorder: boolean;
  summary: {
    totalNeeded: number;
    totalAllocated: number;
    totalBackordered: number;
  };
}

export default function FulfillmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [quotation, setQuotation] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<AllocationRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual Override State
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideAllocations, setOverrideAllocations] = useState<Array<{ lineId: string; warehouseId: string; quantity: number }>>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const loadData = async () => {
    if (!id) return;
    try {
      setError(null);
      const [quoteRes, recRes, whRes] = await Promise.all([
        fetch(`/api/v1/internal/fulfillment/quotations/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/internal/fulfillment/quotations/${id}/allocate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/internal/warehouses', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!quoteRes.ok) {
        const err = await quoteRes.json();
        throw new Error(err.error ?? 'Failed to load quotation');
      }

      const quoteData = await quoteRes.json();
      setQuotation(quoteData);

      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendation(recData);

        // Pre-fill override allocations with recommendation
        const initialOverrides: Array<{ lineId: string; warehouseId: string; quantity: number }> = [];
        recData.lines.forEach((l: ProposedLine) => {
          l.allocations.forEach((a) => {
            initialOverrides.push({
              lineId: l.lineId,
              warehouseId: a.warehouseId,
              quantity: a.quantity,
            });
          });
        });
        setOverrideAllocations(initialOverrides);
      }

      if (whRes.ok) {
        const whData = await whRes.json();
        setWarehouses(whData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleAcceptSplit = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/internal/fulfillment/quotations/${id}/accept-split`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to commit allocation split');
      }

      setSuccess('Suggested allocation committed and warehouse inventory reserved successfully!');
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCommitOverride = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/internal/fulfillment/quotations/${id}/override-split`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocations: overrideAllocations.filter((a) => a.quantity > 0),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to commit manual override');
      }

      setSuccess('Manual allocation override committed successfully!');
      setIsOverrideOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="bg-red-950/40 border border-red-800 p-6 rounded-xl text-center">
        <p className="text-red-300">Quotation not found</p>
        <Link to="/app/fulfillment" className="text-brand-400 hover:underline text-sm mt-2 inline-block">
          &larr; Back to Fulfillment List
        </Link>
      </div>
    );
  }

  const hasCommittedAllocations = quotation.fulfillmentAllocations?.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <Link
            to="/app/fulfillment"
            className="text-xs text-gray-400 hover:text-gray-200 transition flex items-center gap-1 mb-2"
          >
            &larr; Back to Fulfillment Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">{quotation.quoteNumber}</h1>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">
              Confirmed Order
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Customer: <span className="font-semibold text-gray-200">{quotation.customer?.name}</span> • Total Value: ${Number(quotation.grandTotal).toLocaleString()}
          </p>
        </div>

        {/* Action buttons if not yet allocated */}
        {!hasCommittedAllocations && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOverrideOpen(true)}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg text-sm transition"
            >
              Manual Override
            </button>
            <button
              disabled={processing}
              onClick={handleAcceptSplit}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
            >
              {processing ? 'Reserving...' : 'Accept Suggested Split'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="p-4 bg-red-950/50 border border-red-800 text-red-300 rounded-xl text-sm">{error}</div>}
      {success && <div className="p-4 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl text-sm">{success}</div>}

      {/* Recommended Warehouse Split (Greedy Algorithm Output) */}
      {recommendation && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl space-y-4">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Suggested Warehouse Distribution</h2>
              <p className="text-xs text-gray-400">
                Calculated by greedy ranking (§6.27) to minimize multi-depot shipments and shipping weights.
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              {recommendation.hasSplit && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded">
                  Split Across Warehouses
                </span>
              )}
              {recommendation.hasBackorder && (
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded">
                  Stock Shortfall / Backorder
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {recommendation.lines.map((line) => (
              <div key={line.lineId} className="bg-gray-950/60 border border-gray-800/80 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center text-sm border-b border-gray-800 pb-2">
                  <span className="font-semibold text-white">{line.productName}</span>
                  <span className="text-gray-400 text-xs">Total Required: <strong className="text-white">{line.quantityNeeded} units</strong></span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {line.allocations.map((alloc, idx) => (
                    <div key={idx} className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold text-gray-200">{alloc.warehouseName}</p>
                        <p className="text-[10px] text-gray-500">Shipping Weight: {alloc.shippingCostWeight}x</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">
                        {alloc.quantity} units
                      </span>
                    </div>
                  ))}

                  {line.backorderQuantity > 0 && (
                    <div className="bg-rose-950/40 border border-rose-800/60 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold text-rose-300">Backorder (Shortfall)</p>
                        <p className="text-[10px] text-rose-400/80">Stock unavailable in network</p>
                      </div>
                      <span className="text-sm font-bold text-rose-300">
                        {line.backorderQuantity} units
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Committed Allocations (if already accepted) */}
      {hasCommittedAllocations && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-base font-semibold text-white">Committed Stock Reservations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/60 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3">Warehouse</th>
                  <th className="px-6 py-3">Allocated Qty</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Reserved At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {quotation.fulfillmentAllocations.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-800/30">
                    <td className="px-6 py-3.5 font-medium text-white">{a.warehouse.name}</td>
                    <td className="px-6 py-3.5 font-semibold text-emerald-400">{a.quantityAllocated}</td>
                    <td className="px-6 py-3.5">
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-xs">
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backorders Section */}
      {quotation.Backorder?.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-rose-300">Active Backorders for this Deal</h3>
          <div className="space-y-2">
            {quotation.Backorder.map((b: any) => (
              <div key={b.id} className="bg-gray-950 p-4 rounded-lg border border-gray-800 flex justify-between items-center text-sm">
                <div>
                  <p className="font-semibold text-white">Remaining Shortfall: {Number(b.quantityBackordered) - Number(b.quantityFulfilledLater)} units</p>
                  <p className="text-xs text-gray-500">Backordered on {new Date(b.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded text-xs font-semibold">
                  Open Backorder
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {isOverrideOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-semibold text-white">Manual Warehouse Override</h3>
              <button onClick={() => setIsOverrideOpen(false)} className="text-gray-400 hover:text-gray-200">
                &times;
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Customize the quantities assigned to each warehouse manually. Stock reservations will still be verified under row-level database locks.
            </p>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {quotation.lines.map((line: any) => (
                <div key={line.id} className="bg-gray-950 p-3 rounded-lg border border-gray-800 space-y-2">
                  <div className="flex justify-between text-xs text-gray-300 font-medium">
                    <span>{line.product?.name ?? line.descriptionSnapshot}</span>
                    <span>Target: {line.quantity} units</span>
                  </div>

                  {warehouses.map((wh) => {
                    const currentAlloc = overrideAllocations.find(
                      (a) => a.lineId === line.id && a.warehouseId === wh.id
                    );

                    return (
                      <div key={wh.id} className="flex items-center justify-between text-xs gap-3">
                        <span className="text-gray-400">{wh.name}</span>
                        <input
                          type="number"
                          min="0"
                          value={currentAlloc?.quantity ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setOverrideAllocations((prev) => {
                              const existing = prev.filter((a) => !(a.lineId === line.id && a.warehouseId === wh.id));
                              return [...existing, { lineId: line.id, warehouseId: wh.id, quantity: val }];
                            });
                          }}
                          className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-right text-gray-200"
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setIsOverrideOpen(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleCommitOverride}
                className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-md transition"
              >
                {processing ? 'Committing...' : 'Commit Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
