/**
 * InvoiceListPage — Invoice Management (Lane C)
 *
 * UI/UX Upgrade:
 * - StatCards for KPI metrics (replacing plain gray divs)
 * - Table primitives with InvoiceStatusBadge
 * - Tabs-based filter replacing <select>
 * - SkeletonTable loading state
 * - EmptyState, AlertBanner, PageHeader
 *
 * Spec refs: §5.24 (invoice generation)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { DollarSign, XCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { InvoiceStatusBadge, Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { StatCard } from '../../components/ui/StatCard';
import { SkeletonTable, SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PageHeader } from '../../components/ui/PageHeader';

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

const FILTER_TABS = [
  { id: '', label: 'All' },
  { id: 'UNPAID', label: 'Unpaid' },
  { id: 'PARTIALLY_PAID', label: 'Partial' },
  { id: 'PAID', label: 'Paid' },
  { id: 'VOID', label: 'Void' },
];

export default function InvoiceListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
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
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load invoices');
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

  const tabsWithCounts = FILTER_TABS.map((tab) => ({
    ...tab,
    count: tab.id === ''
      ? invoices.length
      : invoices.filter(i => i.status === tab.id).length,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Invoices"
        description="Track one-time shipment invoices and recurring subscription billing events (§5.24)"
      />

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0,1,2].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Invoiced"
            value={`$${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            icon={<DollarSign size={14} />}
            accent="brand"
            footnote="Excluding voided invoices"
          />
          <StatCard
            title="Unpaid / Partially Paid"
            value={unpaidCount}
            icon={<XCircle size={14} />}
            accent="rose"
            footnote="Needs attention"
          />
          <StatCard
            title="Paid in Full"
            value={totalPaidCount}
            icon={<CheckCircle2 size={14} />}
            accent="deal"
            footnote={`of ${invoices.length} total`}
          />
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs tabs={tabsWithCounts} active={statusFilter} onTabChange={setStatusFilter} />

      {error && <AlertBanner variant="error" message={error} live />}

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card">
          <EmptyState title="No invoices found" description="Try changing the status filter above." />
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer / Quote</TableHead>
                <TableHead>Type</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead numeric> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} hoverable onClick={() => navigate(`/app/invoices/${inv.id}`)}>
                  <TableCell mono>
                    <span className="font-bold text-slate-100">{inv.invoiceNumber}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-slate-200 font-medium">{inv.quotation?.customer?.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{inv.quotation?.quoteNumber}</div>
                  </TableCell>
                  <TableCell>
                    {inv.subscriptionInstanceId ? (
                      <Badge variant="indigo">Recurring</Badge>
                    ) : (
                      <Badge variant="slate">One-Time</Badge>
                    )}
                  </TableCell>
                  <TableCell numeric mono>
                    ${Number(inv.totalAmount).toFixed(2)}{' '}
                    <span className="text-slate-500 font-normal">{inv.currencyCode}</span>
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell mono muted>
                    {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell numeric>
                    <Link
                      to={`/app/invoices/${inv.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors duration-150"
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
    </div>
  );
}
