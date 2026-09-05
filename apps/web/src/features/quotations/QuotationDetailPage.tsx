/**
 * QuotationDetailPage — Commercial Quotation Editor & Governance Screen (Lane A)
 *
 * Spec refs: §6.1–6.18, §7.4, §8.21
 * Features:
 * - Line item editing, addition, deletion
 * - Live totals calculation
 * - Step A3.7: Risk score & badge with governance thresholds
 * - Step A4.4: Submit for Approval / Auto-approval workflow
 * - Step A5.6: Upsell & Cross-sell recommendation cards with 1-click add
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  basePrice: number | string;
  category?: { id: string; name: string };
}

interface QuotationLineItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number | string;
  discountPercent: number | string;
  allowedDiscountPercent: number | string;
  discountOveragePercent: number | string;
  lineSubtotal: number | string;
  product: { id: string; name: string; categoryId: string };
}

interface QuotationDetail {
  id: string;
  quoteNumber: string;
  currentVersion: number;
  status: string;
  currencyCode: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  blendedRiskScore: number | string;
  subtotal: number | string;
  discountTotal: number | string;
  taxTotal: number | string;
  grandTotal: number | string;
  marginAmount: number | string;
  marginPercent: number | string;
  updatedAt: string;
  customer?: { id: string; name: string; discountTierId?: string };
  salesRep?: { id: string; firstName: string; lastName: string };
  lines: QuotationLineItem[];
}

interface RecommendationItem {
  productId: string;
  productName: string;
  unitPrice: number;
  score: number;
  marginDeltaPercent: number;
  reason: string;
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Line editing states
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);

  // Add line modal
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addDiscount, setAddDiscount] = useState(0);
  const [addingLine, setAddingLine] = useState(false);

  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (id && token) {
      fetchQuotation();
      fetchRecommendations();
      fetchAvailableProducts();
    }
  }, [id, token]);

  async function fetchQuotation() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/internal/quotations/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch quotation details');
      const data = await res.json();
      setQuotation(data.quotation);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecommendations() {
    try {
      const res = await fetch(`/api/v1/internal/quotations/${id}/recommendations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (err) {
      console.error('Failed to load recommendations', err);
    }
  }

  async function fetchAvailableProducts() {
    try {
      const res = await fetch('/api/v1/internal/quotations/helpers/products', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableProducts(data.products || []);
        if (data.products?.length > 0) {
          setSelectedProductId(data.products[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load products', err);
    }
  }

  // Handle line update
  async function handleSaveLine(lineId: string) {
    try {
      const res = await fetch(`/api/v1/internal/quotations/${id}/lines/${lineId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: editQty,
          discountPercent: editDiscount,
          unitPrice: editPrice,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update line');
      }
      setEditingLineId(null);
      await fetchQuotation();
      fetchRecommendations();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  // Handle line delete
  async function handleDeleteLine(lineId: string) {
    if (!confirm('Are you sure you want to remove this line item?')) return;
    try {
      const res = await fetch(`/api/v1/internal/quotations/${id}/lines/${lineId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete line');
      }
      await fetchQuotation();
      fetchRecommendations();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  // Handle add line
  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault();
    try {
      setAddingLine(true);
      const res = await fetch(`/api/v1/internal/quotations/${id}/lines`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: addQty,
          discountPercent: addDiscount,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add line item');
      }
      setIsAddLineModalOpen(false);
      setAddQty(1);
      setAddDiscount(0);
      await fetchQuotation();
      fetchRecommendations();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setAddingLine(false);
    }
  }

  // 1-Click Add Recommendation
  async function handleAddRecommendation(productId: string) {
    try {
      const res = await fetch(`/api/v1/internal/quotations/${id}/lines`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity: 1,
          discountPercent: 0,
        }),
      });
      if (res.ok) {
        await fetchQuotation();
        fetchRecommendations();
      }
    } catch (err) {
      console.error('Failed to add recommendation', err);
    }
  }

  // Submit Quotation for Approval (A4.4)
  async function handleSubmitQuotation() {
    if (!quotation) return;
    try {
      setSubmitting(true);
      setActionFeedback(null);
      const res = await fetch(`/api/v1/internal/quotations/${id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit quotation');
      }

      setActionFeedback(data.message);
      await fetchQuotation();
    } catch (err: unknown) {
      setActionFeedback(`Error: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-800 text-gray-300 border-gray-700';
      case 'PENDING_APPROVAL':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/80';
      case 'APPROVED':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80';
      case 'CONFIRMED':
        return 'bg-blue-950/60 text-blue-400 border-blue-800/80';
      case 'UNDER_NEGOTIATION':
        return 'bg-purple-950/60 text-purple-400 border-purple-800/80';
      case 'REJECTED':
        return 'bg-rose-950/60 text-rose-400 border-rose-800/80';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return {
          badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-800',
          dot: 'bg-emerald-400',
          text: 'Within policy ceilings. Auto-approves upon submit.',
        };
      case 'MEDIUM':
        return {
          badge: 'bg-amber-950/60 text-amber-400 border-amber-800',
          dot: 'bg-amber-400',
          text: 'Overage detected (1–5 pts). Requires Manager approval.',
        };
      case 'HIGH':
        return {
          badge: 'bg-rose-950/60 text-rose-400 border-rose-800',
          dot: 'bg-rose-400',
          text: 'High discount risk (> 5 pts). Requires Manager + Finance approval.',
        };
      default:
        return {
          badge: 'bg-gray-800 text-gray-400 border-gray-700',
          dot: 'bg-gray-400',
          text: 'Uncalculated risk score.',
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-mono">Loading quotation calculation...</p>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="p-8">
        <div className="bg-rose-950/30 border border-rose-800 text-rose-300 p-4 rounded-xl">
          <h3 className="font-semibold text-rose-200">Error</h3>
          <p className="text-sm mt-1">{error || 'Quotation not found'}</p>
          <Link to="/app/quotations" className="text-xs text-brand-400 hover:underline mt-3 inline-block">
            &larr; Back to Quotations
          </Link>
        </div>
      </div>
    );
  }

  const isDraft = quotation.status === 'DRAFT';
  const riskInfo = getRiskColor(quotation.riskLevel);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Back Link & Feedback Banner */}
      <div className="flex items-center justify-between">
        <Link to="/app/quotations" className="text-xs text-gray-400 hover:text-brand-400 transition font-mono">
          &larr; Quotations List
        </Link>
        {actionFeedback && (
          <div className="bg-brand-950/60 border border-brand-800/80 text-brand-300 text-xs px-4 py-2 rounded-lg animate-fade-in">
            {actionFeedback}
          </div>
        )}
      </div>

      {/* Header Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-mono font-bold text-white tracking-tight">{quotation.quoteNumber}</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
              v{quotation.currentVersion}
            </span>
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(quotation.status)}`}>
              {quotation.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            Customer: <span className="text-gray-200 font-medium">{quotation.customer?.name}</span> | Sales Rep:{' '}
            <span className="text-gray-200">{quotation.salesRep ? `${quotation.salesRep.firstName} ${quotation.salesRep.lastName}` : 'Unassigned'}</span> | Currency:{' '}
            <span className="font-mono text-gray-200">{quotation.currencyCode}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {isDraft && (
            <>
              <button
                onClick={() => setIsAddLineModalOpen(true)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg transition border border-gray-700 flex items-center gap-2"
              >
                <span>+</span>
                <span>Add Item</span>
              </button>

              <button
                onClick={handleSubmitQuotation}
                disabled={submitting || quotation.lines.length === 0}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-sm transition flex items-center gap-2"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Submit for Approval</span>
              </button>
            </>
          )}

          {quotation.status === 'PENDING_APPROVAL' && (
            <Link
              to="/app/approvals"
              className="px-4 py-2 bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500/50 text-sm font-medium rounded-lg transition"
            >
              View in Approval Queue &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Discount Risk Banner (Step A3.7) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 font-mono font-bold text-sm ${riskInfo.badge}`}>
              <span className={`w-2 h-2 rounded-full ${riskInfo.dot}`} />
              <span>{quotation.riskLevel} RISK</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Blended Risk Score: <span className="font-mono text-brand-400">{Number(quotation.blendedRiskScore).toFixed(1)}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{riskInfo.text}</p>
            </div>
          </div>

          <div className="text-xs font-mono text-gray-500 bg-gray-950 px-3 py-2 rounded border border-gray-800">
            Governance: LOW = 0 pts | MEDIUM = 1–5 pts | HIGH &gt; 5 pts
          </div>
        </div>
      </div>

      {/* Main Grid: Line Items & Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Line Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Line Items ({quotation.lines.length})</h2>
              {isDraft && (
                <button
                  onClick={() => setIsAddLineModalOpen(true)}
                  className="text-xs font-medium text-brand-400 hover:text-brand-300"
                >
                  + Add line item
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-950/80 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-right">Unit Price</th>
                    <th className="px-3 py-3 text-right">Disc %</th>
                    <th className="px-3 py-3 text-right">Ceiling %</th>
                    <th className="px-3 py-3 text-right">Overage</th>
                    <th className="px-5 py-3 text-right">Subtotal</th>
                    {isDraft && <th className="px-4 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-gray-300">
                  {quotation.lines.length === 0 ? (
                    <tr>
                      <td colSpan={isDraft ? 8 : 7} className="px-6 py-10 text-center text-gray-500 font-mono text-sm">
                        No line items yet. Click &quot;Add Item&quot; to configure lines.
                      </td>
                    </tr>
                  ) : (
                    quotation.lines.map((line) => {
                      const isEditing = editingLineId === line.id;
                      const hasOverage = Number(line.discountOveragePercent) > 0;

                      return (
                        <tr key={line.id} className="hover:bg-gray-800/30 transition">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-white">{line.product.name}</p>
                          </td>

                          <td className="px-3 py-3.5 text-center font-mono">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                value={editQty}
                                onChange={(e) => setEditQty(Number(e.target.value))}
                                className="w-16 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-center text-white"
                              />
                            ) : (
                              line.quantity
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono text-gray-300">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(Number(e.target.value))}
                                className="w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-right text-white"
                              />
                            ) : (
                              `$${Number(line.unitPrice).toFixed(2)}`
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={editDiscount}
                                onChange={(e) => setEditDiscount(Number(e.target.value))}
                                className="w-16 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-right text-white"
                              />
                            ) : (
                              <span className={hasOverage ? 'text-rose-400 font-semibold' : 'text-gray-300'}>
                                {Number(line.discountPercent).toFixed(1)}%
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono text-gray-400">
                            {Number(line.allowedDiscountPercent).toFixed(1)}%
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono">
                            {hasOverage ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800">
                                +{Number(line.discountOveragePercent).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600">0.0%</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right font-mono font-semibold text-white">
                            ${Number(line.lineSubtotal).toFixed(2)}
                          </td>

                          {isDraft && (
                            <td className="px-4 py-3.5 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleSaveLine(line.id)}
                                    className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-1 rounded"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingLineId(null)}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2 text-xs">
                                  <button
                                    onClick={() => {
                                      setEditingLineId(line.id);
                                      setEditQty(line.quantity);
                                      setEditDiscount(Number(line.discountPercent));
                                      setEditPrice(Number(line.unitPrice));
                                    }}
                                    className="text-gray-400 hover:text-white"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLine(line.id)}
                                    className="text-rose-500 hover:text-rose-400"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upsell / Cross-Sell Recommendations Panel (Step A5.6) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>💡 Smart Commercial Recommendations</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-950 text-brand-400 border border-brand-800">
                    Engine Active
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  AI & rule-ranked add-ons based on co-purchase patterns and margin boosts
                </p>
              </div>
            </div>

            {recommendations.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono py-2">
                No active recommendations for this current quotation configuration.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.productId}
                    className="bg-gray-950/70 border border-gray-800/90 rounded-lg p-3.5 flex flex-col justify-between gap-3 hover:border-gray-700 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-white">{rec.productName}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                          Score {rec.score}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{rec.reason}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs font-mono">
                        <span className="text-gray-300">${rec.unitPrice.toFixed(2)}</span>
                        {rec.marginDeltaPercent > 0 && (
                          <span className="text-emerald-400 font-medium">+{rec.marginDeltaPercent}% Margin</span>
                        )}
                      </div>
                    </div>

                    {isDraft && (
                      <button
                        onClick={() => handleAddRecommendation(rec.productId)}
                        className="w-full text-xs font-medium py-1.5 px-3 rounded bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 border border-brand-700/50 transition flex items-center justify-center gap-1.5"
                      >
                        <span>+</span>
                        <span>Add to Quote</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Commercial Calculation Breakdown */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-white border-b border-gray-800 pb-3">
              Quotation Summary
            </h2>

            <div className="space-y-3 text-sm font-mono">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span className="text-gray-200">${Number(quotation.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Discount</span>
                <span className="text-rose-400">-${Number(quotation.discountTotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Tax</span>
                <span className="text-gray-200">${Number(quotation.taxTotal).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-800 pt-3 flex justify-between text-base font-bold text-white">
                <span>Grand Total</span>
                <span className="text-brand-400">
                  {quotation.currencyCode} ${Number(quotation.grandTotal).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Profitability / Margin Breakdown */}
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'FINANCE_OPS') && (
              <div className="border-t border-gray-800/80 pt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Commercial Margin
                </p>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-gray-400">Estimated Profit</span>
                  <span className="text-emerald-400 font-semibold">${Number(quotation.marginAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-gray-400">Gross Margin %</span>
                  <span className="text-emerald-400 font-semibold">{Number(quotation.marginPercent).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Audit / Timeline Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Audit & Versioning
            </h3>
            <div className="space-y-1 text-xs text-gray-400 font-mono">
              <p>Current Version: v{quotation.currentVersion}</p>
              <p>Last Calculated: {new Date(quotation.updatedAt).toLocaleString()}</p>
              <p className="text-gray-500 pt-1">
                * Note: Line modifications in DRAFT automatically increment the material version and recalculate discount risk.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Line Item Modal */}
      {isAddLineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">Add Line Item</h3>
              <button
                onClick={() => setIsAddLineModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddLine} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                  Select Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
                >
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${Number(p.basePrice).toFixed(2)}) {p.category ? `— ${p.category.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={(e) => setAddQty(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                    Discount %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={addDiscount}
                    onChange={(e) => setAddDiscount(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddLineModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingLine}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                >
                  {addingLine && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Add Line</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
