/**
 * QuotationListPage — Quotations list with filtering and creation modal (Lane A)
 *
 * UI/UX Upgrade — component library integration:
 * - StatusBadge/RiskBadge semantic helpers (no duplicated badge logic)
 * - Table, TableHeader, TableBody, TableRow, TableHead, TableCell primitives
 * - Modal + Select + Button components
 * - Tabs component for filter tabs
 * - SkeletonTable for loading state (no centered spinner)
 * - EmptyState for zero results
 * - AlertBanner for errors
 *
 * Spec refs: §7.4, §6.6, §3.8
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { StatusBadge, RiskBadge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PageHeader } from '../../components/ui/PageHeader';

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

const FILTER_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'PENDING_APPROVAL', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'REJECTED', label: 'Rejected' },
];

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

      if (!res.ok) throw new Error('Failed to load quotations');

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

  const filteredQuotations = quotations.filter((q) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      q.quoteNumber.toLowerCase().includes(query) ||
      (q.customer?.name && q.customer.name.toLowerCase().includes(query)) ||
      (q.salesRep && `${q.salesRep.firstName} ${q.salesRep.lastName}`.toLowerCase().includes(query))
    );
  });

  const tabsWithCounts = FILTER_TABS.map((tab) => ({
    ...tab,
    count: tab.id === 'ALL'
      ? quotations.length
      : quotations.filter(q => q.status === tab.id).length,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Quotations"
        description="Manage, calculate, and govern commercial deal quotes"
        actions={
          user?.role === 'SALES_REP' && (
            <Button
              id="new-quotation-btn"
              onClick={openCreateModal}
              leftIcon={<Plus size={14} />}
            >
              New Quotation
            </Button>
          )
        }
      />

      {/* Filter Tabs & Search Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <Tabs tabs={tabsWithCounts} active={statusFilter} onTabChange={setStatusFilter} />

        {/* Search */}
        <div className="relative w-full md:w-72 shrink-0">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search size={13} aria-hidden="true" />
          </span>
          <input
            type="search"
            id="quotation-search"
            placeholder="Search quote #, customer, rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            className="w-full bg-surface-card border border-surface-border rounded-2xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:border-brand-500 transition-all duration-150 shadow-card"
          />
        </div>
      </div>

      {/* Quotation Data Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : error ? (
        <AlertBanner variant="error" title="Failed to load quotations" message={error} live />
      ) : filteredQuotations.length === 0 ? (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card">
          <EmptyState
            icon={<FileSpreadsheet size={20} />}
            title="No quotations found"
            description="Try selecting a different status filter or clearing your search query."
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead numeric>Grand Total</TableHead>
                <TableHead numeric>Margin %</TableHead>
                <TableHead numeric>Updated</TableHead>
                <TableHead numeric> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations.map((quote) => (
                <TableRow
                  key={quote.id}
                  hoverable
                  onClick={() => navigate(`/app/quotations/${quote.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-100">{quote.quoteNumber}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-400">
                        v{quote.currentVersion}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{quote.customer?.name ?? '—'}</TableCell>
                  <TableCell muted>
                    {quote.salesRep ? `${quote.salesRep.firstName} ${quote.salesRep.lastName}` : '—'}
                  </TableCell>
                  <TableCell><StatusBadge status={quote.status} /></TableCell>
                  <TableCell><RiskBadge level={quote.riskLevel} /></TableCell>
                  <TableCell numeric mono>
                    {quote.currencyCode} ${Number(quote.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell numeric mono muted>
                    {Number(quote.marginPercent).toFixed(1)}%
                  </TableCell>
                  <TableCell numeric mono muted>
                    {new Date(quote.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell numeric>
                    <Link
                      to={`/app/quotations/${quote.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors duration-150"
                      aria-label={`View quotation ${quote.quoteNumber}`}
                    >
                      View <ChevronRight size={12} aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Quotation Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Commercial Quotation"
        description="Initialize a new deal contract in draft state"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              id="create-quote-submit"
              form="create-quote-form"
              type="submit"
              loading={creating}
            >
              Create Quote
            </Button>
          </>
        }
      >
        {createError && (
          <AlertBanner variant="error" message={createError} className="mb-4" />
        )}
        <form id="create-quote-form" onSubmit={handleCreateQuotation} className="space-y-4">
          <Select
            label="Account / Customer"
            id="modal-customer"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.discountTier ? `(${c.discountTier.name} Tier)` : ''}
              </option>
            ))}
          </Select>

          <Select
            label="Contract Currency"
            id="modal-currency"
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
          >
            <option value="USD">USD ($) — United States Dollar</option>
            <option value="EUR">EUR (€) — Euro</option>
            <option value="GBP">GBP (£) — British Pound</option>
          </Select>
        </form>
      </Modal>
    </div>
  );
}
