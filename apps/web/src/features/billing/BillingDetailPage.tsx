import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

interface BillingSummary {
  quotation: {
    id: string;
    quoteNumber: string;
    status: string;
    currencyCode: string;
    grandTotal: number | string;
    customer: { id: string; name: string };
  };
  oneTimeCharges: {
    id: string;
    quantity: number | string;
    unitPrice: number | string;
    lineTotal: number | string;
    descriptionSnapshot: string;
    product: { name: string; sku: string };
  }[];
  recurringCharges: {
    id: string;
    quantity: number | string;
    unitPrice: number | string;
    lineTotal: number | string;
    descriptionSnapshot: string;
    product: { name: string; sku: string };
  }[];
  subscriptions: {
    id: string;
    status: string;
    billingInterval: string;
    quantity: number | string;
    unitPrice: number | string;
    nextBillingDate: string;
    product: { name: string };
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    totalAmount: number | string;
    status: string;
    dueAt: string;
    payments: { id: string; amount: number | string }[];
    creditNotes: { id: string; amount: number | string }[];
  }[];
}

export default function BillingDetailPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const { token, user } = useAuth();

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function loadSummary() {
    if (!quotationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<BillingSummary>(`/summary/${quotationId}`, {}, token);
      setSummary(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing summary');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, [quotationId, token]);

  async function handleGenerateFromFulfillment() {
    if (!quotationId) return;
    setGenerating(true);
    try {
      const res = await apiFetch(
        '/invoices/generate-from-fulfillment',
        {
          method: 'POST',
          body: JSON.stringify({ quotationId }),
        },
        token,
      );
      alert(`Invoice generated: ${res.invoiceNumber}`);
      loadSummary();
    } catch (err: any) {
      alert(err.message || 'Invoice generation failed');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="p-12 text-center text-gray-500">Loading billing summary...</div>;
  if (error || !summary) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="text-red-400">{error || 'Billing record not found'}</div>
        <Link to="/app/invoices" className="text-brand-400 underline text-sm">
          &larr; Back to Invoices
        </Link>
      </div>
    );
  }

  const { quotation, oneTimeCharges, recurringCharges, subscriptions, invoices } = summary;

  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const totalPaid = invoices.reduce(
    (sum, inv) => sum + inv.payments.reduce((pSum, p) => pSum + Number(p.amount), 0),
    0,
  );
  const balanceDue = Math.max(0, totalInvoiced - totalPaid);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/app/invoices" className="text-gray-400 hover:text-white transition text-sm">
              &larr; Invoices
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Billing Hub: {quotation.quoteNumber}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
              {quotation.status}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Customer: <strong className="text-white">{quotation.customer?.name}</strong> &bull; Total Deal Value:{' '}
            <strong className="text-emerald-400 font-mono">
              ${Number(quotation.grandTotal).toFixed(2)} {quotation.currencyCode}
            </strong>
          </p>
        </div>

        {(user?.role === 'ADMIN' || user?.role === 'FINANCE_OPS') && (
          <button
            onClick={handleGenerateFromFulfillment}
            disabled={generating}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
          >
            <span>📄</span> {generating ? 'Generating...' : 'Generate Invoice from Shipment'}
          </button>
        )}
      </div>

      {/* Financial Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Invoiced</p>
          <p className="text-2xl font-bold text-white mt-1 font-mono">${totalInvoiced.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Payments Collected</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">${totalPaid.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Outstanding Balance</p>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">${balanceDue.toFixed(2)}</p>
        </div>
      </div>

      {/* One-Time Charges Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">One-Time Equipment & Setup Charges</h2>
          <span className="text-xs text-gray-400">§6.38 Billed upon shipment delivery</span>
        </div>

        {oneTimeCharges.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-2">No one-time charges on this quotation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Qty</th>
                  <th className="px-4 py-2.5">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {oneTimeCharges.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 text-white font-medium">{line.product.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-400 text-xs">{line.product.sku}</td>
                    <td className="px-4 py-3 font-mono">{Number(line.quantity)}</td>
                    <td className="px-4 py-3 font-mono">${Number(line.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-white text-right">
                      ${Number(line.lineTotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recurring Subscriptions Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Recurring Subscription Contracts</h2>
          <span className="text-xs text-gray-400">§6.34 Billed on recurring schedule</span>
        </div>

        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-2">No active subscriptions configured for this quotation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-2.5">Subscription Plan</th>
                  <th className="px-4 py-2.5">Interval</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Units</th>
                  <th className="px-4 py-2.5">Period Amount</th>
                  <th className="px-4 py-2.5">Next Billing Date</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="px-4 py-3 text-white font-medium">{sub.product.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{sub.billingInterval}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{Number(sub.quantity)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                      ${(Number(sub.unitPrice) * Number(sub.quantity)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-amber-400">
                      {new Date(sub.nextBillingDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/app/subscriptions/${sub.id}`}
                        className="text-brand-400 hover:text-brand-300 text-xs underline"
                      >
                        Manage &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-white">Invoices Generated</h2>

        {invoices.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-2">No invoices generated for this quotation yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-2.5">Invoice #</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Due Date</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-mono font-medium text-white">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-mono font-bold text-white">${Number(inv.totalAmount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/app/invoices/${inv.id}`}
                        className="text-brand-400 hover:text-brand-300 text-xs underline"
                      >
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
