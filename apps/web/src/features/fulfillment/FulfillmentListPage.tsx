/**
 * FulfillmentListPage — Warehouse Fulfillment Operations (Lane B)
 *
 * UI/UX Upgrade — component library integration:
 * - FulfillmentStateBadge semantic helper
 * - Table primitives
 * - Tabs component with filter counts
 * - SkeletonTable, EmptyState, AlertBanner, PageHeader
 *
 * Spec refs: §7.5, fulfillment module
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowUpRight, PackageCheck } from 'lucide-react';
import { FulfillmentStateBadge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PageHeader } from '../../components/ui/PageHeader';

interface FulfillmentSummary {
  id: string;
  quoteNumber: string;
  customerName: string;
  salesRepName: string;
  grandTotal: number;
  currencyCode: string;
  confirmedAt: string;
  allocationState: 'AWAITING_ALLOCATION' | 'PARTIAL_BACKORDER' | 'ALLOCATED';
  allocationsCount: number;
  backordersCount: number;
  totalAllocated: number;
  totalBackordered: number;
}

const FILTER_TABS = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'AWAITING', label: 'Awaiting' },
  { id: 'BACKORDER', label: 'Backorder' },
  { id: 'ALLOCATED', label: 'Allocated' },
];

export default function FulfillmentListPage() {
  const { token } = useAuth();
  const [quotations, setQuotations] = useState<FulfillmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'AWAITING' | 'BACKORDER' | 'ALLOCATED'>('ALL');

  useEffect(() => {
    const fetchFulfillmentList = async () => {
      try {
        const res = await fetch('/api/v1/internal/fulfillment/quotations', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'Failed to load fulfillment list');
        }

        const data = await res.json();
        setQuotations(data);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchFulfillmentList();
  }, [token]);

  const filtered = quotations.filter((q) => {
    if (filter === 'AWAITING') return q.allocationState === 'AWAITING_ALLOCATION';
    if (filter === 'BACKORDER') return q.allocationState === 'PARTIAL_BACKORDER' || q.backordersCount > 0;
    if (filter === 'ALLOCATED') return q.allocationState === 'ALLOCATED';
    return true;
  });

  const tabsWithCounts = FILTER_TABS.map((tab) => ({
    ...tab,
    count: tab.id === 'ALL'
      ? quotations.length
      : tab.id === 'AWAITING'
        ? quotations.filter(q => q.allocationState === 'AWAITING_ALLOCATION').length
        : tab.id === 'BACKORDER'
          ? quotations.filter(q => q.allocationState === 'PARTIAL_BACKORDER' || q.backordersCount > 0).length
          : quotations.filter(q => q.allocationState === 'ALLOCATED').length,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Warehouse Fulfillment Operations"
        description="Confirmed commercial deals ready for inventory allocation, multi-warehouse split resolution, and backorders."
      />

      <Tabs tabs={tabsWithCounts} active={filter} onTabChange={(id) => setFilter(id as typeof filter)} />

      {error && <AlertBanner variant="error" message={error} live />}

      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card">
          <EmptyState
            icon={<PackageCheck size={20} />}
            title="No Fulfillment Orders"
            description="There are currently no confirmed quotations matching this filter."
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation Ref</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confirmed Date</TableHead>
                <TableHead numeric>Order Value</TableHead>
                <TableHead numeric> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((quote) => (
                <TableRow key={quote.id} hoverable>
                  <TableCell mono>
                    <span className="font-bold text-slate-100">{quote.quoteNumber}</span>
                  </TableCell>
                  <TableCell>{quote.customerName}</TableCell>
                  <TableCell muted>{quote.salesRepName}</TableCell>
                  <TableCell>
                    <FulfillmentStateBadge state={quote.allocationState} />
                  </TableCell>
                  <TableCell mono muted>
                    {quote.confirmedAt ? new Date(quote.confirmedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell numeric mono>
                    {quote.currencyCode} ${quote.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell numeric>
                    <Link
                      to={`/app/fulfillment/${quote.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors duration-150"
                      aria-label={`Manage split for ${quote.quoteNumber}`}
                    >
                      Manage Split <ArrowUpRight size={12} aria-hidden="true" />
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
