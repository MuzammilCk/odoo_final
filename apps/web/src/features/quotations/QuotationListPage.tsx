/**
 * QuotationListPage — Quotations list with filtering and creation modal (Lane A)
 *
 * Spec refs: §7.4, §6.6, §3.8
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface Customer {
  id: string;
  name: string;
  discountTier?: { name: string; defaultDiscountCeiling: number };
}

interface QuotationItem {
  id: string;
  quoteNumber: string;
  currentVersion: number;
  status: string;
  riskLevel: string;
  currencyCode: string;
  grandTotal: number | string;
  marginPercent: number | string;
  updatedAt: string;
  customer?: { id: string; name: string };
  salesRep?: { id: string; firstName: string; lastName: string };
}

export default function QuotationListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotations();
  }, [token, statusFilter]);

  async function fetchQuotations() {
    try {
      setLoading(true);
      const url =
        statusFilter === 'ALL'
          ? '/api/v1/internal/quotations'
          : `/api/v1/internal/quotations?status=${statusFilter}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load quotations');
      }

      const data = await res.json();
      setQuotations(data.quotations);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function openCreateModal() {
    setIsModalOpen(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/v1/internal/quotations/helpers/customers', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        if (data.customers.length > 0) {
          setSelectedCustomerId(data.customers[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  }

  async function handleCreateQuotation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) {
      setCreateError('Please select a customer');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      const res = await fetch('/api/v1/internal/quotations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          currencyCode: selectedCurrency,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create quotation');
      }

      const data = await res.json();
      setIsModalOpen(false);
      navigate(`/app/quotations/${data.quotation.id}`);
    } catch (err: unknown) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
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

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/60';
      case 'MEDIUM':
        return 'bg-amber-950/50 text-amber-400 border border-amber-800/60';
      case 'HIGH':
        return 'bg-rose-950/50 text-rose-400 border border-rose-800/60';
      default:
        return 'bg-gray-800 text-gray-400 border border-gray-700';
    }
  };

  const filteredQuotations = quotations.filter((q) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      q.quoteNumber.toLowerCase().includes(query) ||
      q.customer?.name.toLowerCase().includes(query) ||
      (q.salesRep && `${q.salesRep.firstName} ${q.salesRep.lastName}`.toLowerCase().includes(query))
    );
  });

  const filterTabs = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'REJECTED'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Quotations</h1>
          <p className="text-sm text-gray-400 mt-1">Manage, calculate, and govern commercial deal quotes</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg shadow-sm transition flex items-center gap-2 self-start sm:self-auto"
        >
          <span>+</span>
          <span>New Quotation</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search quote or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 transition"
          />
        </div>
      </div>

      {/* Quotation Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-mono">Loading quotations...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 text-sm">{error}</div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 font-mono text-sm">No quotations found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/80 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Quote #</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Sales Rep</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Risk Level</th>
                  <th className="px-6 py-3 text-right">Grand Total</th>
                  <th className="px-6 py-3 text-right">Margin %</th>
                  <th className="px-6 py-3 text-right">Updated</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {filteredQuotations.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4 font-mono font-medium text-white">
                      <Link to={`/app/quotations/${quote.id}`} className="hover:text-brand-400 transition">
                        {quote.quoteNumber} <span className="text-xs text-gray-500">v{quote.currentVersion}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4">{quote.customer?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {quote.salesRep ? `${quote.salesRep.firstName} ${quote.salesRep.lastName}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(quote.status)}`}>
                        {quote.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getRiskBadge(quote.riskLevel)}`}>
                        {quote.riskLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-white">
                      {quote.currencyCode} ${Number(quote.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-400">
                      {Number(quote.marginPercent).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500 font-mono">
                      {new Date(quote.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/app/quotations/${quote.id}`}
                        className="text-xs font-medium text-brand-400 hover:text-brand-300 transition"
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

      {/* New Quotation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">Create New Quotation</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {createError && (
              <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-xs p-3 rounded-lg">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                  Select Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.discountTier ? `(${c.discountTier.name} Tier)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                  Currency
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                >
                  {creating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Create Quote</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
