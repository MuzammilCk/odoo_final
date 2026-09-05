import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NegotiationPanel from './components/NegotiationPanel';
import ConfirmButton from './components/ConfirmButton';
import { ArrowLeft, FileText, Loader2, AlertCircle, Calendar } from 'lucide-react';

interface QuotationLineItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  line_total: number;
  line_type: string;
}

interface QuotationDetail {
  id: string;
  quote_number: string;
  status: string;
  currency_code: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  created_at: string;
  lines: QuotationLineItem[];
}

export default function PortalQuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotation = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/portal/quotations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to load quotation');
      }
      const data = await res.json();
      setQuotation(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          bg: 'bg-brand-500/10 text-brand-300 border-brand-500/25',
          dot: 'bg-brand-400',
        };
      case 'UNDER_NEGOTIATION':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
          dot: 'bg-amber-400',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-deal-500/10 text-deal-300 border-deal-500/25',
          dot: 'bg-deal-400',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500',
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="bg-rose-950/40 border border-rose-800/80 p-6 rounded-2xl text-center space-y-4">
        <AlertCircle size={24} className="text-rose-400 mx-auto" />
        <p className="text-rose-300 text-sm">{error ?? 'Quotation not found'}</p>
        <Link to="/portal/quotations" className="text-brand-400 hover:underline text-xs inline-flex items-center gap-1">
          <ArrowLeft size={13} />
          <span>Back to My Quotations</span>
        </Link>
      </div>
    );
  }

  const badge = getStatusBadge(quotation.status);

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/portal/quotations"
            className="text-xs text-slate-400 hover:text-slate-200 transition inline-flex items-center gap-1.5 mb-2 font-medium"
          >
            <ArrowLeft size={13} />
            <span>Back to My Quotations</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight font-mono">{quotation.quote_number}</h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badge.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              <span>{quotation.status.replace(/_/g, ' ')}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
            <Calendar size={12} />
            <span>Issued on {new Date(quotation.created_at).toLocaleDateString()}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ConfirmButton
            quotationId={quotation.id}
            quotationNumber={quotation.quote_number}
            status={quotation.status}
            grandTotal={quotation.grand_total}
            currencyCode={quotation.currency_code}
            onConfirmed={fetchQuotation}
          />
        </div>
      </div>

      {/* Commercial Line Items (Customer-Safe: NO internal margin, cost, or risk) */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between bg-surface-card/60">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-brand-400" />
            <span>Commercial Line Items</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">{quotation.lines.length} items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-base/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-surface-border">
              <tr>
                <th className="px-5 py-3.5">Product / Service</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5 text-right">Quantity</th>
                <th className="px-5 py-3.5 text-right">Unit Price</th>
                <th className="px-5 py-3.5 text-right">Discount</th>
                <th className="px-5 py-3.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-slate-300 text-xs">
              {quotation.lines.map((line) => (
                <tr key={line.id} className="hover:bg-surface-elevated/40 transition">
                  <td className="px-5 py-4 font-semibold text-white">{line.product_name}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        line.line_type === 'RECURRING'
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : 'bg-surface-elevated text-slate-400 border border-surface-border'
                      }`}
                    >
                      {line.line_type === 'RECURRING' ? 'Subscription' : 'One-time'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-numbers">{line.quantity}</td>
                  <td className="px-5 py-4 text-right font-mono tabular-numbers">
                    ${line.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-numbers">
                    {line.discount_percent > 0 ? (
                      <span className="text-amber-400 font-medium">-{line.discount_percent}%</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-white font-mono tabular-numbers">
                    ${line.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="bg-surface-base/60 p-6 border-t border-surface-border flex flex-col sm:flex-row justify-end">
          <div className="w-full sm:w-80 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Catalog Subtotal:</span>
              <span className="text-slate-200 tabular-numbers">
                ${quotation.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            {quotation.discount_total > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Discount Total:</span>
                <span className="text-rose-400 tabular-numbers">
                  -${quotation.discount_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>Estimated Tax:</span>
              <span className="text-slate-200 tabular-numbers">
                ${quotation.tax_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white border-t border-surface-border pt-3">
              <span>Grand Total:</span>
              <span className="text-deal-400 font-sans tabular-numbers">
                {quotation.currency_code} ${quotation.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Negotiation & Change Requests Panel */}
      <NegotiationPanel
        quotationId={quotation.id}
        quotationStatus={quotation.status}
        lines={quotation.lines}
        onNegotiationSubmitted={fetchQuotation}
      />
    </div>
  );
}
