/**
 * DiscountConfigPage — Governance & Commercial Rules Admin (Lane A)
 *
 * Spec refs: §5.10 (discount tiers), §5.11 (category ceilings),
 *            §6.9–6.16 (risk thresholds & governance rules), §7.4
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

interface DiscountTier {
  id: string;
  name: string;
  defaultDiscountCeiling: number | string;
  isActive: boolean;
  _count?: { customers: number };
}

interface Category {
  id: string;
  name: string;
}

interface CategoryDiscountRule {
  id: string;
  categoryId: string;
  maxDiscount: number | string;
  isActive: boolean;
  category?: { name: string };
}

interface ApprovalConfig {
  lowMaxScore: number;
  mediumMaxScore: number;
  mediumApproverRoles: string[];
  highApproverRoles: string[];
}

export default function DiscountConfigPage() {
  const { token, user } = useAuth();

  const [tiers, setTiers] = useState<DiscountTier[]>([]);
  const [rules, setRules] = useState<CategoryDiscountRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [approvalConfig, setApprovalConfig] = useState<ApprovalConfig>({
    lowMaxScore: 0,
    mediumMaxScore: 5,
    mediumApproverRoles: ['MANAGER'],
    highApproverRoles: ['MANAGER', 'FINANCE_OPS'],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal states
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [tierName, setTierName] = useState('');
  const [tierCeiling, setTierCeiling] = useState(10);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleCategoryId, setRuleCategoryId] = useState('');
  const [ruleMaxDiscount, setRuleMaxDiscount] = useState(15);

  useEffect(() => {
    if (token) {
      loadAllConfig();
    }
  }, [token]);

  async function loadAllConfig() {
    try {
      setLoading(true);
      const [tiersRes, rulesRes, catsRes, configRes] = await Promise.all([
        fetch('/api/v1/internal/discount-tiers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/internal/discount-rules', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/internal/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/internal/approval-config', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (tiersRes.ok) {
        const data = await tiersRes.json();
        setTiers(data.tiers || []);
      }
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      }
      if (catsRes.ok) {
        const data = await catsRes.json();
        setCategories(data.categories || []);
        if (data.categories?.length > 0) {
          setRuleCategoryId(data.categories[0].id);
        }
      }
      if (configRes.ok) {
        const data = await configRes.json();
        if (data.config) setApprovalConfig(data.config);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTier(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/internal/discount-tiers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tierName,
          defaultDiscountCeiling: Number(tierCeiling),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create tier');
      }

      setIsTierModalOpen(false);
      setTierName('');
      setFeedback('Discount tier created successfully');
      loadAllConfig();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  async function handleToggleTier(tier: DiscountTier) {
    try {
      const res = await fetch(`/api/v1/internal/discount-tiers/${tier.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !tier.isActive }),
      });
      if (res.ok) {
        setFeedback(`Tier ${tier.name} ${tier.isActive ? 'deactivated' : 'activated'}`);
        loadAllConfig();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpsertRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/internal/discount-rules', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: ruleCategoryId,
          maxDiscount: Number(ruleMaxDiscount),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save ceiling');
      }

      setIsRuleModalOpen(false);
      setFeedback('Category discount ceiling saved successfully');
      loadAllConfig();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  }

  async function handleToggleRule(rule: CategoryDiscountRule) {
    try {
      const res = await fetch(`/api/v1/internal/discount-rules/${rule.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (res.ok) {
        setFeedback(`Ceiling rule updated`);
        loadAllConfig();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveApprovalConfig(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/internal/approval-config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(approvalConfig),
      });
      if (res.ok) {
        setFeedback('Approval routing thresholds successfully saved');
      }
    } catch (err) {
      console.error(err);
    }
  }

  const isAdmin = user?.role === 'ADMIN';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-mono">Loading governance rules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-rose-950/30 border border-rose-800 text-rose-300 p-4 rounded-xl">
          <h3 className="font-semibold text-rose-200">Error loading policy</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Discount & Governance Policy
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure customer discount tiers, category ceilings, and risk routing boundaries
          </p>
        </div>
        {feedback && (
          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs px-4 py-2 rounded-lg">
            {feedback}
          </div>
        )}
      </div>

      {/* Grid: 2 Columns for Tiers and Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 1: Customer Discount Tiers (§5.10) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Customer Discount Tiers</h2>
              <p className="text-xs text-gray-400 mt-0.5">Tier-level default ceilings (§5.10)</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsTierModalOpen(true)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition"
              >
                + Add Tier
              </button>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/80 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Tier Name</th>
                  <th className="px-6 py-3 text-right">Default Ceiling</th>
                  <th className="px-6 py-3 text-center">Customers</th>
                  <th className="px-6 py-3 text-right">Status</th>
                  {isAdmin && <th className="px-6 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {tiers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-6 py-3.5 font-medium text-white">{t.name}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-brand-400">
                      {Number(t.defaultDiscountCeiling).toFixed(1)}%
                    </td>
                    <td className="px-6 py-3.5 text-center font-mono text-gray-400">
                      {t._count?.customers ?? 0}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          t.isActive
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                      >
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handleToggleTier(t)}
                          className="text-xs text-gray-400 hover:text-white underline"
                        >
                          {t.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Category Discount Ceilings (§5.11) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Category Ceilings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Product category ceilings (§5.11)</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsRuleModalOpen(true)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition"
              >
                + Set Ceiling
              </button>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950/80 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3 text-right">Max Allowed %</th>
                  <th className="px-6 py-3 text-right">Status</th>
                  {isAdmin && <th className="px-6 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-6 py-3.5 font-medium text-white">
                      {r.category?.name ?? 'Category'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-brand-400">
                      {Number(r.maxDiscount).toFixed(1)}%
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          r.isActive
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                      >
                        {r.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handleToggleRule(r)}
                          className="text-xs text-gray-400 hover:text-white underline"
                        >
                          {r.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 3: Risk Evaluation & Routing Boundaries (§6.14) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white">Risk Evaluation & Routing Engine (§6.14)</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Automatic governance state routing triggered by Contract 1 evaluateAndRoute()
          </p>
        </div>

        <form onSubmit={handleSaveApprovalConfig} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-950 border border-emerald-900/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>LOW Risk Rule</span>
            </div>
            <p className="text-xs text-gray-400">Score exactly equals 0 (no ceiling overage on any line item).</p>
            <div className="text-xs font-mono text-emerald-300/90 bg-emerald-950/30 p-2.5 rounded border border-emerald-800/50">
              Auto-approves quote immediately without human intervention.
            </div>
          </div>

          <div className="bg-gray-950 border border-amber-900/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>MEDIUM Risk Rule</span>
            </div>
            <p className="text-xs text-gray-400">Score &gt; 0 and &le; {approvalConfig.mediumMaxScore} pts.</p>
            <div className="space-y-2">
              <label className="block text-[11px] font-mono text-gray-400 uppercase">Max Score Threshold</label>
              <input
                type="number"
                disabled={!isAdmin}
                value={approvalConfig.mediumMaxScore}
                onChange={(e) =>
                  setApprovalConfig({ ...approvalConfig, mediumMaxScore: Number(e.target.value) })
                }
                className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="text-xs font-mono text-amber-300/90 bg-amber-950/30 p-2 rounded border border-amber-800/50">
              Requires 1 step: Commercial Manager Review.
            </div>
          </div>

          <div className="bg-gray-950 border border-rose-900/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>HIGH Risk Rule</span>
            </div>
            <p className="text-xs text-gray-400">Score &gt; {approvalConfig.mediumMaxScore} pts.</p>
            <div className="text-xs font-mono text-rose-300/90 bg-rose-950/30 p-2.5 rounded border border-rose-800/50 mt-6">
              Requires 2 steps: Step 1 Manager Review &rarr; Step 2 Finance Operations Review.
            </div>
          </div>

          {isAdmin && (
            <div className="md:col-span-3 flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg shadow-sm transition"
              >
                Save Policy Thresholds
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Add Tier Modal */}
      {isTierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">Add Customer Discount Tier</h3>
              <button onClick={() => setIsTierModalOpen(false)} className="text-gray-400 hover:text-white text-lg">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateTier} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase mb-1">Tier Name</label>
                <input
                  type="text"
                  required
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  placeholder="e.g. Platinum, Enterprise"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase mb-1">Default Ceiling %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={tierCeiling}
                  onChange={(e) => setTierCeiling(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsTierModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg"
                >
                  Create Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Ceiling Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">Set Category Discount Ceiling</h3>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-gray-400 hover:text-white text-lg">
                &times;
              </button>
            </div>
            <form onSubmit={handleUpsertRule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase mb-1">Category</label>
                <select
                  value={ruleCategoryId}
                  onChange={(e) => setRuleCategoryId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase mb-1">Max Allowed Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={ruleMaxDiscount}
                  onChange={(e) => setRuleMaxDiscount(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg"
                >
                  Save Ceiling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
