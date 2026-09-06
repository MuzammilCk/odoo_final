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
  MessageSquare,
  Clock,
  CornerDownRight,
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
  lineTotal: number | string;
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
  categoryName: string;
  unitPrice: number;
  score: number;
  marginDeltaPercent: number;
  reason: string;
  recommendationType: 'CROSS_SELL' | 'UPSELL' | 'PROMOTED';
  isPromoted: boolean;
}

interface NegotiationRequestItem {
  id: string;
  quotationId: string;
  negotiationType: string;
  message?: string | null;
  requestedDiscountPercent?: number | null;
  requestedDeliveryDate?: string | null;
  status: string;
  createdAt: string;
  requestedBy?: { id: string; firstName: string; lastName: string; email: string };
  resolvedBy?: { id: string; firstName: string; lastName: string; email: string };
  quotationLine?: {
    id: string;
    descriptionSnapshot: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    lineTotal: number;
    product?: { name: string };
  };
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [negotiations, setNegotiations] = useState<NegotiationRequestItem[]>([]);
  const [resolvingNegId, setResolvingNegId] = useState<string | null>(null);
  const [activeCounterFormId, setActiveCounterFormId] = useState<string | null>(null);
  const [customDiscount, setCustomDiscount] = useState<string>('');
  const [customComment, setCustomComment] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Line editing states
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>('1');
  const [editDiscount, setEditDiscount] = useState<string>('0');
  const [editPrice, setEditPrice] = useState<string>('0');

