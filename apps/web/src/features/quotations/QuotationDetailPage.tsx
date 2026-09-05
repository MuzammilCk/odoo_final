/**
 * QuotationDetailPage — Commercial Quotation Editor & Governance Screen (Lane A)
 * Upgraded with ui-ux-pro-max design system:
 * - Lucide SVG icons (Plus, Check, X, ShieldAlert, Sparkles, Trash2, Edit3, Loader2, ArrowLeft)
 * - Visual risk score meter with threshold badges
 * - Tabular currency and percentage typography
 * - Elevated cards and smooth interactive rows
 * - Smart recommendation cards with 1-click add
 *
 * Spec refs: §6.1–6.18, §7.4, §8.21
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertCircle,
  FileCheck2,
  Send,
} from 'lucide-react';

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
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | string | null;
  blendedRiskScore?: number | string | null;
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
        const rawRecs = data.recommendations || [];
        const mapped: RecommendationItem[] = rawRecs.map((r: any) => ({
          productId: r.product?.id || r.productId,
          productName: r.product?.name || r.productName || 'Recommended Product',
          unitPrice: Number(r.product?.basePrice ?? r.unitPrice ?? 0),
          score: Number(r.recommendationScore ?? r.score ?? 0),
          marginDeltaPercent: Number(r.marginDelta ?? r.marginDeltaPercent ?? 0),
          reason: r.isPromoted
            ? 'High-margin strategic recommendation'
            : (r.coPurchaseScore > 0 ? 'Frequently co-purchased with current items' : 'Catalog addition opportunity'),
        }));
        setRecommendations(mapped);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return {
          bg: 'bg-slate-800/80 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
      case 'PENDING_APPROVAL':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
          dot: 'bg-amber-400',
        };
      case 'APPROVED':
        return {
          bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
          dot: 'bg-emerald-400',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
          dot: 'bg-blue-400',
        };
      case 'UNDER_NEGOTIATION':
        return {
          bg: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
          dot: 'bg-purple-400',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
          dot: 'bg-rose-400',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500',
        };
    }
  };

  const getRiskColor = (risk?: string | null) => {
    switch (risk) {
      case 'LOW':
        return {
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
          icon: ShieldCheck,
          text: 'Within standard policy ceilings. Auto-approves upon submit.',
        };
      case 'MEDIUM':
        return {
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
          icon: ShieldAlert,
          text: 'Overage detected (1–5 pts). Requires Manager approval.',
        };
      case 'HIGH':
        return {
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400',
          icon: ShieldAlert,
          text: 'High discount risk (> 5 pts). Requires Manager + Finance approval.',
        };
      default:
        return {
          badge: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-400',
          icon: ShieldCheck,
          text: 'Uncalculated risk score.',
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[75vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-brand-500 animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Loading commercial quotation calculation...</p>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-rose-950/30 border border-rose-800/80 text-rose-300 p-5 rounded-2xl flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-rose-200">Error Loading Quotation</h3>
            <p className="text-sm mt-1 text-rose-300/90">{error || 'Quotation not found'}</p>
            <Link to="/app/quotations" className="text-xs text-brand-400 hover:underline mt-3 inline-flex items-center gap-1">
              <ArrowLeft size={13} />
              <span>Back to Quotations</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isDraft = quotation.status === 'DRAFT';
  const riskInfo = getRiskColor(quotation.riskLevel);
  const statusBadge = getStatusBadge(quotation.status);
  const RiskIcon = riskInfo.icon;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Back Link & Feedback Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          to="/app/quotations"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition font-medium"
        >
          <ArrowLeft size={14} />
          <span>Back to Quotations</span>
        </Link>
        {actionFeedback && (
          <div className="bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs px-3.5 py-1.5 rounded-xl animate-fade-in flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            <span>{actionFeedback}</span>
          </div>
        )}
      </div>

      {/* Header Card */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-mono font-bold text-white tracking-tight">{quotation.quoteNumber}</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-surface-elevated text-slate-300 border border-surface-border">
              v{quotation.currentVersion}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border ${statusBadge.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
              <span>{quotation.status.replace('_', ' ')}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
            <span>Customer: <strong className="text-slate-200">{quotation.customer?.name}</strong></span>
            <span>&bull;</span>
            <span>Rep: <strong className="text-slate-200">{quotation.salesRep ? `${quotation.salesRep.firstName} ${quotation.salesRep.lastName}` : 'Unassigned'}</strong></span>
            <span>&bull;</span>
            <span>Currency: <strong className="font-mono text-slate-200">{quotation.currencyCode}</strong></span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isDraft && (
            <>
              <button
                onClick={() => setIsAddLineModalOpen(true)}
                className="px-3.5 py-2 bg-surface-elevated hover:bg-slate-700/80 text-slate-200 text-xs font-semibold rounded-xl border border-surface-border transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>

              <button
                onClick={handleSubmitQuotation}
                disabled={submitting || quotation.lines.length === 0}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-600/25 transition duration-150 flex items-center gap-2 cursor-pointer"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Submit for Approval</span>
              </button>
            </>
          )}

          {quotation.status === 'PENDING_APPROVAL' && (
            <Link
              to="/app/approvals"
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5"
            >
              <span>View in Approval Queue</span>
              <span>&rarr;</span>
            </Link>
          )}
        </div>
      </div>

      {/* Discount Risk Banner (Step A3.7) */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-2 rounded-xl border flex items-center gap-2 font-mono font-bold text-xs ${riskInfo.badge}`}>
              <RiskIcon size={16} />
              <span>{quotation.riskLevel || 'LOW'} RISK</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Blended Risk Score:</span>
                <span className="font-mono text-brand-400 text-sm font-bold">{Number(quotation.blendedRiskScore ?? 0).toFixed(1)}</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{riskInfo.text}</p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 bg-surface-base px-3 py-1.5 rounded-lg border border-surface-border">
            Governance: LOW = 0 pts | MEDIUM = 1–5 pts | HIGH &gt; 5 pts
          </div>
        </div>
      </div>

      {/* Main Grid: Line Items & Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Line Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-card border border-surface-border rounded-2xl shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between bg-surface-card/60">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Line Items</h2>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-surface-elevated border border-surface-border text-slate-400">
                  {quotation.lines.length} items
                </span>
              </div>
              {isDraft && (
                <button
                  onClick={() => setIsAddLineModalOpen(true)}
                  className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add line item</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-base/80 border-b border-surface-border text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
                <tbody className="divide-y divide-surface-border text-slate-300 text-xs">
                  {quotation.lines.length === 0 ? (
                    <tr>
                      <td colSpan={isDraft ? 8 : 7} className="px-6 py-12 text-center text-slate-500 font-mono">
                        No line items yet. Click &quot;Add Item&quot; to configure pricing lines.
                      </td>
                    </tr>
                  ) : (
                    quotation.lines.map((line) => {
                      const isEditing = editingLineId === line.id;
                      const hasOverage = Number(line.discountOveragePercent) > 0;

                      return (
                        <tr key={line.id} className="hover:bg-surface-elevated/40 transition">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-white">{line.product.name}</p>
                          </td>

                          <td className="px-3 py-3.5 text-center font-mono">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                value={editQty}
                                onChange={(e) => setEditQty(Number(e.target.value))}
                                className="w-16 bg-surface-base border border-surface-border rounded-lg px-2 py-1 text-center text-white text-xs font-mono focus:border-brand-500 focus:outline-none"
                              />
                            ) : (
                              line.quantity
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono text-slate-200 tabular-numbers">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(Number(e.target.value))}
                                className="w-20 bg-surface-base border border-surface-border rounded-lg px-2 py-1 text-right text-white text-xs font-mono focus:border-brand-500 focus:outline-none"
                              />
                            ) : (
                              `$${Number(line.unitPrice).toFixed(2)}`
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono tabular-numbers">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={editDiscount}
                                onChange={(e) => setEditDiscount(Number(e.target.value))}
                                className="w-16 bg-surface-base border border-surface-border rounded-lg px-2 py-1 text-right text-white text-xs font-mono focus:border-brand-500 focus:outline-none"
                              />
                            ) : (
                              <span className={hasOverage ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                                {Number(line.discountPercent).toFixed(1)}%
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono text-slate-400 tabular-numbers">
                            {Number(line.allowedDiscountPercent).toFixed(1)}%
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono tabular-numbers">
                            {hasOverage ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                                +{Number(line.discountOveragePercent).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">0.0%</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right font-mono font-bold text-white tabular-numbers">
                            ${Number(line.lineSubtotal).toFixed(2)}
                          </td>

                          {isDraft && (
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleSaveLine(line.id)}
                                    className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded transition cursor-pointer"
                                    title="Save"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingLineId(null)}
                                    className="p-1 text-slate-400 hover:bg-surface-elevated rounded transition cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5 text-xs">
                                  <button
                                    onClick={() => {
                                      setEditingLineId(line.id);
                                      setEditQty(line.quantity);
                                      setEditDiscount(Number(line.discountPercent));
                                      setEditPrice(Number(line.unitPrice));
                                    }}
                                    className="p-1 text-slate-400 hover:text-white hover:bg-surface-elevated rounded transition cursor-pointer"
                                    title="Edit line"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLine(line.id)}
                                    className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition cursor-pointer"
                                    title="Delete line"
                                  >
                                    <Trash2 size={13} />
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
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <Sparkles size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Smart Commercial Add-Ons</h3>
                  <p className="text-xs text-slate-400">
                    Engine recommendations based on catalog co-purchasing & margin potential
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30">
                Active
              </span>
            </div>

            {recommendations.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-2">
                No active recommendations for this current quotation configuration.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.productId}
                    className="bg-surface-base/80 border border-surface-border rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-surface-border-light transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-white">{rec.productName}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/25">
                          Score {rec.score}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{rec.reason}</p>
                      <div className="flex items-center gap-3 mt-2.5 text-xs font-mono">
                        <span className="text-white font-semibold">${Number(rec.unitPrice || 0).toFixed(2)}</span>
                        {Number(rec.marginDeltaPercent || 0) > 0 && (
                          <span className="text-deal-400 font-medium">+{Number(rec.marginDeltaPercent || 0)}% Margin</span>
                        )}
                      </div>
                    </div>

                    {isDraft && (
                      <button
                        onClick={() => handleAddRecommendation(rec.productId)}
                        className="w-full text-xs font-semibold py-1.5 px-3 rounded-xl bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={13} />
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
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-card space-y-5">
            <h2 className="text-sm font-bold text-white border-b border-surface-border pb-3.5 flex items-center justify-between">
              <span>Financial Summary</span>
              <FileCheck2 size={16} className="text-brand-400" />
            </h2>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Catalog Subtotal</span>
                <span className="text-slate-200 tabular-numbers">${Number(quotation.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Discounts Applied</span>
                <span className="text-rose-400 tabular-numbers">-${Number(quotation.discountTotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Calculated Tax</span>
                <span className="text-slate-200 tabular-numbers">${Number(quotation.taxTotal).toFixed(2)}</span>
              </div>
              <div className="border-t border-surface-border pt-3.5 flex justify-between text-base font-bold text-white">
                <span>Grand Total</span>
                <span className="text-brand-400 tabular-numbers">
                  {quotation.currencyCode} ${Number(quotation.grandTotal).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Profitability / Margin Breakdown */}
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'FINANCE_OPS') && (
              <div className="border-t border-surface-border pt-4 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Commercial Governance Margin
                </p>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Estimated Profit</span>
                  <span className="text-deal-400 font-bold tabular-numbers">${Number(quotation.marginAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Gross Margin %</span>
                  <span className="text-deal-400 font-bold tabular-numbers">{Number(quotation.marginPercent).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Audit / Timeline Info */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-card space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Audit & Governance Trace
            </h3>
            <div className="space-y-1.5 text-xs text-slate-400 font-mono">
              <p>Current Version: <strong className="text-white">v{quotation.currentVersion}</strong></p>
              <p>Last Recalculated: {new Date(quotation.updatedAt).toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 pt-1">
                * Note: Modifying line pricing in DRAFT triggers an auto-version bump and recalculates discount thresholds.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Line Item Modal */}
      {isAddLineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/80 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-border pb-3.5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Add Line Item</h3>
                <p className="text-xs text-slate-400 mt-0.5">Select a catalog product and configure quantity</p>
              </div>
              <button
                onClick={() => setIsAddLineModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-surface-elevated transition cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleAddLine} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-surface-base border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
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
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={(e) => setAddQty(Number(e.target.value))}
                    className="w-full bg-surface-base border border-surface-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Discount %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={addDiscount}
                    onChange={(e) => setAddDiscount(Number(e.target.value))}
                    className="w-full bg-surface-base border border-surface-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsAddLineModalOpen(false)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-slate-700/80 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingLine}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-600/25 transition duration-150 flex items-center gap-2 cursor-pointer"
                >
                  {addingLine && <Loader2 size={14} className="animate-spin" />}
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
