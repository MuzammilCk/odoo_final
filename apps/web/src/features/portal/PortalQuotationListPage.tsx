/**
 * PortalQuotationListPage — Customer Portal: My Quotations (Lane B)
 *
 * UI/UX Upgrade — component library integration:
 * - StatusBadge semantic helper
 * - Table primitives
 * - SkeletonTable loading state
 * - EmptyState for zero results
 * - AlertBanner for errors
 *
 * Spec ref: §8.21 — NEVER shows internal fields (margin, cost, risk, approval notes)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowUpRight, FileText, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertBanner } from '../../components/ui/AlertBanner';

interface PortalQuotationSummary {
  id: string;
  quote_number: string;
  status: string;
  grand_total: number;
  currency_code: string;
  created_at: string;
}

export default function PortalQuotationListPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<PortalQuotationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuotations = async () => {
      try {
        const res = await fetch('/api/v1/portal/quotations', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'Failed to load quotations');
        }

        const data = await res.json();
        setQuotations(data);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotations();
  }, [token]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">My Quotations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Welcome back, <span className="text-slate-200 font-medium">{user?.firstName}</span>.{' '}
            Review commercial offers, negotiate terms, and confirm orders.
          </p>
        </div>
        <div className="text-xs text-deal-300 bg-deal-500/10 border border-deal-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
          <ShieldCheck size={12} aria-hidden="true" />
          <span>Authorized Customer Portal</span>
        </div>
      </div>

      {error && <AlertBanner variant="error" message={error} live />}

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : quotations.length === 0 ? (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card">
          <EmptyState
            icon={<FileText size={20} />}
            title="No Quotations Available"
            description="There are currently no active or approved quotations available for your organization."
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-card border border-surface-border shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation Ref</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead numeric>Total Amount</TableHead>
                <TableHead numeric>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((quote) => (
                <TableRow
                  key={quote.id}
                  hoverable
                  onClick={() => navigate(`/portal/quotations/${quote.id}`)}
                >
                  <TableCell mono>
                    <span className="font-bold text-slate-100">{quote.quote_number}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={quote.status} />
                  </TableCell>
                  <TableCell mono muted>
                    {new Date(quote.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell numeric mono>
                    {quote.currency_code} ${quote.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell numeric>
                    <Link
                      to={`/portal/quotations/${quote.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors duration-150"
                      aria-label={`Review quotation ${quote.quote_number}`}
                    >
                      Review & Negotiate <ArrowUpRight size={12} aria-hidden="true" />
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
