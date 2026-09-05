/**
 * ReportingService — aggregated analytics for ADMIN + MANAGER
 *
 * Spec refs: §A7 (reporting requirements), UC-21–22
 *
 * All queries use Prisma aggregates where possible to avoid loading
 * large datasets into JS.
 */

import { prisma } from '../../lib/prisma.js';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  salesRepId?: string;
  categoryId?: string;
  status?: string;
}

// ── Sales Performance ──────────────────────────────────────────────────────────

export async function getSalesPerformance(filters: ReportFilters = {}) {
  const where = {
    ...(filters.startDate && { createdAt: { gte: filters.startDate } }),
    ...(filters.endDate   && { createdAt: { lte: filters.endDate } }),
    ...(filters.salesRepId && { salesRepId: filters.salesRepId }),
    ...(filters.status     && { status: filters.status as any }),
  };

  const [agg, byStatus, bySalesRep] = await Promise.all([
    // Overall totals
    prisma.quotation.aggregate({
      where,
      _count: true,
      _sum:   { grandTotal: true, discountTotal: true },
      _avg:   { grandTotal: true, marginPercent: true },
    }),

    // Count by status
    prisma.quotation.groupBy({
      by: ['status'],
      where,
      _count: true,
      _sum: { grandTotal: true },
    }),

    // Top reps by revenue
    prisma.quotation.groupBy({
      by: ['salesRepId'],
      where,
      _count: true,
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 10,
    }),
  ]);

  // Enrich sales rep IDs with names
  const repIds = bySalesRep.map(r => r.salesRepId);
  const reps = await prisma.user.findMany({
    where: { id: { in: repIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const repMap = Object.fromEntries(reps.map(r => [r.id, `${r.firstName} ${r.lastName}`]));

  return {
    summary: {
      totalQuotations: agg._count,
      totalRevenue:    Number(agg._sum.grandTotal ?? 0),
      totalDiscounts:  Number(agg._sum.discountTotal ?? 0),
      avgDealSize:     Number(agg._avg.grandTotal ?? 0),
      avgMarginPct:    Number(agg._avg.marginPercent ?? 0),
    },
    byStatus: byStatus.map(s => ({
      status:  s.status,
      count:   s._count,
      revenue: Number(s._sum.grandTotal ?? 0),
    })),
    topReps: bySalesRep.map(r => ({
      repId:   r.salesRepId,
      repName: repMap[r.salesRepId] ?? 'Unknown',
      count:   r._count,
      revenue: Number(r._sum.grandTotal ?? 0),
    })),
  };
}

// ── Product Performance ────────────────────────────────────────────────────────

export async function getProductPerformance(filters: ReportFilters = {}) {
  const quotationWhere = {
    ...(filters.startDate && { createdAt: { gte: filters.startDate } }),
    ...(filters.endDate   && { createdAt: { lte: filters.endDate } }),
  };

  // Most-sold products by line total
  const topProducts = await prisma.quotationLine.groupBy({
    by:      ['productId'],
    where:   { quotation: quotationWhere },
    _count:  true,
    _sum:    { lineTotal: true, quantity: true },
    orderBy: { _sum: { lineTotal: 'desc' } },
    take:    10,
  });

  const productIds = topProducts.map(p => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true, category: { select: { name: true } } },
  });
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  // Revenue by category
  const byCategory = await prisma.category.findMany({
    select: {
      id: true, name: true,
      products: {
        select: {
          quotationLines: {
            where: { quotation: quotationWhere },
            select: { lineTotal: true },
          },
        },
      },
    },
  });

  return {
    topProducts: topProducts.map(p => ({
      product:      productMap[p.productId],
      timesOrdered: p._count,
      totalQty:     Number(p._sum.quantity ?? 0),
      totalRevenue: Number(p._sum.lineTotal ?? 0),
    })),
    byCategory: byCategory.map(c => ({
      category: c.name,
      revenue:  c.products.flatMap(p => p.quotationLines).reduce((sum, l) => sum + Number(l.lineTotal), 0),
    })).sort((a, b) => b.revenue - a.revenue),
  };
}

// ── Approval Summary ──────────────────────────────────────────────────────────

export async function getApprovalSummary(filters: ReportFilters = {}) {
  const where = {
    ...(filters.startDate && { createdAt: { gte: filters.startDate } }),
    ...(filters.endDate   && { createdAt: { lte: filters.endDate } }),
  };

  const [byStatus, steps] = await Promise.all([
    prisma.approvalRequest.groupBy({
      by:      ['status'],
      where,
      _count:  true,
    }),
    prisma.approvalStep.findMany({
      where:  { approvalRequest: where, actedAt: { not: null } },
      select: { status: true, createdAt: true, actedAt: true, approvalLevel: true },
    }),
  ]);

  // Avg approval time in hours
  const decidedSteps = steps.filter(s => s.actedAt);
  const avgHours = decidedSteps.length > 0
    ? decidedSteps.reduce((sum, s) => {
        const ms = s.actedAt!.getTime() - s.createdAt.getTime();
        return sum + ms / (1000 * 60 * 60);
      }, 0) / decidedSteps.length
    : 0;

  return {
    byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
    avgApprovalTimeHours: Math.round(avgHours * 10) / 10,
    totalRequests: byStatus.reduce((sum, s) => sum + s._count, 0),
  };
}
