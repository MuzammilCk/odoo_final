import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  currencyCode: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  subtotal: number | string;
  taxTotal: number | string;
  totalAmount: number | string;
  subscriptionInstanceId?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  quotation: {
    quoteNumber: string;
    customer: { id: string; name: string };
  };
}

export default function InvoiceListPage() {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter ? `/invoices?status=${statusFilter}` : '/invoices';
      const res = await apiFetch<{ invoices: InvoiceListItem[] }>(url, {}, token);
      setInvoices(res.invoices || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, [token, statusFilter]);

  const totalInvoiced = invoices
    .filter((i) => i.status !== 'VOID')
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalPaidCount = invoices.filter((i) => i.status === 'PAID').length;
  const unpaidCount = invoices.filter((i) => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Invoices</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track one-time shipment invoices and recurring subscription billing events (§5.24)
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Invoiced</p>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Unpaid / Partially Paid</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{unpaidCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Paid in Full</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{totalPaidCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500"
        >
          <option value="">All Statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="VOID">Void</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-6 py-3.5">Invoice #</th>
                  <th className="px-6 py-3.5">Customer / Quote</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Due Date</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4 font-mono font-medium text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{inv.quotation?.customer?.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{inv.quotation?.quoteNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      {inv.subscriptionInstanceId ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800">
                          Recurring
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
                          One-Time
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      ${Number(inv.totalAmount).toFixed(2)}{' '}
                      <span className="text-xs font-normal text-gray-500">{inv.currencyCode}</span>
                    </td>
                    <td className="px-6 py-4">
                      {inv.status === 'PAID' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Paid
                        </span>
                      ) : inv.status === 'PARTIALLY_PAID' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">
                          Partially Paid
                        </span>
                      ) : inv.status === 'VOID' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400">
                          Void
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-950 text-red-300 border border-red-800">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/app/invoices/${inv.id}`}
                        className="text-brand-400 hover:text-brand-300 font-medium text-xs underline"
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
