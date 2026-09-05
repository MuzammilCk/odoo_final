/**
 * Dashboard Controller — Commercial operations metrics & overview
 *
 * Spec refs: §7.4 (internal dashboard), §3.8 (internal dashboard access)
 *
 * Route: GET /api/v1/internal/dashboard
 */

import { Router, type Request, type Response } from 'express';
import { QuotationStatus, ApprovalRequestStatus } from '@prisma/client';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import { prisma } from '../../lib/prisma.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken);

dashboardRouter.get(
  '/',
  requireRole('SALES_REP', 'MANAGER', 'ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;

      // Filter by salesRepId if the caller is SALES_REP (or allow rep to see team/own metrics)
      // Sales reps see their own, managers/admins/finance see global
      const quotationWhere =
        user.role === 'SALES_REP' ? { salesRepId: user.userId } : {};

      // 1. Quotation counts grouped by status
      const statusCountsRaw = await prisma.quotation.groupBy({
        by: ['status'],
        where: quotationWhere,
        _count: { id: true },
      });

      const statusCounts: Record<string, number> = {
        DRAFT: 0,
        PENDING_APPROVAL: 0,
        APPROVED: 0,
        UNDER_NEGOTIATION: 0,
        CONFIRMED: 0,
        REJECTED: 0,
      };

      for (const item of statusCountsRaw) {
        statusCounts[item.status] = item._count.id;
      }

      // 2. Pending approvals count
      const pendingApprovalsCount = await prisma.approvalRequest.count({
        where: {
          status: ApprovalRequestStatus.PENDING,
          ...(user.role === 'SALES_REP' ? { createdBy: user.userId } : {}),
        },
      });

      // 3. Aggregate totals: Revenue and average margin
      const approvedOrOrderQuotations = await prisma.quotation.findMany({
        where: {
          ...quotationWhere,
          status: { in: [QuotationStatus.APPROVED, QuotationStatus.CONFIRMED] },
        },
        select: {
          grandTotal: true,
          marginPercent: true,
        },
      });

      let totalRevenue = 0;
      let totalMarginSum = 0;
      for (const q of approvedOrOrderQuotations) {
        totalRevenue += Number(q.grandTotal || 0);
        totalMarginSum += Number(q.marginPercent || 0);
      }

      const avgMarginPercent =
        approvedOrOrderQuotations.length > 0
          ? Number((totalMarginSum / approvedOrOrderQuotations.length).toFixed(2))
          : 0;

      // 4. Total count of quotations
      const totalQuotations = Object.values(statusCounts).reduce((a, b) => a + b, 0);

      // 5. Recent 10 quotations
      const recentQuotations = await prisma.quotation.findMany({
        where: quotationWhere,
        include: {
          customer: { select: { id: true, name: true } },
          salesRep: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      res.json({
        metrics: {
          totalQuotations,
          statusCounts,
          pendingApprovalsCount,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          avgMarginPercent,
        },
        recentQuotations,
      });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);
