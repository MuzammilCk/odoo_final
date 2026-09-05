import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NegotiationPanel from './components/NegotiationPanel';
import ConfirmButton from './components/ConfirmButton';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="bg-red-950/40 border border-red-800 p-6 rounded-xl text-center space-y-4">
        <p className="text-red-300">{error ?? 'Quotation not found'}</p>
        <Link to="/portal/quotations" className="text-brand-400 hover:underline text-sm inline-block">
          &larr; Back to My Quotations
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    APPROVED: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    UNDER_NEGOTIATION: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    CONFIRMED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/portal/quotations"
            className="text-xs text-gray-400 hover:text-gray-200 transition flex items-center gap-1 mb-2"
          >
            &larr; Back to My Quotations
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">{quotation.quote_number}</h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                statusColors[quotation.status] ?? 'bg-gray-800 text-gray-400'
              }`}
            >
              {quotation.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Issued on {new Date(quotation.created_at).toLocaleDateString()}
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Commercial Line Items</h2>
          <span className="text-xs text-gray-400">{quotation.lines.length} items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/60 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-6 py-3">Product / Service</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3 text-right">Quantity</th>
                <th className="px-6 py-3 text-right">Unit Price</th>
                <th className="px-6 py-3 text-right">Discount</th>
                <th className="px-6 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-gray-300">
              {quotation.lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-800/30 transition">
                  <td className="px-6 py-4 font-medium text-white">{line.product_name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        line.line_type === 'RECURRING'
                          ? 'bg-purple-900/40 text-purple-300 border border-purple-800/50'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {line.line_type === 'RECURRING' ? 'Subscription' : 'One-time'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">{line.quantity}</td>
                  <td className="px-6 py-4 text-right">
                    ${line.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {line.discount_percent > 0 ? (
                      <span className="text-amber-400 font-medium">{line.discount_percent}%</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-white">
                    ${line.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="bg-gray-950/70 p-6 border-t border-gray-800 flex flex-col sm:flex-row justify-end">
          <div className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal:</span>
              <span className="text-gray-200">
                ${quotation.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            {quotation.discount_total > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Discount Total:</span>
                <span className="text-amber-400">
                  -${quotation.discount_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>Estimated Tax:</span>
              <span className="text-gray-200">
                ${quotation.tax_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-white border-t border-gray-800 pt-2">
              <span>Grand Total:</span>
              <span className="text-emerald-400">
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
