/**
 * ApprovalListPage — Governance Approval Queue (Lane A)
 *
 * UI/UX Upgrade — component library integration:
 * - Tabs component with count badges
 * - Table primitives with StatusBadge/RiskBadge semantic helpers
 * - SkeletonTable loading state
 * - EmptyState for zero results
 * - AlertBanner for errors
 * - PageHeader for consistent structure
 *
 * Spec refs: §6.12–6.18, §7.4, §8.21
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowUpRight } from 'lucide-react';
import { Badge, RiskBadge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PageHeader } from '../../components/ui/PageHeader';

interface ApprovalStep {
  id: string;
  sequenceNo: number;
  approvalLevel: string;
  status: string;
}

interface ApprovalRequestItem {
  id: string;
  quotationId: string;
  quotationVersion: number;
  status: string;
  riskScore: number | string;
  riskLevel: string;
  submittedAt: string;
  quotation?: {
    id: string;
    quoteNumber: string;
    grandTotal: number | string;
    customer?: {
      id: string;
      name: string;
      discountTier?: { id?: string; name: string; defaultDiscountCeiling?: number };
    };
    salesRep?: { id: string; firstName: string; lastName: string };
  };
  steps: ApprovalStep[];
}

const APPROVAL_STATUS_VARIANT: Record<string, { variant: 'amber' | 'deal' | 'rose' | 'blue' | 'default' }> = {
  PENDING:  { variant: 'amber' },
  APPROVED: { variant: 'deal' },
  REJECTED: { variant: 'rose' },
  RETURNED: { variant: 'blue' },
};

const FILTER_TABS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'RETURNED', label: 'Returned' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All' },
];

export default function ApprovalListPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');

  useEffect(() => {
    fetchApprovals();
  }, [token]);

  async function fetchApprovals() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/internal/approvals', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to load approval requests');

      const data = await res.json();
      setApprovals(data.approvalRequests || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filteredApprovals = approvals.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  const tabsWithCounts = FILTER_TABS.map((tab) => ({
    ...tab,
    count: tab.id === 'ALL'
      ? approvals.length
      : approvals.filter(a => a.status === tab.id).length,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Commercial Approvals"
        description={
          user?.role === 'SALES_REP'
            ? 'Track the approval status of your submitted quotations'
            : `Review and decide quotation discount exception requests as ${user?.role?.replace('_', ' ')}`
        }
      />

      <Tabs tabs={tabsWithCounts} active={statusFilter} onTabChange={setStatusFilter} />

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={5} cols={8} />
      ) : error ? (
        <AlertBanner variant="error" title="Failed to load approvals" message={error} live />
      ) : filteredApprovals.length === 0 ? (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card">
          <EmptyState
            title={`No "${statusFilter}" approval requests`}
            description="All quotation governance items are up to date."
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pending Step</TableHead>
                <TableHead numeric>Grand Total</TableHead>
                <TableHead numeric>Submitted</TableHead>
                <TableHead numeric> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApprovals.map((req) => {
                const pendingStep = req.steps.find((s) => s.status === 'PENDING');
                const statusConfig = APPROVAL_STATUS_VARIANT[req.status] ?? { variant: 'default' as const };

                return (
                  <TableRow
                    key={req.id}
                    hoverable
                    onClick={() => navigate(`/app/approvals/${req.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-100">
                          {req.quotation?.quoteNumber ?? '—'}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-400">
                          v{req.quotationVersion}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{req.quotation?.customer?.name ?? '—'}</span>
                        {req.quotation?.customer?.discountTier?.name && (
                          <Badge variant="amber" size="sm">
                            {req.quotation.customer.discountTier.name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={req.riskLevel} />
                    </TableCell>
                    <TableCell mono>
                      <span className="text-brand-400 font-semibold tabular-numbers">
                        {Number(req.riskScore).toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} dot>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pendingStep ? (
                        <Badge variant="amber">
                          Step {pendingStep.sequenceNo}: {pendingStep.approvalLevel}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-500">Completed</span>
                      )}
                    </TableCell>
                    <TableCell numeric mono>
                      ${Number(req.quotation?.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell numeric mono muted>
                      {new Date(req.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell numeric>
                      <Link
                        to={`/app/approvals/${req.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors duration-150"
                        aria-label={`Review approval for ${req.quotation?.quoteNumber}`}
                      >
                        Review <ArrowUpRight size={12} aria-hidden="true" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
