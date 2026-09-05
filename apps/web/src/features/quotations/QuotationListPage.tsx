/**
 * QuotationListPage — Quotations list with filtering and creation modal (Lane A)
 * Upgraded with ui-ux-pro-max design system:
 * - Lucide SVG icons (Plus, Search, X, ChevronRight, Loader2)
 * - Non-wrapping quote numbers with monospace styling & version badges
 * - Tabular currency alignment
 * - Refined filter tabs and search input
 * - Premium modal with backdrop blur
 *
 * Spec refs: §7.4, §6.6, §3.8
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Search,
  X,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

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
  const { token, user } = useAuth();
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

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  const filteredQuotations = quotations.filter((q) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      q.quoteNumber.toLowerCase().includes(query) ||
      (q.customer?.name && q.customer.name.toLowerCase().includes(query)) ||
      (q.salesRep && `${q.salesRep.firstName} ${q.salesRep.lastName}`.toLowerCase().includes(query))
    );
  });

  const filterTabs = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'REJECTED'];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Quotations</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-surface-elevated text-slate-400 border border-surface-border">
              {filteredQuotations.length} items
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Manage, calculate, and govern commercial deal quotes</p>
        </div>
        {user?.role === 'SALES_REP' && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-600/25 transition duration-150 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Plus size={15} />
            <span>New Quotation</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Search Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-card border border-surface-border rounded-2xl p-2.5 shadow-card">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            );
          })}
        </div>

        {/* Search Input with Prefix Icon */}
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Search quote #, customer, rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-base border border-surface-border rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
          />
        </div>
      </div>

      {/* Quotation Data Table */}
      <div className="bg-surface-card border border-surface-border rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 size={28} className="text-brand-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-mono">Loading quotations telemetry...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 text-sm flex items-center justify-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <FileSpreadsheet size={32} className="text-slate-600 mx-auto" />
            <p className="text-slate-400 font-medium text-sm">No quotations found matching your criteria</p>
            <p className="text-slate-600 text-xs">Try selecting a different filter status or clearing your search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-base/80 border-b border-surface-border text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Quote #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Sales Rep</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Risk Level</th>
                  <th className="px-5 py-3.5 text-right">Grand Total</th>
                  <th className="px-5 py-3.5 text-right">Margin %</th>
                  <th className="px-5 py-3.5 text-right">Updated</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300 text-xs">
                {filteredQuotations.map((quote) => {
                  const badge = getStatusBadge(quote.status);
                  return (
                    <tr
                      key={quote.id}
                      onClick={() => navigate(`/app/quotations/${quote.id}`)}
                      className="hover:bg-surface-elevated/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-4 whitespace-nowrap min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white group-hover:text-brand-400 transition">
                            {quote.quoteNumber}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-400">
                            v{quote.currentVersion}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-100">
                        {quote.customer?.name ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {quote.salesRep ? `${quote.salesRep.firstName} ${quote.salesRep.lastName}` : '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{quote.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${getRiskBadge(quote.riskLevel)}`}>
                          {quote.riskLevel}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-semibold text-white tabular-numbers whitespace-nowrap">
                        {quote.currencyCode} ${Number(quote.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-slate-300 tabular-numbers">
                        {Number(quote.marginPercent).toFixed(1)}%
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-slate-400 font-mono whitespace-nowrap">
                        {new Date(quote.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Link
                          to={`/app/quotations/${quote.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2.5 py-1 rounded-lg hover:bg-surface-elevated transition"
                        >
                          <span>View</span>
                          <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Quotation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/80 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-border pb-3.5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Create Commercial Quotation</h3>
                <p className="text-xs text-slate-400 mt-0.5">Initialize a new deal contract in draft state</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-elevated transition cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {createError && (
              <div className="bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0 text-rose-400" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Account / Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-surface-base border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.discountTier ? `(${c.discountTier.name} Tier)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Contract Currency
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full bg-surface-base border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition"
                >
                  <option value="USD">USD ($) — United States Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-slate-700/80 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-600/25 transition duration-150 flex items-center gap-2 cursor-pointer"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
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
