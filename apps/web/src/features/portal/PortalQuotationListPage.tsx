import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FileText, ArrowUpRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

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
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotations();
  }, [token]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          bg: 'bg-brand-500/10 text-brand-300 border-brand-500/25',
          dot: 'bg-brand-400',
        };
      case 'UNDER_NEGOTIATION':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
          dot: 'bg-amber-400',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-deal-500/10 text-deal-300 border-deal-500/25',
          dot: 'bg-deal-400',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500',
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Quotations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Welcome back, {user?.firstName}. Review commercial offers, negotiate terms, and confirm customer orders.
          </p>
        </div>
        <div className="text-xs text-slate-400 bg-surface-card border border-surface-border px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
          <ShieldCheck size={14} className="text-deal-400" />
          <span>Authorized Customer Portal</span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 p-4 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 size={32} className="text-brand-500 animate-spin" />
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-2xl p-12 text-center space-y-3 shadow-card">
          <FileText size={36} className="text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No Quotations Available</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are currently no active or approved quotations available for your organization.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-base/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-surface-border">
                <tr>
                  <th className="px-5 py-3.5">Quotation Ref</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Issued Date</th>
                  <th className="px-5 py-3.5 text-right">Total Amount</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300 text-xs">
                {quotations.map((quote) => {
                  const badge = getStatusBadge(quote.status);
                  return (
                    <tr key={quote.id} className="hover:bg-surface-elevated/40 transition">
                      <td className="px-5 py-4 font-bold text-white font-mono">
                        {quote.quote_number}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{quote.status.replace(/_/g, ' ')}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                        {new Date(quote.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-white font-mono tabular-numbers">
                        {quote.currency_code} ${quote.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Link
                          to={`/portal/quotations/${quote.id}`}
                          className="bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition inline-flex items-center gap-1 shadow-sm shadow-brand-600/25 cursor-pointer"
                        >
                          <span>Review & Negotiate</span>
                          <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
