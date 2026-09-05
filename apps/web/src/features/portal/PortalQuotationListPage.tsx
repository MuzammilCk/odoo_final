import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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

  const statusColors: Record<string, string> = {
    APPROVED: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    UNDER_NEGOTIATION: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    CONFIRMED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Quotations</h1>
          <p className="text-xs text-gray-400 mt-1">
            Welcome back, {user?.firstName}. Review commercial offers, negotiate terms, and confirm agreements.
          </p>
        </div>
        <div className="text-xs text-gray-500 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg self-start sm:self-auto">
          Authorized Customer Account
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800 p-4 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center space-y-3">
          <div className="text-4xl">📄</div>
          <h3 className="text-base font-semibold text-white">No Quotations Available</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            There are currently no active or approved quotations available for your organization.
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/60 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Quotation Ref</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Issued Date</th>
                  <th className="px-6 py-3.5 text-right">Total Amount</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {quotations.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-6 py-4 font-semibold text-white font-mono">
                      {quote.quote_number}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          statusColors[quote.status] ?? 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {quote.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-white">
                      {quote.currency_code} ${quote.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/portal/quotations/${quote.id}`}
                        className="bg-brand-600 hover:bg-brand-500 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs transition inline-flex items-center gap-1 shadow-md shadow-brand-600/20"
                      >
                        View & Negotiate &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