  // Add line modal
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addQty, setAddQty] = useState<string>('1');
  const [addDiscount, setAddDiscount] = useState<string>('0');
  const [addingLine, setAddingLine] = useState(false);

  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (id && token) {
      fetchQuotation();
      fetchAvailableProducts();
      fetchNegotiations();
    }
  }, [id, token]);

  // Re-fetch recommendations whenever lines change, but only if there are lines
  useEffect(() => {
    if (id && token && quotation && quotation.lines.length > 0) {
      fetchRecommendations();
    } else {
      setRecommendations([]);
    }
  }, [id, token, quotation?.lines.length]);

  async function fetchNegotiations() {
    try {
      const res = await fetch(`/api/v1/internal/quotations/${id}/negotiations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNegotiations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch negotiations:', err);
    }
  }

  async function handleResolveNegotiation(
    negotiationId: string,
    accepted: boolean,
    discountVal?: number,
    commentVal?: string
  ) {
    try {
      setResolvingNegId(negotiationId);
      const res = await fetch(`/api/v1/internal/quotations/${id}/negotiations/${negotiationId}/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accepted,
          adjustedDiscount: discountVal !== undefined ? Number(discountVal) : undefined,
          comment: commentVal || (accepted ? 'Accepted by sales representative' : 'Declined by sales representative'),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to respond to negotiation');
      }

      const data = await res.json();
      setActionFeedback(data.message || (accepted ? 'Negotiation accepted & quotation updated' : 'Negotiation rejected'));
      setActiveCounterFormId(null);
      setCustomDiscount('');
      setCustomComment('');
      await fetchQuotation();
      await fetchNegotiations();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve negotiation');
    } finally {
      setResolvingNegId(null);
    }
  }

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
          categoryName: r.product?.category?.name || '',
          unitPrice: Number(r.product?.basePrice ?? r.unitPrice ?? 0),
          score: Number(r.recommendationScore ?? r.score ?? 0),
          marginDeltaPercent: Number(r.marginDelta ?? r.marginDeltaPercent ?? 0),
          reason: r.reason || (r.coPurchaseScore > 0 ? 'Frequently co-purchased' : 'Complements this order'),
          recommendationType: r.recommendationType || (r.isPromoted ? 'PROMOTED' : 'CROSS_SELL'),
          isPromoted: Boolean(r.isPromoted),
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
          quantity: Math.max(1, parseInt(editQty, 10) || 1),
          discountPercent: Math.min(100, Math.max(0, parseFloat(editDiscount) || 0)),
          unitPrice: Math.max(0, parseFloat(editPrice) || 0),
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
          quantity: Math.max(1, parseInt(addQty, 10) || 1),
          discountPercent: Math.min(100, Math.max(0, parseFloat(addDiscount) || 0)),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add line item');
      }
      setIsAddLineModalOpen(false);
      setAddQty('1');
      setAddDiscount('0');
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

  const isDraft    = quotation.status === 'DRAFT';
  // Only Sales Reps can edit lines and submit quotations — Managers/Admin can view only
  const isSalesRep = user?.role === 'SALES_REP';
  const canEdit    = isDraft && isSalesRep;
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
          {canEdit && (
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

      {/* Customer Negotiation & Portal Requests (Lane B Step B3) */}
      {(negotiations.length > 0 || quotation.status === 'UNDER_NEGOTIATION') && (
        <div className={`border rounded-2xl p-6 shadow-card transition-all ${
          quotation.status === 'UNDER_NEGOTIATION'
            ? 'bg-purple-950/20 border-purple-500/40 shadow-purple-900/10 ring-1 ring-purple-500/20'
            : 'bg-surface-card border-surface-border'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-surface-border/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <MessageSquare size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Customer Negotiation & Portal Requests</span>
                  {quotation.status === 'UNDER_NEGOTIATION' && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                      Live Negotiation Active
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  Direct requests, line-item counter-offers, and comments from the customer portal.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-3 py-1 rounded-lg bg-surface-elevated text-slate-300 border border-surface-border">
                {negotiations.filter((n) => n.status === 'OPEN').length} Pending Action
              </span>
            </div>
          </div>

          {negotiations.length === 0 ? (
            <div className="py-6 px-4 text-center rounded-xl bg-surface-base/60 border border-surface-border text-xs text-slate-400 italic">
              Quotation is open for negotiation. When the customer submits changes through the portal, they will appear here.
            </div>
          ) : (
            <div className="space-y-4">
              {negotiations.map((item) => {
                const isOpen = item.status === 'OPEN';
                const isCounter = item.negotiationType === 'COUNTER_DISCOUNT';

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isOpen
                        ? 'bg-surface-elevated/70 border-purple-500/30 shadow-sm'
                        : 'bg-surface-base/50 border-surface-border opacity-85'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          isCounter
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : item.negotiationType === 'CHANGE_REQUEST'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        }`}>
                          {item.negotiationType.replace(/_/g, ' ')}
                        </span>

                        <span className="text-xs text-slate-300">
                          by <strong className="text-white">{item.requestedBy ? `${item.requestedBy.firstName} ${item.requestedBy.lastName}` : 'Customer'}</strong>
                        </span>

                        <span className="text-[11px] text-slate-500">
                          ({new Date(item.createdAt).toLocaleString()})
                        </span>
                      </div>

                      <span className={`text-xs font-mono px-2.5 py-0.5 rounded-md border ${
                        item.status === 'OPEN'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : item.status === 'ACCEPTED'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Details row */}
                    <div className="space-y-2 mb-3">
                      {item.quotationLine && (
                        <div className="text-xs text-slate-300 bg-surface-base/80 px-3 py-1.5 rounded-lg border border-surface-border flex items-center justify-between flex-wrap gap-2">
                          <span>Target Line: <strong className="text-white">{item.quotationLine.product?.name || item.quotationLine.descriptionSnapshot}</strong></span>
                          <span className="font-mono text-slate-400">
                            Current Line Discount: <strong className="text-amber-400">{Number(item.quotationLine.discountPercent).toFixed(1)}%</strong>
                          </span>
                        </div>
                      )}

                      {item.requestedDiscountPercent !== null && item.requestedDiscountPercent !== undefined && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/25 text-xs text-purple-200">
                          <CornerDownRight size={14} className="text-purple-400 shrink-0" />
                          <span>Customer Proposed Counter Discount: <strong className="text-white font-mono text-sm underline">{Number(item.requestedDiscountPercent).toFixed(1)}%</strong></span>
                        </div>
                      )}

                      {item.requestedDeliveryDate && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/25 text-xs text-blue-200">
                          <Clock size={14} className="text-blue-400 shrink-0" />
                          <span>Customer Requested Delivery Date: <strong className="text-white font-mono">{new Date(item.requestedDeliveryDate).toLocaleDateString()}</strong></span>
                        </div>
                      )}

                      {item.message && (
                        <p className="text-xs text-slate-300 italic bg-surface-base px-3 py-2 rounded-lg border border-surface-border">
                          &ldquo;{item.message}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Rep Resolution Controls (Only if OPEN) */}
                    {isOpen && (
                      <div className="pt-2 border-t border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() =>
                              handleResolveNegotiation(
                                item.id,
                                true,
                                item.requestedDiscountPercent !== null && item.requestedDiscountPercent !== undefined
                                  ? Number(item.requestedDiscountPercent)
                                  : undefined,
                                'Customer proposal accepted by Sales Rep'
                              )
                            }
                            disabled={resolvingNegId === item.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Check size={13} />
                            <span>
                              Accept {item.requestedDiscountPercent ? `(${item.requestedDiscountPercent}%)` : 'Proposal'}
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveCounterFormId(activeCounterFormId === item.id ? null : item.id);
                              setCustomDiscount(
                                item.requestedDiscountPercent !== null && item.requestedDiscountPercent !== undefined
                                  ? String(item.requestedDiscountPercent)
                                  : ''
                              );
                            }}
                            disabled={resolvingNegId === item.id}
                            className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 size={13} />
                            <span>Adjust & Counter</span>
                          </button>

                          <button
                            onClick={() => handleResolveNegotiation(item.id, false, undefined, 'Declined by Sales Rep')}
                            disabled={resolvingNegId === item.id}
                            className="px-3 py-1.5 bg-surface-base hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-surface-border text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <X size={13} />
                            <span>Decline</span>
                          </button>
                        </div>

                        {resolvingNegId === item.id && (
                          <div className="flex items-center gap-2 text-xs text-brand-400 font-mono">
                            <Loader2 size={13} className="animate-spin" />
                            <span>Processing & recalculating governance...</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Counter / Adjust Form */}
                    {isOpen && activeCounterFormId === item.id && (
                      <div className="mt-3 p-3.5 rounded-lg bg-surface-base border border-purple-500/40 space-y-3 animate-fade-in">
                        <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Edit3 size={12} />
                          <span>Specify Custom Counter-Terms</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                              Approved Discount % on line:
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={customDiscount}
                              onChange={(e) => setCustomDiscount(e.target.value)}
                              placeholder="e.g. 20"
                              className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                              Response Note for Customer:
                            </label>
                            <input
                              type="text"
                              value={customComment}
                              onChange={(e) => setCustomComment(e.target.value)}
                              placeholder="e.g. Best offer we can authorize within margin rules"
                              className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setActiveCounterFormId(null)}
                            className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleResolveNegotiation(
                                item.id,
                                true,
                                customDiscount ? parseFloat(customDiscount) : undefined,
                                customComment || 'Custom counter-terms applied by Sales Rep'
                              )
                            }
                            disabled={resolvingNegId === item.id}
                            className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-md text-xs font-semibold"
                          >
                            Apply Terms & Re-Evaluate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
              {canEdit && (
                <button
                  onClick={() => {
                    setAddQty('1');
                    setAddDiscount('0');
                    setIsAddLineModalOpen(true);
                  }}
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
                    {canEdit && <th className="px-4 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border text-slate-300 text-xs">
                  {quotation.lines.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 8 : 7} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shadow-inner">
                            <Plus size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white tracking-tight">Quotation Initialized — Ready for Products</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              This quotation container is currently empty. Choose from over <strong className="text-brand-400 font-semibold">216 active catalog products</strong> (hardware, cloud subscriptions, software licenses &amp; consulting services) to configure line items.
                            </p>
                          </div>
                          {canEdit && (
                            <button
                              type="button"
                              id="btn-empty-add-item"
                              onClick={() => setIsAddLineModalOpen(true)}
                              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition hover:scale-[1.02] active:scale-[0.98]"
                            >
                              <Plus size={14} />
                              <span>Add Line Item from Catalog</span>
                            </button>
                          )}
                        </div>
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
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setEditQty(e.target.value)}
                                onBlur={() => {
                                  if (editQty === '' || Number(editQty) < 1 || isNaN(Number(editQty))) {
                                    setEditQty('1');
                                  }
                                }}
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
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setEditPrice(e.target.value)}
                                onBlur={() => {
                                  if (editPrice === '' || isNaN(Number(editPrice))) {
                                    setEditPrice('0.00');
                                  }
                                }}
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
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setEditDiscount(e.target.value)}
                                onBlur={() => {
                                  if (editDiscount === '' || isNaN(Number(editDiscount))) {
                                    setEditDiscount('0');
                                  } else {
                                    const val = Math.min(100, Math.max(0, parseFloat(editDiscount)));
                                    setEditDiscount(String(val));
                                  }
                                }}
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
                            ${Number(line.lineTotal).toFixed(2)}
                          </td>

                          {canEdit && (
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
                                      setEditQty(String(line.quantity));
                                      setEditDiscount(String(Number(line.discountPercent)));
                                      setEditPrice(String(Number(line.unitPrice).toFixed(2)));
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
                    Engine recommendations based on catalog co-purchasing &amp; margin potential
                  </p>
                </div>
              </div>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                quotation.lines.length > 0
                  ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                  : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
              }`}>
                {quotation.lines.length > 0 ? 'Active' : 'Inactive'}
              </span>
            </div>

            {quotation.lines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-5 text-center">
                <Sparkles size={22} className="text-slate-600" />
                <p className="text-xs font-semibold text-slate-400">Add a product to unlock recommendations</p>
                <p className="text-[11px] text-slate-600 max-w-xs">
                  Smart upsell &amp; cross-sell suggestions will appear here once you add at least one line item to this quotation.
                </p>
              </div>
            ) : recommendations.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-2">
                No additional recommendations for this current quotation configuration.
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
                        <div>
                          <h4 className="text-xs font-bold text-white leading-snug">{rec.productName}</h4>
                          {rec.categoryName && (
                            <p className="text-[10px] text-slate-500 mt-0.5">{rec.categoryName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {rec.isPromoted && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/25">
                              ★ Promoted
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated text-slate-400 border border-surface-border">
                            Score {rec.score}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{rec.reason}</p>

                      <div className="flex items-center gap-3 mt-2.5 text-xs font-mono">
                        <span className="text-white font-semibold">${Number(rec.unitPrice || 0).toFixed(2)}</span>
                        {Number(rec.marginDeltaPercent || 0) > 0 && (
                          <span className="text-emerald-400 font-medium">+{Number(rec.marginDeltaPercent || 0).toFixed(2)}% margin</span>
                        )}
                      </div>
                    </div>

                    {canEdit && (
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
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAddQty(e.target.value)}
                    onBlur={() => {
                      if (addQty === '' || Number(addQty) < 1 || isNaN(Number(addQty))) {
                        setAddQty('1');
                      }
                    }}
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
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAddDiscount(e.target.value)}
                    onBlur={() => {
                      if (addDiscount === '' || isNaN(Number(addDiscount))) {
                        setAddDiscount('0');
                      } else {
                        const val = Math.min(100, Math.max(0, parseFloat(addDiscount)));
                        setAddDiscount(String(val));
                      }
                    }}
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
