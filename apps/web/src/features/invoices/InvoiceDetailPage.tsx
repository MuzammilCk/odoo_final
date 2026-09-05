import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

interface PaymentItem {
  id: string;
  amount: number | string;
  currencyCode: string;
  status: string;
  paymentReference: string;
  paidAt: string;
  createdByUser?: { firstName: string; lastName: string; email: string };
}

interface CreditNoteItem {
  id: string;
  creditNoteNumber: string;
  amount: number | string;
  currencyCode: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  quotationId: string;
  subscriptionInstanceId?: string | null;
  currencyCode: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  subtotal: number | string;
  taxTotal: number | string;
  totalAmount: number | string;
  amountPaid: number;
  balanceDue: number;
  issuedAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  quotation: {
    quoteNumber: string;
    customer: { id: string; name: string };
  };
  payments: PaymentItem[];
  creditNotes: CreditNoteItem[];
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Voiding
  const [voiding, setVoiding] = useState(false);

  async function loadInvoice() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ invoice: InvoiceDetail }>(`/invoices/${id}`, {}, token);
      setInvoice(res.invoice);
      setPayAmount(String(res.invoice.balanceDue));
      setPayRef(`PAY-${Date.now().toString().slice(-6)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
  }, [id, token]);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !invoice) return;
    setSubmittingPay(true);
    setPayError(null);
    try {
      await apiFetch(
        '/payments',
        {
          method: 'POST',
          body: JSON.stringify({
            invoiceId: id,
            amount: parseFloat(payAmount),
            currencyCode: invoice.currencyCode,
            paymentReference: payRef,
          }),
        },
        token,
      );
      setIsPayModalOpen(false);
      loadInvoice();
    } catch (err: any) {
      setPayError(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPay(false);
    }
  }

  async function handleReversePayment(paymentId: string) {
    if (!confirm('Reverse this payment? The invoice balance and status will revert.')) return;
    try {
      await apiFetch(`/payments/${paymentId}/reverse`, { method: 'POST' }, token);
      loadInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to reverse payment');
    }
  }

  async function handleVoidInvoice() {
    if (!id || !confirm('Are you sure you want to VOID this invoice?')) return;
    setVoiding(true);
    try {
      await apiFetch(`/invoices/${id}/void`, { method: 'POST' }, token);
      loadInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to void invoice');
    } finally {
      setVoiding(false);
    }
  }

  if (loading) return <div className="p-12 text-center text-gray-500">Loading invoice...</div>;
  if (error || !invoice) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="text-red-400">{error || 'Invoice not found'}</div>
        <Link to="/app/invoices" className="text-brand-400 underline text-sm">
          &larr; Back to Invoices
        </Link>
      </div>
    );
  }

  const canManageFinance = user?.role === 'ADMIN' || user?.role === 'FINANCE_OPS';

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/app/invoices" className="text-gray-400 hover:text-white transition text-sm">
              &larr; Invoices
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight font-mono">
              {invoice.invoiceNumber}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                invoice.status === 'PAID'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : invoice.status === 'PARTIALLY_PAID'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : invoice.status === 'VOID'
                  ? 'bg-gray-800 text-gray-400'
                  : 'bg-red-950 text-red-300 border border-red-800'
              }`}
            >
              {invoice.status}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Customer: <strong className="text-white">{invoice.quotation?.customer?.name}</strong> &bull; Quote:{' '}
            <Link to={`/app/billing/${invoice.quotationId}`} className="text-brand-400 underline">
              {invoice.quotation?.quoteNumber}
            </Link>
          </p>
        </div>

        {canManageFinance && invoice.status !== 'PAID' && invoice.status !== 'VOID' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPayModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition shadow-sm"
            >
              + Record Payment
            </button>
            <button
              onClick={handleVoidInvoice}
              disabled={voiding}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium border border-gray-700 transition"
            >
              {voiding ? 'Voiding...' : 'Void'}
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Invoiced</p>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            ${Number(invoice.totalAmount).toFixed(2)} {invoice.currencyCode}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Subtotal: ${Number(invoice.subtotal).toFixed(2)} | Tax: ${Number(invoice.taxTotal).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Paid</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
            ${Number(invoice.amountPaid).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">From {invoice.payments.length} payment records</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Balance Due</p>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">
            ${Number(invoice.balanceDue).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Due date: {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Payment History</h2>
            <p className="text-xs text-gray-400">All recorded transaction entries against this invoice (§6.39)</p>
          </div>
        </div>

        {invoice.payments.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-4">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Recorded At</th>
                  <th className="px-4 py-3">Recorded By</th>
                  {canManageFinance && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {invoice.payments.map((pmt) => (
                  <tr key={pmt.id}>
                    <td className="px-4 py-3 font-mono text-white">{pmt.paymentReference}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                      ${Number(pmt.amount).toFixed(2)} {pmt.currencyCode}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {new Date(pmt.paidAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {pmt.createdByUser ? `${pmt.createdByUser.firstName} ${pmt.createdByUser.lastName}` : 'System'}
                    </td>
                    {canManageFinance && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleReversePayment(pmt.id)}
                          className="text-red-400 hover:text-red-300 text-xs underline"
                        >
                          Reverse
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credit Notes Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-white">Credit Notes Linked</h2>
        {invoice.creditNotes.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-4">No credit notes applied to this invoice.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-3">Credit Note #</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {invoice.creditNotes.map((cn) => (
                  <tr key={cn.id}>
                    <td className="px-4 py-3 font-mono text-white">{cn.creditNoteNumber}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                      ${Number(cn.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{cn.reason}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">{cn.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {new Date(cn.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Record Payment</h3>
            <p className="text-xs text-gray-400">
              Balance remaining: <strong className="text-emerald-400 font-mono">${invoice.balanceDue.toFixed(2)}</strong>
            </p>

            {payError && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-xs">
                {payError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Payment Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  max={invoice.balanceDue}
                  min="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Payment Reference</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WIRE-89212 or CHK-4102"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submittingPay ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
