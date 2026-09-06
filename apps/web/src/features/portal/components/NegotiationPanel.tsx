import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';

interface NegotiationItem {
  id: string;
  quotationLineId?: string | null;
  negotiationType: string;
  message?: string | null;
  requestedDiscountPercent?: number | null;
  requestedDeliveryDate?: string | null;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: { firstName: string; lastName: string; email?: string } | null;
  quotationLine?: {
    id: string;
    descriptionSnapshot: string;
    product?: { name: string };
  };
}

interface NegotiationPanelProps {
  quotationId: string;
  quotationStatus: string;
  lines: Array<{
    id: string;
    product_name?: string;
    productName?: string;
    unit_price?: number;
    unitPrice?: number;
    discount_percent?: number;
    discountPercent?: number;
  }>;
  onNegotiationSubmitted?: () => void;
}

export default function NegotiationPanel({
  quotationId,
  quotationStatus,
  lines,
  onNegotiationSubmitted,
}: NegotiationPanelProps) {
  const { token } = useAuth();
  const [negotiations, setNegotiations] = useState<NegotiationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<'COUNTER_DISCOUNT' | 'CHANGE_REQUEST' | 'COMMENT' | 'DELIVERY_DATE'>('COUNTER_DISCOUNT');
  const [lineId, setLineId] = useState<string>('');
  const [proposedDiscount, setProposedDiscount] = useState<string>('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState<string>('');
  const [content, setContent] = useState<string>('');

  const isNegotiable = quotationStatus === 'APPROVED' || quotationStatus === 'UNDER_NEGOTIATION';

  const fetchNegotiations = async () => {
    try {
      const res = await fetch(`/api/v1/portal/quotations/${quotationId}/negotiations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNegotiations(data);
      }
    } catch (err) {
      console.error('Error fetching negotiations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNegotiations();
  }, [quotationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please provide a message or justification.');
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/v1/portal/quotations/${quotationId}/negotiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          lineId: lineId || undefined,
          content,
          proposedDiscount: proposedDiscount ? parseFloat(proposedDiscount) : undefined,
          requestedDeliveryDate: requestedDeliveryDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to submit negotiation request');
      }

      setSuccess('Negotiation request submitted! Your sales representative has been notified.');
      setContent('');
      setProposedDiscount('');
      setRequestedDeliveryDate('');
      fetchNegotiations();
      if (onNegotiationSubmitted) onNegotiationSubmitted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Negotiation & Change Requests</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Submit counter-offers, schedule changes, or comments directly to your sales account team.
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isNegotiable ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-gray-800 text-gray-400'
          }`}
        >
          {isNegotiable ? 'Open for Negotiation' : 'Negotiation Locked'}
        </span>
      </div>

      {/* Submit Form (only if negotiable) */}
      {isNegotiable ? (
        <form onSubmit={handleSubmit} className="bg-gray-950/60 border border-gray-800/80 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-gray-200">Submit New Request</h4>

          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-300 rounded text-xs">{error}</div>}
          {success && <div className="p-3 bg-emerald-900/30 border border-emerald-800 text-emerald-300 rounded text-xs">{success}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Request Type</label>
              <select
                value={type}
                onChange={(e: any) => setType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="COUNTER_DISCOUNT">Counter-Discount Proposal</option>
                <option value="CHANGE_REQUEST">Specification Change Request</option>
                <option value="DELIVERY_DATE">Delivery Schedule Request</option>
                <option value="COMMENT">General Question / Comment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Target Line Item (Optional)</label>
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Entire Quotation</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.product_name ?? l.productName} (${l.unit_price ?? l.unitPrice})
                  </option>
                ))}
              </select>
            </div>

            {type === 'COUNTER_DISCOUNT' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Proposed Discount %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={proposedDiscount}
                  onChange={(e) => setProposedDiscount(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {type === 'DELIVERY_DATE' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Requested Delivery Date</label>
                <input
                  type="date"
                  value={requestedDeliveryDate}
                  onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Message & Context</label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Explain your proposal or request..."
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded text-sm transition shadow-lg shadow-indigo-600/30"
            >
              {submitting ? 'Submitting...' : 'Send Request to Sales Rep'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-gray-950/40 p-4 rounded border border-gray-800 text-xs text-gray-500 text-center">
          Quotation is in {quotationStatus} status. Negotiations can only take place while approved or actively negotiating.
        </div>
      )}

      {/* History of Requests */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300">Negotiation Activity</h4>
        {loading ? (
          <p className="text-xs text-gray-500">Loading history...</p>
        ) : negotiations.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No negotiation requests submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {negotiations.map((item) => (
              <div
                key={item.id}
                className="bg-gray-950/50 border border-gray-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-200">
                      {item.negotiationType.replace(/_/g, ' ')}
                    </span>
                    {item.quotationLine && (
                      <span className="text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                        Line: {item.quotationLine.product?.name ?? item.quotationLine.descriptionSnapshot}
                      </span>
                    )}
                    {item.requestedDiscountPercent !== null && item.requestedDiscountPercent !== undefined && (
                      <span className="text-amber-400 font-medium">
                        Proposed Discount: {item.requestedDiscountPercent}%
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300">{item.message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>Submitted: {new Date(item.createdAt).toLocaleString()}</span>
                    {item.resolvedBy && (
                      <span className="text-indigo-300 font-medium">
                        • Reviewed by {item.resolvedBy.firstName} {item.resolvedBy.lastName}
                        {item.resolvedAt ? ` on ${new Date(item.resolvedAt).toLocaleDateString()}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <span
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                      item.status === 'ACCEPTED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : item.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
