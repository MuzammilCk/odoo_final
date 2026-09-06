/**
 * ReportingService — Comprehensive Lifecycle Analytics for DealFlow360
 *
 * Provides real-time management visibility across:
 * Sales Activity → Approval Bottlenecks → Discount Behaviour → Fulfillment Outcomes → Billing/Payment Performance
 *
 * Spec refs: §A7 (reporting requirements), UC-21–22
 * 100% computed from live persisted PostgreSQL records via Prisma.
 */

import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  periodPreset?: 'today' | 'week' | 'custom' | 'all';
  salesRepId?: string;
  approvalStatus?: string; // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' or specific QuotationStatus
  categoryId?: string;
  productId?: string;
  status?: string; // backward compatibility
}

// ── Helper: Resolve Date Bounds ───────────────────────────────────────────────

export function resolveDateBounds(filters: ReportFilters): { start?: Date; end?: Date } {
  if (filters.periodPreset === 'today') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  if (filters.periodPreset === 'week') {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  return {
    start: filters.startDate ? new Date(filters.startDate) : undefined,
    end: filters.endDate ? new Date(filters.endDate) : undefined,
  };
}

// ── Helper: Build Quotation Where Clause ──────────────────────────────────────

function buildQuotationWhere(filters: ReportFilters): Prisma.QuotationWhereInput {
  const { start, end } = resolveDateBounds(filters);

  const where: Prisma.QuotationWhereInput = {
    ...(start && { createdAt: { gte: start } }),
    ...(end && { createdAt: { lte: end } }),
    ...(filters.salesRepId && filters.salesRepId !== 'ALL' && { salesRepId: filters.salesRepId }),
  };

  // Map approvalStatus filter
  if (filters.approvalStatus && filters.approvalStatus !== 'ALL') {
    if (filters.approvalStatus === 'PENDING') {
      where.status = 'PENDING_APPROVAL';
    } else if (filters.approvalStatus === 'APPROVED') {
      where.status = 'APPROVED';
    } else if (filters.approvalStatus === 'REJECTED') {
      where.status = 'REJECTED';
    } else if (['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'UNDER_NEGOTIATION', 'CONFIRMED', 'REJECTED'].includes(filters.approvalStatus)) {
      where.status = filters.approvalStatus as any;
    }
  } else if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status as any;
  }

  // Filter by Product or Category via QuotationLine relation
  if (filters.productId && filters.productId !== 'ALL') {
    where.lines = { some: { productId: filters.productId } };
  } else if (filters.categoryId && filters.categoryId !== 'ALL') {
    where.lines = { some: { product: { categoryId: filters.categoryId } } };
  }

  return where;
}

// ── 1. Filter Options (Sales Reps, Categories, Products) ──────────────────────

export async function getFilterOptions() {
  const [salesReps, categories, products] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['SALES_REP', 'MANAGER', 'ADMIN'] }, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, categoryId: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    salesReps: salesReps.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, categoryId: p.categoryId })),
    approvalStatuses: [
      { id: 'ALL', label: 'All Statuses' },
      { id: 'PENDING', label: 'Pending Approval' },
      { id: 'APPROVED', label: 'Approved' },
      { id: 'REJECTED', label: 'Rejected' },
      { id: 'CONFIRMED', label: 'Confirmed / Orders' },
      { id: 'UNDER_NEGOTIATION', label: 'Under Negotiation' },
      { id: 'DRAFT', label: 'Draft' },
    ],
  };
}

// ── 2. Full Sales Operations Lifecycle Report ─────────────────────────────────

