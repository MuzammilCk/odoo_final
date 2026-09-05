import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';

interface ProductVariant {
  id: string;
  attributeName: string;
  attributeValue: string;
  extraPrice: number | string;
  isActive: boolean;
}

interface PriceListEntry {
  id: string;
  discountTierId: string;
  discountTier: { id: string; name: string };
  currencyCode: string;
  price: number | string;
}

interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  description?: string;
  basePrice: number | string;
  unit: string;
  taxRate: number | string;
  isActive: boolean;
  isSubscription: boolean;
  recurringInterval?: string;
  category?: { id: string; name: string };
  variants: ProductVariant[];
  priceListEntries: PriceListEntry[];
}

interface DiscountTier {
  id: string;
  name: string;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [discountTiers, setDiscountTiers] = useState<DiscountTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit Product fields
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [description, setDescription] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Variant Modal
  const [isVarModalOpen, setIsVarModalOpen] = useState(false);
  const [varAttr, setVarAttr] = useState('RAM');
  const [varVal, setVarVal] = useState('16GB');
  const [varExtra, setVarExtra] = useState('0');

  // Price List Modal
  const [isPlModalOpen, setIsPlModalOpen] = useState(false);
  const [plTierId, setPlTierId] = useState('');
  const [plCurrency, setPlCurrency] = useState('USD');
  const [plPrice, setPlPrice] = useState('');

