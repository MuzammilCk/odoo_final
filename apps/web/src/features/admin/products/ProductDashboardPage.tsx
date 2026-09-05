import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';

interface Category {
  id: string;
  name: string;
  _count?: { products: number };
}

interface Product {
  id: string;
  sku: string;
  name: string;
  basePrice: number | string;
  unit: string;
  isActive: boolean;
  isSubscription: boolean;
  category?: { id: string; name: string };
  _count?: { variants: number; priceListEntries: number };
}

export default function ProductDashboardPage() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal for Add Product
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBasePrice, setFormBasePrice] = useState('100');
  const [formUnit, setFormUnit] = useState('UNIT');
  const [formIsSub, setFormIsSub] = useState(false);
  const [formSubInterval, setFormSubInterval] = useState('MONTHLY');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [catsRes, prodsRes] = await Promise.all([
        apiFetch<{ categories: Category[] }>('/categories', {}, token),
        apiFetch<{ products: Product[] }>(
          `/products?categoryId=${selectedCategory}&search=${encodeURIComponent(search)}`,
          {},
          token,
        ),
      ]);
      setCategories(catsRes.categories || []);
      setProducts(prodsRes.products || []);
      if (!formCategoryId && catsRes.categories?.length > 0) {
        setFormCategoryId(catsRes.categories[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token, selectedCategory, search]);

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch(
        '/products',
        {
          method: 'POST',
          body: JSON.stringify({
            sku: formSku,
            name: formName,
            categoryId: formCategoryId,
            basePrice: parseFloat(formBasePrice),
            unit: formUnit,
            isSubscription: formIsSub,
            recurringInterval: formIsSub ? formSubInterval : undefined,
          }),
        },
        token,
      );
      setIsModalOpen(false);
      setFormSku('');
      setFormName('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const subscriptionProducts = products.filter((p) => p.isSubscription).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Product Catalog</h1>
          <p className="text-sm text-gray-400 mt-1">Manage global product catalog, pricing, and variants</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-2 self-start sm:self-auto"
          >
            <span>+</span> Add Product
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Products</p>
          <p className="text-2xl font-bold text-white mt-1">{totalProducts}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active Catalog</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeProducts}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Subscription Capable</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{subscriptionProducts}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search products by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg pl-3 pr-4 py-2 outline-none focus:border-brand-500 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Products Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading catalog items...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No products found matching the criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-6 py-3.5">Product / SKU</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Base Price</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Variants</th>
                  <th className="px-6 py-3.5">Price Lists</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{p.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{p.sku}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300 bg-gray-800 px-2.5 py-1 rounded-md text-xs font-medium">
                        {p.category?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-emerald-400">
                      ${Number(p.basePrice).toFixed(2)}
                      <span className="text-xs text-gray-500 font-normal ml-1">/{p.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      {p.isSubscription ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Recurring
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
                          One-Time
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400">{p._count?.variants ?? 0}</td>
                    <td className="px-6 py-4 text-gray-400">{p._count?.priceListEntries ?? 0}</td>
                    <td className="px-6 py-4">
                      {p.isActive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                          Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/app/products/${p.id}`}
                        className="text-brand-400 hover:text-brand-300 font-medium text-xs transition underline"
                      >
                        Manage &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Create New Product</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">SKU</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HW-SRV-01"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Cloud License"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Base Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formBasePrice}
                    onChange={(e) => setFormBasePrice(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Unit of Measure</label>
                <input
                  type="text"
                  required
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={formIsSub}
                    onChange={(e) => setFormIsSub(e.target.checked)}
                    className="rounded bg-gray-800 border-gray-700 text-brand-500 focus:ring-0"
                  />
                  <span>Subscription / Recurring Billing</span>
                </label>
              </div>

              {formIsSub && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Billing Interval</label>
                  <select
                    value={formSubInterval}
                    onChange={(e) => setFormSubInterval(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