export async function getSalesOperationsReport(filters: ReportFilters = {}) {
  const where = buildQuotationWhere(filters);
  const { start, end } = resolveDateBounds(filters);

  // 1. Fetch matching quotations with deep relations
  const quotations = await prisma.quotation.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      salesRep: { select: { id: true, firstName: true, lastName: true, email: true } },
      lines: {
        include: {
          product: { select: { id: true, name: true, sku: true, categoryId: true, isSubscription: true, category: { select: { name: true } } } },
        },
      },
      approvalRequests: {
        include: {
          steps: { select: { id: true, sequenceNo: true, approvalLevel: true, status: true, decisionReason: true, actedAt: true, createdAt: true } },
        },
      },
      fulfillmentAllocations: {
        include: {
          warehouse: { select: { id: true, name: true } },
        },
      },
      invoices: {
        include: {
          payments: true,
          creditNotes: true,
        },
      },
      dealHealthFlags: {
        where: { status: 'OPEN' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Executive KPIs Calculation
  const totalQuotations = quotations.length;
  let pipelineValue = 0;
  let confirmedValue = 0;
  let totalDiscounts = 0;
  let marginSum = 0;
  let pendingApprovalsCount = 0;

  quotations.forEach((q) => {
    const grand = Number(q.grandTotal);
    const disc = Number(q.discountTotal);
    pipelineValue += grand;
    totalDiscounts += disc;
    marginSum += Number(q.marginPercent);

    if (q.status === 'CONFIRMED') {
      confirmedValue += grand;
    }
    if (q.status === 'PENDING_APPROVAL') {
      pendingApprovalsCount++;
    }
  });

  const avgMarginPct = totalQuotations > 0 ? Math.round((marginSum / totalQuotations) * 100) / 100 : 0;
  const avgDealSize = totalQuotations > 0 ? Math.round((pipelineValue / totalQuotations) * 100) / 100 : 0;

  // 3. Billing & Payments Aggregation across matching quotations
  let oneTimeBilled = 0;
  let recurringBilled = 0;
  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalCreditNotes = 0;

  quotations.forEach((q) => {
    // Check lines for one-time vs subscription
    q.lines.forEach((l) => {
      if (l.product.isSubscription) {
        recurringBilled += Number(l.lineTotal);
      } else {
        oneTimeBilled += Number(l.lineTotal);
      }
    });

    // Invoices and payments
    q.invoices.forEach((inv) => {
      totalInvoiced += Number(inv.totalAmount);
      inv.payments.forEach((p) => {
        if (p.status === 'RECORDED') {
          totalPaid += Number(p.amount);
        }
      });
      inv.creditNotes.forEach((cn) => {
        if (cn.status === 'ISSUED') {
          totalCreditNotes += Number(cn.amount);
        }
      });
    });
  });

  const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);

  // 4. Quotation & Pipeline Analysis by Status
  const statusCounts: Record<string, { count: number; totalValue: number }> = {
    DRAFT: { count: 0, totalValue: 0 },
    PENDING_APPROVAL: { count: 0, totalValue: 0 },
    APPROVED: { count: 0, totalValue: 0 },
    UNDER_NEGOTIATION: { count: 0, totalValue: 0 },
    CONFIRMED: { count: 0, totalValue: 0 },
    REJECTED: { count: 0, totalValue: 0 },
  };

  quotations.forEach((q) => {
    if (statusCounts[q.status]) {
      statusCounts[q.status].count++;
      statusCounts[q.status].totalValue += Number(q.grandTotal);
    }
  });

  const pipelineStages = Object.entries(statusCounts).map(([status, item]) => ({
    status,
    label: formatStatusLabel(status),
    count: item.count,
    totalValue: Math.round(item.totalValue * 100) / 100,
    percentage: pipelineValue > 0 ? Math.round((item.totalValue / pipelineValue) * 1000) / 10 : 0,
  }));

  // 5. Sales Performance by Representative
  const repMap = new Map<
    string,
    {
      repId: string;
      repName: string;
      email: string;
      totalQuotes: number;
      confirmedQuotes: number;
      pipelineRevenue: number;
      confirmedRevenue: number;
      discountSum: number;
    }
  >();

  quotations.forEach((q) => {
    const repId = q.salesRepId;
    const repName = `${q.salesRep?.firstName ?? ''} ${q.salesRep?.lastName ?? ''}`.trim() || 'Unknown';
    const email = q.salesRep?.email ?? '';

    if (!repMap.has(repId)) {
      repMap.set(repId, {
        repId,
        repName,
        email,
        totalQuotes: 0,
        confirmedQuotes: 0,
        pipelineRevenue: 0,
        confirmedRevenue: 0,
        discountSum: 0,
      });
    }

    const r = repMap.get(repId)!;
    r.totalQuotes++;
    r.pipelineRevenue += Number(q.grandTotal);
    r.discountSum += Number(q.discountTotal);
    if (q.status === 'CONFIRMED') {
      r.confirmedQuotes++;
      r.confirmedRevenue += Number(q.grandTotal);
    }
  });

  const salesRepPerformance = Array.from(repMap.values())
    .map((r) => ({
      ...r,
      winRate: r.totalQuotes > 0 ? Math.round((r.confirmedQuotes / r.totalQuotes) * 1000) / 10 : 0,
      avgDiscountPct: r.pipelineRevenue > 0 ? Math.round((r.discountSum / (r.pipelineRevenue + r.discountSum)) * 1000) / 10 : 0,
      pipelineRevenue: Math.round(r.pipelineRevenue * 100) / 100,
      confirmedRevenue: Math.round(r.confirmedRevenue * 100) / 100,
    }))
    .sort((a, b) => b.confirmedRevenue - a.confirmedRevenue);

  // 6. Approval Analysis & Bottlenecks
  let totalApprovalRequests = 0;
  let approvedRequests = 0;
  let rejectedRequests = 0;
  let pendingRequests = 0;
  let managerSteps = 0;
  let financeSteps = 0;
  let totalTurnaroundHours = 0;
  let decidedStepCount = 0;

  const bottlenecks: {
    quoteNumber: string;
    customerName: string;
    riskScore: number;
    riskLevel: string;
    submittedAt: string;
    waitingHours: number;
    requiredLevel: string;
  }[] = [];

  quotations.forEach((q) => {
    q.approvalRequests.forEach((ar) => {
      totalApprovalRequests++;
      if (ar.status === 'APPROVED') approvedRequests++;
      if (ar.status === 'REJECTED') rejectedRequests++;
      if (ar.status === 'PENDING') {
        pendingRequests++;
        const submitted = new Date(ar.submittedAt);
        const waitingHours = Math.round((Date.now() - submitted.getTime()) / (1000 * 60 * 60));
        bottlenecks.push({
          quoteNumber: q.quoteNumber,
          customerName: q.customer.name,
          riskScore: Number(ar.riskScore),
          riskLevel: ar.riskLevel,
          submittedAt: submitted.toISOString(),
          waitingHours,
          requiredLevel: Number(ar.riskScore) > 5 ? 'Manager + Finance' : 'Manager',
        });
      }

      ar.steps.forEach((s) => {
        if (s.approvalLevel === 'MANAGER') managerSteps++;
        if (s.approvalLevel === 'FINANCE') financeSteps++;
        if (s.actedAt) {
          const hours = (new Date(s.actedAt).getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60);
          totalTurnaroundHours += Math.max(0, hours);
          decidedStepCount++;
        }
      });
    });
  });

  const avgTurnaroundHours = decidedStepCount > 0 ? Math.round((totalTurnaroundHours / decidedStepCount) * 10) / 10 : 0;

  // 7. Discount & Margin Governance Analysis
  const riskLevelsCount: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  let riskScoreSum = 0;

  quotations.forEach((q) => {
    const rl = q.riskLevel || 'LOW';
    riskLevelsCount[rl] = (riskLevelsCount[rl] || 0) + 1;
    riskScoreSum += Number(q.blendedRiskScore || 0);
  });

  const avgRiskScore = totalQuotations > 0 ? Math.round((riskScoreSum / totalQuotations) * 100) / 100 : 0;

  const highestDiscountQuotes = [...quotations]
    .sort((a, b) => Number(b.discountTotal) - Number(a.discountTotal))
    .slice(0, 5)
    .map((q) => ({
      quoteNumber: q.quoteNumber,
      customerName: q.customer.name,
      grandTotal: Number(q.grandTotal),
      discountTotal: Number(q.discountTotal),
      discountPercent: Number(q.grandTotal) + Number(q.discountTotal) > 0
        ? Math.round((Number(q.discountTotal) / (Number(q.grandTotal) + Number(q.discountTotal))) * 1000) / 10
        : 0,
      riskScore: Number(q.blendedRiskScore || 0),
      riskLevel: q.riskLevel || 'LOW',
    }));

  // 8. Product & Category Performance
  const productStats = new Map<
    string,
    {
      productId: string;
      name: string;
      sku: string;
      category: string;
      quantitySold: number;
      revenue: number;
      discountAmount: number;
      ordersCount: number;
    }
  >();

  const categoryStats = new Map<
    string,
    {
      category: string;
      revenue: number;
      quantity: number;
      discountAmount: number;
      lineCount: number;
    }
  >();

  quotations.forEach((q) => {
    q.lines.forEach((l) => {
      const pid = l.productId;
      const catName = l.product.category?.name || 'Unassigned';

      if (!productStats.has(pid)) {
        productStats.set(pid, {
          productId: pid,
          name: l.product.name,
          sku: l.product.sku,
          category: catName,
          quantitySold: 0,
          revenue: 0,
          discountAmount: 0,
          ordersCount: 0,
        });
      }
      const ps = productStats.get(pid)!;
      ps.quantitySold += Number(l.quantity);
      ps.revenue += Number(l.lineTotal);
      ps.discountAmount += Number(l.discountAmount);
      ps.ordersCount++;

      if (!categoryStats.has(catName)) {
        categoryStats.set(catName, {
          category: catName,
          revenue: 0,
          quantity: 0,
          discountAmount: 0,
          lineCount: 0,
        });
      }
      const cs = categoryStats.get(catName)!;
      cs.revenue += Number(l.lineTotal);
      cs.quantity += Number(l.quantity);
      cs.discountAmount += Number(l.discountAmount);
      cs.lineCount++;
    });
  });

  const topProducts = Array.from(productStats.values())
    .map((p) => ({
      ...p,
      avgDiscountPct: p.revenue + p.discountAmount > 0 ? Math.round((p.discountAmount / (p.revenue + p.discountAmount)) * 1000) / 10 : 0,
      revenue: Math.round(p.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categoryBreakdown = Array.from(categoryStats.values())
    .map((c) => ({
      ...c,
      avgDiscountPct: c.revenue + c.discountAmount > 0 ? Math.round((c.discountAmount / (c.revenue + c.discountAmount)) * 1000) / 10 : 0,
      revenue: Math.round(c.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // 9. Fulfillment Summary across matching quotations
  const warehouseStats = new Map<
    string,
    {
      warehouseName: string;
      quantityAllocated: number;
      quantityFulfilled: number;
      shippingCost: number;
      allocationsCount: number;
    }
  >();

  let totalAllocations = 0;
  let totalFulfilledQty = 0;
  let totalAllocatedQty = 0;
  let totalShippingCost = 0;

  quotations.forEach((q) => {
    q.fulfillmentAllocations.forEach((fa) => {
      const wName = fa.warehouse?.name || 'Main Warehouse';
      if (!warehouseStats.has(wName)) {
        warehouseStats.set(wName, {
          warehouseName: wName,
          quantityAllocated: 0,
          quantityFulfilled: 0,
          shippingCost: 0,
          allocationsCount: 0,
        });
      }
      const ws = warehouseStats.get(wName)!;
      const allocQty = Number(fa.quantityAllocated);
      const fulfQty = Number(fa.quantityFulfilled);
      const shipCost = Number(fa.estimatedShipmentCost);

      ws.quantityAllocated += allocQty;
      ws.quantityFulfilled += fulfQty;
      ws.shippingCost += shipCost;
      ws.allocationsCount++;

      totalAllocations++;
      totalAllocatedQty += allocQty;
      totalFulfilledQty += fulfQty;
      totalShippingCost += shipCost;
    });
  });

  // Query backorders count and quantity for these quotations
  const quoteIds = quotations.map((q) => q.id);
  const backorders = await prisma.backorder.findMany({
    where: { quotationId: { in: quoteIds } },
    select: { quantityBackordered: true, quantityFulfilledLater: true },
  });

  const totalBackorderedQty = backorders.reduce((sum, b) => sum + Number(b.quantityBackordered) - Number(b.quantityFulfilledLater), 0);

  const warehouseBreakdown = Array.from(warehouseStats.values()).map((ws) => ({
    ...ws,
    shippingCost: Math.round(ws.shippingCost * 100) / 100,
  }));

  // 10. Deal Health Exceptions
  const dealHealthFlags = quotations.flatMap((q) =>
    q.dealHealthFlags.map((dh) => ({
      id: dh.id,
      quoteNumber: q.quoteNumber,
      customerName: q.customer.name,
      type: dh.type,
      severity: dh.severity,
      createdAt: dh.createdAt.toISOString(),
    })),
  );

  const dealHealthSummary = {
    stalledCount: dealHealthFlags.filter((d) => d.type === 'STALLED').length,
    anomalyCount: dealHealthFlags.filter((d) => d.type === 'DISCOUNT_ANOMALY').length,
    slippageCount: dealHealthFlags.filter((d) => d.type === 'DELIVERY_SLIPPAGE').length,
    totalOpenExceptions: dealHealthFlags.length,
    activeExceptions: dealHealthFlags.slice(0, 10),
  };

  // 11. Detailed Quotations list (for XLS Sheet 2)
  const detailedQuotations = quotations.slice(0, 100).map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    customerName: q.customer.name,
    salesRepName: `${q.salesRep?.firstName ?? ''} ${q.salesRep?.lastName ?? ''}`.trim() || 'Unknown',
    salesRepEmail: q.salesRep?.email ?? '',
    status: q.status,
    currencyCode: q.currencyCode,
    subtotal: Number(q.subtotal),
    discountTotal: Number(q.discountTotal),
    grandTotal: Number(q.grandTotal),
    marginPercent: Number(q.marginPercent),
    riskLevel: q.riskLevel || 'LOW',
    blendedRiskScore: Number(q.blendedRiskScore || 0),
    confirmedAt: q.confirmedAt ? q.confirmedAt.toISOString() : null,
    createdAt: q.createdAt.toISOString(),
  }));

  return {
    filters: {
      periodPreset: filters.periodPreset || 'all',
      startDate: start ? start.toISOString() : null,
      endDate: end ? end.toISOString() : null,
      salesRepId: filters.salesRepId || 'ALL',
      approvalStatus: filters.approvalStatus || 'ALL',
      categoryId: filters.categoryId || 'ALL',
      productId: filters.productId || 'ALL',
    },
    kpis: {
      totalQuotations,
      pipelineValue: Math.round(pipelineValue * 100) / 100,
      confirmedValue: Math.round(confirmedValue * 100) / 100,
      avgMarginPct,
      avgDealSize,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      pendingApprovalsCount,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalCreditNotes: Math.round(totalCreditNotes * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    },
    salesRepPerformance,
    pipelineStages,
    approvalGovernance: {
      totalApprovalRequests,
      approvedRequests,
      rejectedRequests,
      pendingRequests,
      managerSteps,
      financeSteps,
      avgTurnaroundHours,
      bottlenecks: bottlenecks.slice(0, 10),
    },
    discountAnalysis: {
      totalDiscountAmount: Math.round(totalDiscounts * 100) / 100,
      avgDiscountPercent:
        pipelineValue + totalDiscounts > 0 ? Math.round((totalDiscounts / (pipelineValue + totalDiscounts)) * 1000) / 10 : 0,
      riskLevelsCount,
      avgRiskScore,
      highestDiscountQuotes,
    },
    productPerformance: {
      topProducts,
      categoryBreakdown,
      hybridSplit: {
        oneTimeRevenue: Math.round(oneTimeBilled * 100) / 100,
        recurringRevenue: Math.round(recurringBilled * 100) / 100,
      },
    },
    fulfillmentSummary: {
      totalAllocations,
      totalAllocatedQty,
      totalFulfilledQty,
      totalBackorderedQty,
      totalShippingCost: Math.round(totalShippingCost * 100) / 100,
      warehouseBreakdown,
    },
    billingSummary: {
      oneTimeBilled: Math.round(oneTimeBilled * 100) / 100,
      recurringBilled: Math.round(recurringBilled * 100) / 100,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalCreditNotes: Math.round(totalCreditNotes * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    },
    dealHealthSummary,
    detailedQuotations,
  };
}

function formatStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved',
    UNDER_NEGOTIATION: 'Under Negotiation',
    CONFIRMED: 'Confirmed Order',
    REJECTED: 'Rejected',
  };
  return map[status] || status;
}

// ── Legacy Function Wrappers (Backward-compatibility) ─────────────────────────

export async function getSalesPerformance(filters: ReportFilters = {}) {
  const report = await getSalesOperationsReport(filters);
  return {
    summary: {
      totalQuotations: report.kpis.totalQuotations,
      totalRevenue: report.kpis.pipelineValue,
      totalDiscounts: report.kpis.totalDiscounts,
      avgDealSize: report.kpis.avgDealSize,
      avgMarginPct: report.kpis.avgMarginPct,
    },
    byStatus: report.pipelineStages.map((p) => ({
      status: p.status,
      count: p.count,
      revenue: p.totalValue,
    })),
    topReps: report.salesRepPerformance.map((r) => ({
      repId: r.repId,
      repName: r.repName,
      count: r.totalQuotes,
      revenue: r.pipelineRevenue,
    })),
  };
}

export async function getProductPerformance(filters: ReportFilters = {}) {
  const report = await getSalesOperationsReport(filters);
  return {
    topProducts: report.productPerformance.topProducts.map((p) => ({
      product: { id: p.productId, name: p.name, sku: p.sku },
      timesOrdered: p.ordersCount,
      totalQty: p.quantitySold,
      totalRevenue: p.revenue,
    })),
    byCategory: report.productPerformance.categoryBreakdown.map((c) => ({
      category: c.category,
      revenue: c.revenue,
    })),
  };
}

export async function getApprovalSummary(filters: ReportFilters = {}) {
  const report = await getSalesOperationsReport(filters);
  return {
    byStatus: [
      { status: 'APPROVED', count: report.approvalGovernance.approvedRequests },
      { status: 'REJECTED', count: report.approvalGovernance.rejectedRequests },
      { status: 'PENDING', count: report.approvalGovernance.pendingRequests },
    ],
    avgApprovalTimeHours: report.approvalGovernance.avgTurnaroundHours,
    totalRequests: report.approvalGovernance.totalApprovalRequests,
  };
}
