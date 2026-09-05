import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

interface SalesPerformance {
  summary: {
    totalQuotations: number;
    totalRevenue: number;
    totalDiscounts: number;
    avgDealSize: number;
    avgMarginPct: number;
  };
  byStatus: { status: string; count: number; revenue: number }[];
  topReps: { repId: string; repName: string; count: number; revenue: number }[];
}

interface ProductPerformance {
  topProducts: {
    product: { id: string; name: string; sku: string };
    timesOrdered: number;
    totalQty: number;
    totalRevenue: number;
  }[];
  byCategory: { category: string; revenue: number }[];
}

interface ApprovalSummary {
  byStatus: { status: string; count: number }[];
  avgApprovalTimeHours: number;
  totalRequests: number;
}

export default function ReportingPage() {
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'approvals'>('sales');
  const [salesData, setSalesData] = useState<SalesPerformance | null>(null);
  const [productData, setProductData] = useState<ProductPerformance | null>(null);
  const [approvalData, setApprovalData] = useState<ApprovalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function loadReports() {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);
      const qStr = query.toString() ? `?${query.toString()}` : '';

      const [sales, prods, approvals] = await Promise.all([
        apiFetch<SalesPerformance>(`/reports/sales-performance${qStr}`, {}, token),
        apiFetch<ProductPerformance>(`/reports/product-performance${qStr}`, {}, token),
        apiFetch<ApprovalSummary>(`/reports/approval-summary${qStr}`, {}, token),
      ]);

      setSalesData(sales);
      setProductData(prods);
      setApprovalData(approvals);
    } catch (err: any) {
      setError(err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [token, startDate, endDate]);

  function handleExport(format: 'csv' | 'json') {
    const reportType =
      activeTab === 'products'
        ? 'product-performance'
        : activeTab === 'approvals'
        ? 'approval-summary'
        : 'sales-performance';

    const url = `/api/v1/internal/reports/export?reportType=${reportType}&format=${format}${
      startDate ? `&startDate=${startDate}` : ''
    }${endDate ? `&endDate=${endDate}` : ''}`;

    window.open(url, '_blank');
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>📊</span> Executive Analytics & Reporting
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time commercial aggregation across quotations, products, revenue, and approval velocity (§A7)
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            <span>📥</span> Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            <span>📥</span> Export JSON
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-500"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-gray-400 hover:text-white underline mt-4"
            >
              Reset
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800 mt-2 sm:mt-0">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              activeTab === 'sales' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Commercial & Sales
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              activeTab === 'products' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Product Breakdown
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              activeTab === 'approvals' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Approval Speed
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">Aggregating transactional records...</div>
      ) : activeTab === 'sales' && salesData ? (
        <div className="space-y-6">
          {/* Sales Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Pipeline Revenue</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                ${salesData.summary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Quotations</p>
              <p className="text-2xl font-bold text-white mt-1">{salesData.summary.totalQuotations}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Average Deal Size</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono">
                ${salesData.summary.avgDealSize.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Discounts Given</p>
              <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">
                ${salesData.summary.totalDiscounts.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-semibold text-white">Quotations by Commercial Status</h3>
              <div className="space-y-3">
                {salesData.byStatus.map((s) => (
                  <div key={s.status} className="flex justify-between items-center p-3 bg-gray-800/40 rounded-lg">
                    <span className="text-xs font-medium text-gray-200">{s.status}</span>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 mr-3">{s.count} deals</span>
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        ${s.revenue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Sales Reps */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-semibold text-white">Top Sales Performers</h3>
              <div className="space-y-3">
                {salesData.topReps.map((r, i) => (
                  <div key={r.repId} className="flex justify-between items-center p-3 bg-gray-800/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-gray-700 text-white text-[11px] flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-gray-200">{r.repName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 mr-3">{r.count} quotes</span>
                      <span className="font-mono text-sm font-bold text-white">
                        ${r.revenue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'products' && productData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Selling Products */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-white">Top Selling Products by Revenue</h3>
            <div className="space-y-3">
              {productData.topProducts.map((p) => (
                <div key={p.product.id} className="p-3 bg-gray-800/40 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-white">{p.product.name}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {p.product.sku} &bull; {p.totalQty} units sold
                    </p>
                  </div>
                  <p className="text-sm font-mono font-bold text-emerald-400">
                    ${p.totalRevenue.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue by Category */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-white">Revenue by Product Category</h3>
            <div className="space-y-3">
              {productData.byCategory.map((c) => (
                <div key={c.category} className="p-3 bg-gray-800/40 rounded-lg flex justify-between items-center">
                  <p className="text-sm font-medium text-white">{c.category}</p>
                  <p className="text-sm font-mono font-bold text-white">${c.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'approvals' && approvalData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Approval Requests</p>
              <p className="text-2xl font-bold text-white mt-1">{approvalData.totalRequests}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Average Turnaround Time</p>
              <p className="text-2xl font-bold text-blue-400 mt-1 font-mono">
                {approvalData.avgApprovalTimeHours} hrs
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending Decision</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {approvalData.byStatus.find((s) => s.status === 'PENDING')?.count || 0}
              </p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm space-y-3">
            <h3 className="text-base font-semibold text-white">Requests by Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {approvalData.byStatus.map((s) => (
                <div key={s.status} className="p-4 bg-gray-800/40 rounded-lg flex justify-between items-center">
                  <span className="text-sm text-gray-300 font-medium">{s.status}</span>
                  <span className="text-lg font-bold text-white font-mono">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