  async function loadProduct() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ product: ProductDetail }>(`/products/${id}`, {}, token);
      setProduct(res.product);
      setName(res.product.name);
      setBasePrice(String(res.product.basePrice));
      setDescription(res.product.description || '');
      setTaxRate(String(res.product.taxRate || '0'));
      setIsActive(res.product.isActive);

      // Load discount tiers for price list dropdown
      try {
        const tiersRes = await apiFetch<{ discountTiers: DiscountTier[] }>('/config/discount-tiers', {}, token).catch(() => ({ discountTiers: [] }));
        if (tiersRes.discountTiers?.length) {
          setDiscountTiers(tiersRes.discountTiers);
          setPlTierId(tiersRes.discountTiers[0].id);
        }
      } catch {
        // Fallback default tiers
        setDiscountTiers([
          { id: '1', name: 'Standard' },
          { id: '2', name: 'Gold' },
          { id: '3', name: 'Enterprise' },
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProduct();
  }, [id, token]);

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !id) return;
    setSaving(true);
    try {
      await apiFetch(
        `/products/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            basePrice: parseFloat(basePrice),
            description,
            taxRate: parseFloat(taxRate),
            isActive,
          }),
        },
        token,
      );
      alert('Product saved successfully');
      loadProduct();
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      await apiFetch(
        `/products/${id}/variants`,
        {
          method: 'POST',
          body: JSON.stringify({
            attributeName: varAttr,
            attributeValue: varVal,
            extraPrice: parseFloat(varExtra),
          }),
        },
        token,
      );
      setIsVarModalOpen(false);
      setVarAttr('');
      setVarVal('');
      setVarExtra('0');
      loadProduct();
    } catch (err: any) {
      alert(err.message || 'Failed to add variant');
    }
  }

  async function handleDeactivateVariant(vid: string) {
    if (!id || !confirm('Deactivate this variant?')) return;
    try {
      await apiFetch(`/products/${id}/variants/${vid}`, { method: 'DELETE' }, token);
      loadProduct();
    } catch (err: any) {
      alert(err.message || 'Failed to remove variant');
    }
  }

  async function handleAddPriceList(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      await apiFetch(
        '/price-lists',
        {
          method: 'POST',
          body: JSON.stringify({
            productId: id,
            discountTierId: plTierId,
            currencyCode: plCurrency,
            price: parseFloat(plPrice),
          }),
        },
        token,
      );
      setIsPlModalOpen(false);
      setPlPrice('');
      loadProduct();
    } catch (err: any) {
      alert(err.message || 'Failed to add price list entry');
    }
  }

  async function handleDeletePriceList(pleId: string) {
    if (!confirm('Remove this tier pricing override?')) return;
    try {
      await apiFetch(`/price-lists/${pleId}`, { method: 'DELETE' }, token);
      loadProduct();
    } catch (err: any) {
      alert(err.message || 'Failed to delete price list entry');
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-gray-500">Loading product details...</div>;
  }

  if (error || !product) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="text-red-400 font-medium">{error || 'Product not found'}</div>
        <Link to="/app/products" className="text-brand-400 underline text-sm">
          &larr; Back to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/products" className="text-gray-400 hover:text-white transition text-sm">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">{product.name}</h1>
          <span className="font-mono text-xs px-2.5 py-1 bg-gray-800 text-gray-400 rounded-md">
            {product.sku}
          </span>
          {product.isSubscription && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
              Recurring ({product.recurringInterval})
            </span>
          )}
        </div>
      </div>

      {/* General Settings Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-white mb-4">Product Details</h2>
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Product Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Base Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                disabled={!isAdmin}
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-brand-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                disabled={!isAdmin}
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-brand-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              rows={3}
              disabled={!isAdmin}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded bg-gray-800 border-gray-700 text-brand-500"
              />
              <span>Catalog Active</span>
            </label>

            {isAdmin && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Product Variants Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Product Variants</h2>
            <p className="text-xs text-gray-400">Configure size, color, memory, or specification adjustments</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsVarModalOpen(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-medium transition"
            >
              + Add Variant
            </button>
          )}
        </div>

        {product.variants.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 italic">No variants configured for this product.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-3">Attribute</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Price Adjustment</th>
                  <th className="px-4 py-3">Effective Base Price</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {product.variants.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 text-white font-medium">{v.attributeName}</td>
                    <td className="px-4 py-3 font-mono">{v.attributeValue}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400">
                      +${Number(v.extraPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-white">
                      ${(Number(product.basePrice) + Number(v.extraPrice)).toFixed(2)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeactivateVariant(v.id)}
                          className="text-red-400 hover:text-red-300 text-xs transition"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Price List Entries Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Price List Tier Overrides</h2>
            <p className="text-xs text-gray-400">Customer tier and currency-specific pricing overrides (§6.8)</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsPlModalOpen(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-medium transition"
            >
              + Add Tier Override
            </button>
          )}
        </div>

        {product.priceListEntries.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 italic">No tier-specific price overrides configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-xs uppercase font-medium text-gray-400">
                <tr>
                  <th className="px-4 py-3">Discount Tier</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Override Unit Price</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {product.priceListEntries.map((ple) => (
                  <tr key={ple.id}>
                    <td className="px-4 py-3">
                      <span className="bg-gray-800 text-amber-300 px-2.5 py-1 rounded text-xs font-medium">
                        {ple.discountTier?.name || 'Tier'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">{ple.currencyCode}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                      ${Number(ple.price).toFixed(2)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeletePriceList(ple.id)}
                          className="text-red-400 hover:text-red-300 text-xs transition"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Variant Modal */}
      {isVarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Add Variant</h3>
            <form onSubmit={handleAddVariant} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Attribute Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Memory, Color"
                  value={varAttr}
                  onChange={(e) => setVarAttr(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Attribute Value</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 32GB, Space Gray"
                  value={varVal}
                  onChange={(e) => setVarVal(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Extra Price Adjustment ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={varExtra}
                  onChange={(e) => setVarExtra(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsVarModalOpen(false)}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium"
                >
                  Save Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Price List Override Modal */}
      {isPlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Add Price List Override</h3>
            <form onSubmit={handleAddPriceList} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Discount Tier</label>
                <select
                  value={plTierId}
                  onChange={(e) => setPlTierId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {discountTiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Currency Code</label>
                <input
                  type="text"
                  maxLength={3}
                  required
                  value={plCurrency}
                  onChange={(e) => setPlCurrency(e.target.value.toUpperCase())}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Override Unit Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={plPrice}
                  onChange={(e) => setPlPrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPlModalOpen(false)}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
