/**
 * ReportingPage — Executive Sales Operations Analytics & Lifecycle Governance
 *
 * Implements the DealFlow360 Reporting & Export module:
 * Sales Activity → Approval Bottlenecks → Discount Behaviour → Fulfillment Outcomes → Billing/Payment Performance
 *
 * Spec refs: §A7 (Reporting & Dashboard Configuration: Export options: PDF / XLS),
 *            UC-21–22, Excalidraw Screen 15
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import {
  DollarSign,
  FileText,
  Percent,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  RotateCcw,
  Truck,
  CreditCard,
  Layers,
  Users,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { StatusBadge, RiskBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PageHeader } from '../../components/ui/PageHeader';

interface FilterOptions {
  salesReps: { id: string; name: string; email: string; role: string }[];
  categories: { id: string; name: string }[];
  products: { id: string; name: string; sku: string; categoryId: string }[];
  approvalStatuses: { id: string; label: string }[];
}

interface OperationsReport {
  filters: {
    periodPreset: string;
    startDate: string | null;
    endDate: string | null;
    salesRepId: string;
    approvalStatus: string;
    categoryId: string;
    productId: string;
  };
  kpis: {
    totalQuotations: number;
    pipelineValue: number;
    confirmedValue: number;
    avgMarginPct: number;
    avgDealSize: number;
    totalDiscounts: number;
    pendingApprovalsCount: number;
    totalInvoiced: number;
    totalPaid: number;
    totalCreditNotes: number;
    outstandingBalance: number;
  };
  salesRepPerformance: {
    repId: string;
    repName: string;
    email: string;
    totalQuotes: number;
    confirmedQuotes: number;
    pipelineRevenue: number;
    confirmedRevenue: number;
    winRate: number;
    avgDiscountPct: number;
  }[];
  pipelineStages: {
    status: string;
    label: string;
    count: number;
    totalValue: number;
    percentage: number;
  }[];
  approvalGovernance: {
    totalApprovalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    pendingRequests: number;
    managerSteps: number;
    financeSteps: number;
    avgTurnaroundHours: number;
    bottlenecks: {
      quoteNumber: string;
      customerName: string;
      riskScore: number;
      riskLevel: string;
      submittedAt: string;
      waitingHours: number;
      requiredLevel: string;
    }[];
  };
  discountAnalysis: {
    totalDiscountAmount: number;
    avgDiscountPercent: number;
    riskLevelsCount: Record<string, number>;
    avgRiskScore: number;
    highestDiscountQuotes: {
      quoteNumber: string;
      customerName: string;
      grandTotal: number;
      discountTotal: number;
      discountPercent: number;
      riskScore: number;
      riskLevel: string;
    }[];
  };
  productPerformance: {
    topProducts: {
      productId: string;
      name: string;
      sku: string;
      category: string;
      quantitySold: number;
      revenue: number;
      avgDiscountPct: number;
      ordersCount: number;
    }[];
    categoryBreakdown: {
      category: string;
      revenue: number;
      quantity: number;
      avgDiscountPct: number;
      lineCount: number;
    }[];
    hybridSplit: {
      oneTimeRevenue: number;
      recurringRevenue: number;
    };
  };
  fulfillmentSummary: {
    totalAllocations: number;
    totalAllocatedQty: number;
    totalFulfilledQty: number;
    totalBackorderedQty: number;
    totalShippingCost: number;
    warehouseBreakdown: {
      warehouseName: string;
      quantityAllocated: number;
      quantityFulfilled: number;
      shippingCost: number;
      allocationsCount: number;
    }[];
  };
  billingSummary: {
    oneTimeBilled: number;
    recurringBilled: number;
    totalInvoiced: number;
    totalPaid: number;
    totalCreditNotes: number;
    outstandingBalance: number;
  };
  dealHealthSummary: {
    stalledCount: number;
    anomalyCount: number;
    slippageCount: number;
    totalOpenExceptions: number;
    activeExceptions: {
      id: string;
      quoteNumber: string;
      customerName: string;
      type: string;
      severity: string;
      createdAt: string;
    }[];
  };
}

const REPORT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales Reps' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'discounts', label: 'Discounts & Risk' },
  { id: 'products', label: 'Products & Mix' },
  { id: 'fulfillment', label: 'Fulfillment' },
  { id: 'billing', label: 'Billing & A/R' },
  { id: 'health', label: 'Deal Health' },
];

function formatMoney(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportingPage() {
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [report, setReport] = useState<OperationsReport | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mandatory Filter State
  const [periodPreset, setPeriodPreset] = useState<'all' | 'today' | 'week' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesRepId, setSalesRepId] = useState('ALL');
  const [approvalStatus, setApprovalStatus] = useState('ALL');
  const [categoryId, setCategoryId] = useState('ALL');
  const [productId, setProductId] = useState('ALL');

  // Load Filter Options
  useEffect(() => {
    async function loadOptions() {
      try {
        const opts = await apiFetch<FilterOptions>('/reports/filter-options', {}, token);
        setFilterOptions(opts);
      } catch (err) {
        console.warn('Failed to load filter options', err);
      }
    }
    if (token) loadOptions();
  }, [token]);

  // Load Report Data
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (periodPreset !== 'custom') {
        query.append('periodPreset', periodPreset);
      } else {
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
      }
      if (salesRepId !== 'ALL') query.append('salesRepId', salesRepId);
      if (approvalStatus !== 'ALL') query.append('approvalStatus', approvalStatus);
      if (categoryId !== 'ALL') query.append('categoryId', categoryId);
      if (productId !== 'ALL') query.append('productId', productId);

      const qStr = query.toString() ? `?${query.toString()}` : '';
      const data = await apiFetch<OperationsReport>(`/reports/operations-report${qStr}`, {}, token);
      setReport(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  }, [token, periodPreset, startDate, endDate, salesRepId, approvalStatus, categoryId, productId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Export handling
  const [exporting, setExporting] = useState<'pdf' | 'xls' | 'csv' | null>(null);

  async function handleExport(format: 'pdf' | 'xls' | 'csv') {
    setExporting(format);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.append('reportType', 'operations-report');
      query.append('format', format);
      if (periodPreset !== 'custom') {
        query.append('periodPreset', periodPreset);
      } else {
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
      }
      if (salesRepId !== 'ALL') query.append('salesRepId', salesRepId);
      if (approvalStatus !== 'ALL') query.append('approvalStatus', approvalStatus);
      if (categoryId !== 'ALL') query.append('categoryId', categoryId);
      if (productId !== 'ALL') query.append('productId', productId);

      const res = await fetch(`/api/v1/internal/reports/export?${query.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Export failed (${res.status}): ${res.statusText}`);
      }

      const blob = await res.blob();
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        xls: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
      };

      const ext = format === 'xls' ? 'xlsx' : format;
      const downloadUrl = window.URL.createObjectURL(new Blob([blob], { type: mimeTypes[format] || 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `dealflow360-sales-operations-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to export document');
    } finally {
      setExporting(null);
    }
  }

  function handleResetFilters() {
    setPeriodPreset('all');
    setStartDate('');
    setEndDate('');
    setSalesRepId('ALL');
    setApprovalStatus('ALL');
    setCategoryId('ALL');
    setProductId('ALL');
  }

  const hasActiveFilters =
    periodPreset !== 'all' ||
    salesRepId !== 'ALL' ||
    approvalStatus !== 'ALL' ||
    categoryId !== 'ALL' ||
    productId !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  const kpis = report?.kpis;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ── Page Header & Exports ────────────────────────────────────────── */}
      <PageHeader
        title="Sales Operations Intelligence & Reporting"
        description="End-to-end lifecycle analytics: Sales Activity > Approval Bottlenecks > Pricing Discipline > Fulfillment > Billing > Deal Health (§A7)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              id="export-pdf"
              variant="outline"
              size="sm"
              leftIcon={<Download size={13} />}
              loading={exporting === 'pdf'}
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
            >
              Export PDF
            </Button>
            <Button
              id="export-xls"
              variant="primary"
              size="sm"
              leftIcon={<Download size={13} />}
              loading={exporting === 'xls'}
              onClick={() => handleExport('xls')}
              disabled={exporting !== null}
            >
              Export XLS (6 Sheets)
            </Button>
            <Button
              id="export-csv"
              variant="ghost"
              size="sm"
              leftIcon={<Download size={13} />}
              loading={exporting === 'csv'}
              onClick={() => handleExport('csv')}
              disabled={exporting !== null}
            >
              CSV
            </Button>
          </div>
        }
      />

      {/* ── Filter Bar (Mandatory 4 Dimensions) ──────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Filter size={14} className="text-brand-400" />
              <span>Mandatory Lifecycle Filters</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                Reset all filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Period Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                1. Period
              </label>
              <div className="flex rounded-xl bg-surface-base p-1 border border-surface-border text-xs">
                {(['all', 'today', 'week', 'custom'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPeriodPreset(preset)}
                    className={`flex-1 py-1 text-center rounded-lg font-medium transition-colors capitalize ${
                      periodPreset === preset
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset === 'all' ? 'All Time' : preset === 'week' ? 'This Week' : preset}
                  </button>
                ))}
              </div>
              {periodPreset === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-1/2 bg-surface-base border border-surface-border text-slate-200 text-xs rounded-lg px-2 py-1"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-1/2 bg-surface-base border border-surface-border text-slate-200 text-xs rounded-lg px-2 py-1"
                  />
                </div>
              )}
            </div>

            {/* 2. Sales Team / Sales Rep Filter */}
            <div>
              <label htmlFor="filter-sales-rep" className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                2. Sales Team / Rep
              </label>
              <select
                id="filter-sales-rep"
                value={salesRepId}
                onChange={(e) => setSalesRepId(e.target.value)}
                className="w-full bg-surface-base border border-surface-border text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="ALL">All Representatives (Full Team)</option>
                {filterOptions?.salesReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Approval Status Filter */}
            <div>
              <label htmlFor="filter-approval-status" className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                3. Approval Status
              </label>
              <select
                id="filter-approval-status"
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value)}
                className="w-full bg-surface-base border border-surface-border text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CONFIRMED">Confirmed / Orders</option>
                <option value="UNDER_NEGOTIATION">Under Negotiation</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>

            {/* 4. Product / Category Filter */}
            <div>
              <label htmlFor="filter-category" className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                4. Product / Category
              </label>
              <div className="space-y-1.5">
                <select
                  id="filter-category"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setProductId('ALL');
                  }}
                  className="w-full bg-surface-base border border-surface-border text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="ALL">All Categories</option>
                  {filterOptions?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <AlertBanner variant="error" message={error} live onDismiss={() => setError(null)} />}

      {/* ── Executive Top Stat Cards ──────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Quotations"
            value={kpis.totalQuotations}
            footnote={`Pipeline: ${formatMoney(kpis.pipelineValue)}`}
            icon={<FileText size={18} />}
          />
          <StatCard
            title="Confirmed Orders"
            value={formatMoney(kpis.confirmedValue)}
            footnote="Converted revenue"
            icon={<DollarSign size={18} />}
          />
          <StatCard
            title="Avg Commercial Margin"
            value={`${kpis.avgMarginPct}%`}
            footnote="Target governance margin"
            icon={<Percent size={18} />}
          />
          <StatCard
            title="Pending Approvals"
            value={kpis.pendingApprovalsCount}
            footnote="Awaiting manager/finance review"
            icon={<Clock size={18} />}
          />
          <StatCard
            title="Outstanding A/R"
            value={formatMoney(kpis.outstandingBalance)}
            footnote={`Invoiced: ${formatMoney(kpis.totalInvoiced)}`}
            icon={<CreditCard size={18} />}
          />
        </div>
      ) : null}

      {/* ── Lifecycle Tabs Switcher ────────────────────────────────────────── */}
      <Tabs tabs={REPORT_TABS} active={activeTab} onTabChange={(id) => setActiveTab(id)} />

      {/* ── Tab Content Views ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers size={16} className="text-brand-400" />
                    Commercial Pipeline Stages
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Deals</TableHead>
                        <TableHead className="text-right">Pipeline Amount</TableHead>
                        <TableHead className="text-right">% Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.pipelineStages.map((s) => (
                        <TableRow key={s.status}>
                          <TableCell>
                            <StatusBadge status={s.status} />
                          </TableCell>
                          <TableCell className="text-right font-medium">{s.count}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-slate-200">
                            {formatMoney(s.totalValue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-400">{s.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Hybrid Billing Split */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard size={16} className="text-brand-400" />
                    Hybrid Revenue Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="p-4 rounded-xl bg-surface-base border border-surface-border space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">One-Time Equipment & Services</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {formatMoney(report.productPerformance.hybridSplit.oneTimeRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Recurring Cloud / Subscription MRR</span>
                      <span className="font-mono font-semibold text-deal-300">
                        {formatMoney(report.productPerformance.hybridSplit.recurringRevenue)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-surface-border flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-300">Total Pipeline Value</span>
                      <span className="font-mono text-brand-300">{formatMoney(kpis?.pipelineValue || 0)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-surface-base border border-surface-border">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                        Total Invoiced
                      </span>
                      <span className="font-mono font-bold text-sm text-slate-100">
                        {formatMoney(report.billingSummary.totalInvoiced)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-base border border-surface-border">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                        Collections Received
                      </span>
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        {formatMoney(report.billingSummary.totalPaid)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: SALES REPS */}
          {activeTab === 'sales' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users size={16} className="text-brand-400" />
                  Sales Representative Performance Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sales Representative</TableHead>
                      <TableHead className="text-right">Total Quotes</TableHead>
                      <TableHead className="text-right">Confirmed Orders</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                      <TableHead className="text-right">Avg Discount %</TableHead>
                      <TableHead className="text-right">Pipeline Revenue</TableHead>
                      <TableHead className="text-right">Confirmed Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.salesRepPerformance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                          No sales rep data found for this filter combination.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.salesRepPerformance.map((r) => (
                        <TableRow key={r.repId}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-slate-200">{r.repName}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{r.email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{r.totalQuotes}</TableCell>
                          <TableCell className="text-right font-medium">{r.confirmedQuotes}</TableCell>
                          <TableCell className="text-right font-mono text-deal-300 font-semibold">{r.winRate}%</TableCell>
                          <TableCell className="text-right font-mono text-slate-300">{r.avgDiscountPct}%</TableCell>
                          <TableCell className="text-right font-mono text-slate-300">
                            {formatMoney(r.pipelineRevenue)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-slate-100">
                            {formatMoney(r.confirmedRevenue)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Total Approval Requests"
                  value={report.approvalGovernance.totalApprovalRequests}
                  footnote={`Approved: ${report.approvalGovernance.approvedRequests} | Rejected: ${report.approvalGovernance.rejectedRequests}`}
                  icon={<ShieldCheck size={18} />}
                />
                <StatCard
                  title="Manager Review Steps"
                  value={report.approvalGovernance.managerSteps}
                  footnote="First level approval"
                  icon={<Users size={18} />}
                />
                <StatCard
                  title="Finance Review Steps"
                  value={report.approvalGovernance.financeSteps}
                  footnote="High risk discount gate"
                  icon={<CheckCircle2 size={18} />}
                />
                <StatCard
                  title="Avg Turnaround Time"
                  value={`${report.approvalGovernance.avgTurnaroundHours}h`}
                  footnote="Decision cycle speed"
                  icon={<Clock size={18} />}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock size={16} className="text-amber-400" />
                    Active Approval Bottlenecks Queue
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quote #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Risk Score</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Required Approval Gate</TableHead>
                        <TableHead className="text-right">Waiting Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.approvalGovernance.bottlenecks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                            No pending approval bottlenecks in the system.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.approvalGovernance.bottlenecks.map((b) => (
                          <TableRow key={b.quoteNumber}>
                            <TableCell className="font-mono font-medium text-brand-300">{b.quoteNumber}</TableCell>
                            <TableCell className="font-medium text-slate-200">{b.customerName}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-amber-300">{b.riskScore}</TableCell>
                            <TableCell>
                              <RiskBadge level={b.riskLevel} />
                            </TableCell>
                            <TableCell className="text-slate-300">{b.requiredLevel}</TableCell>
                            <TableCell className="text-right font-mono text-slate-400">{b.waitingHours} hours</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: DISCOUNTS & RISK */}
          {activeTab === 'discounts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  title="Total Discounts Given"
                  value={formatMoney(report.discountAnalysis.totalDiscountAmount)}
                  footnote="Cumulative margin concession"
                  icon={<DollarSign size={18} />}
                />
                <StatCard
                  title="Average Discount %"
                  value={`${report.discountAnalysis.avgDiscountPercent}%`}
                  footnote="Across all quotation lines"
                  icon={<Percent size={18} />}
                />
                <StatCard
                  title="Avg Blended Risk Score"
                  value={report.discountAnalysis.avgRiskScore}
                  footnote="Tier ceiling governance index"
                  icon={<ShieldCheck size={18} />}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-400" />
                    Deepest Discount Quotations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quote #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Grand Total</TableHead>
                        <TableHead className="text-right">Discount Total</TableHead>
                        <TableHead className="text-right">Discount %</TableHead>
                        <TableHead className="text-right">Risk Score</TableHead>
                        <TableHead>Risk Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.discountAnalysis.highestDiscountQuotes.map((q) => (
                        <TableRow key={q.quoteNumber}>
                          <TableCell className="font-mono font-semibold text-brand-300">{q.quoteNumber}</TableCell>
                          <TableCell className="font-medium text-slate-200">{q.customerName}</TableCell>
                          <TableCell className="text-right font-mono text-slate-300">{formatMoney(q.grandTotal)}</TableCell>
                          <TableCell className="text-right font-mono text-rose-300 font-semibold">
                            {formatMoney(q.discountTotal)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-rose-400">
                            {q.discountPercent}%
                          </TableCell>
                          <TableCell className="text-right font-mono">{q.riskScore}</TableCell>
                          <TableCell>
                            <RiskBadge level={q.riskLevel} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 5: PRODUCTS & CATALOG */}
          {activeTab === 'products' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package size={16} className="text-brand-400" />
                      Top 10 Products by Commercial Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Avg Disc %</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.productPerformance.topProducts.map((p) => (
                          <TableRow key={p.productId}>
                            <TableCell className="font-medium text-slate-200">{p.name}</TableCell>
                            <TableCell className="font-mono text-xs text-slate-400">{p.sku}</TableCell>
                            <TableCell className="text-xs text-slate-400">{p.category}</TableCell>
                            <TableCell className="text-right font-mono font-medium">{p.quantitySold}</TableCell>
                            <TableCell className="text-right font-mono text-slate-400">{p.avgDiscountPct}%</TableCell>
                            <TableCell className="text-right font-mono font-bold text-slate-100">
                              {formatMoney(p.revenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Layers size={16} className="text-brand-400" />
                      Revenue by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.productPerformance.categoryBreakdown.map((c) => (
                          <TableRow key={c.category}>
                            <TableCell className="font-medium text-slate-300">{c.category}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-brand-300">
                              {formatMoney(c.revenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 6: FULFILLMENT */}
          {activeTab === 'fulfillment' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Total Allocations"
                  value={report.fulfillmentSummary.totalAllocations}
                  footnote="Warehouse allocation events"
                  icon={<Truck size={18} />}
                />
                <StatCard
                  title="Fulfilled Quantity"
                  value={report.fulfillmentSummary.totalFulfilledQty}
                  footnote={`Allocated: ${report.fulfillmentSummary.totalAllocatedQty}`}
                  icon={<CheckCircle2 size={18} />}
                />
                <StatCard
                  title="Backordered Quantity"
                  value={report.fulfillmentSummary.totalBackorderedQty}
                  footnote="Pending restocking arrival"
                  icon={<AlertTriangle size={18} />}
                />
                <StatCard
                  title="Total Logistics Cost"
                  value={formatMoney(report.fulfillmentSummary.totalShippingCost)}
                  footnote="Recorded split shipment freight"
                  icon={<DollarSign size={18} />}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Truck size={16} className="text-brand-400" />
                    Multi-Warehouse Stock Splitting Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Allocations</TableHead>
                        <TableHead className="text-right">Quantity Allocated</TableHead>
                        <TableHead className="text-right">Quantity Fulfilled</TableHead>
                        <TableHead className="text-right">Shipping Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.fulfillmentSummary.warehouseBreakdown.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                            No warehouse fulfillment records logged for this period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.fulfillmentSummary.warehouseBreakdown.map((w) => (
                          <TableRow key={w.warehouseName}>
                            <TableCell className="font-semibold text-slate-200">{w.warehouseName}</TableCell>
                            <TableCell className="text-right font-medium">{w.allocationsCount}</TableCell>
                            <TableCell className="text-right font-mono text-slate-300">{w.quantityAllocated}</TableCell>
                            <TableCell className="text-right font-mono text-deal-300 font-semibold">
                              {w.quantityFulfilled}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-slate-100">
                              {formatMoney(w.shippingCost)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 7: BILLING */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Total Invoiced Amount"
                  value={formatMoney(report.billingSummary.totalInvoiced)}
                  footnote="Accounts Receivable billed"
                  icon={<FileText size={18} />}
                />
                <StatCard
                  title="Payments Collected"
                  value={formatMoney(report.billingSummary.totalPaid)}
                  footnote="Cash received"
                  icon={<CheckCircle2 size={18} />}
                />
                <StatCard
                  title="Credit Notes Issued"
                  value={formatMoney(report.billingSummary.totalCreditNotes)}
                  footnote="Adjustments & refunds"
                  icon={<AlertTriangle size={18} />}
                />
                <StatCard
                  title="Outstanding Balance Due"
                  value={formatMoney(report.billingSummary.outstandingBalance)}
                  footnote="Net uncollected receivables"
                  icon={<CreditCard size={18} />}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Hybrid Commercial Mix</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-surface-border text-xs">
                      <span className="text-slate-400">One-Time Equipment & Services</span>
                      <span className="font-mono font-bold text-slate-100">
                        {formatMoney(report.billingSummary.oneTimeBilled)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-surface-border text-xs">
                      <span className="text-slate-400">Recurring Subscription Plans (MRR)</span>
                      <span className="font-mono font-bold text-deal-300">
                        {formatMoney(report.billingSummary.recurringBilled)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Collection Health Ratio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-slate-400">
                      Collection Rate:{' '}
                      <span className="font-mono font-bold text-emerald-400">
                        {report.billingSummary.totalInvoiced > 0
                          ? Math.round(
                              (report.billingSummary.totalPaid / report.billingSummary.totalInvoiced) * 1000,
                            ) / 10
                          : 100}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-surface-base rounded-full h-3 overflow-hidden border border-surface-border">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            report.billingSummary.totalInvoiced > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (report.billingSummary.totalPaid / report.billingSummary.totalInvoiced) * 100,
                                  ),
                                )
                              : 100
                          }%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 8: DEAL HEALTH */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  title="Stalled Deals (>7d)"
                  value={report.dealHealthSummary.stalledCount}
                  footnote="Quotes lacking client activity"
                  icon={<Clock size={18} />}
                />
                <StatCard
                  title="Discount Anomalies"
                  value={report.dealHealthSummary.anomalyCount}
                  footnote="Deviations from rep historical avg"
                  icon={<AlertTriangle size={18} />}
                />
                <StatCard
                  title="Delivery Slippage"
                  value={report.dealHealthSummary.slippageCount}
                  footnote="Commitments requiring escalation"
                  icon={<Truck size={18} />}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400" />
                    Active Open Deal Health Exceptions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quote #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Anomaly Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Detected At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.dealHealthSummary.activeExceptions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                            No open Deal Health exceptions detected. All quotes within healthy governance thresholds.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.dealHealthSummary.activeExceptions.map((ex) => (
                          <TableRow key={ex.id}>
                            <TableCell className="font-mono font-medium text-brand-300">{ex.quoteNumber}</TableCell>
                            <TableCell className="font-medium text-slate-200">{ex.customerName}</TableCell>
                            <TableCell className="text-slate-300">{ex.type.replace(/_/g, ' ')}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ex.severity === 'HIGH'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {ex.severity}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-400 font-mono">
                              {new Date(ex.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
