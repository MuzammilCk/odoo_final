/**
 * Approval Controller — REST endpoints for commercial approval workflows
 *
 * Spec refs: §7.4 (internal endpoints), §6.16 (step ordering),
 *            §6.17 (approval decisions), §3.8 (RBAC permissions)
 *
 * Registered in apps/api/src/index.ts under /api/v1/internal/approvals
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ApprovalRequestStatus, ApprovalStepStatus, ApprovalLevel, type Prisma } from '@prisma/client';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import { prisma } from '../../lib/prisma.js';
import * as ApprovalService from './approval.service.js';

export const approvalRouter = Router();

// All approval routes require authentication
approvalRouter.use(authenticateToken);

// ── Validation schemas ────────────────────────────────────────────────────────

const decideStepSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN']),
  comment: z.string().min(1, 'Comment is required'),
});

// ── 1. GET / — List approval requests ───────────────────────────────────────
// SALES_REP sees approvals for their own quotations only (to track status)
// MANAGER / FINANCE_OPS / ADMIN see pending approvals requiring their action

approvalRouter.get(
  '/',
  requireRole('SALES_REP', 'MANAGER', 'FINANCE_OPS', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userRole = req.user!.role;
      const userId   = req.user!.userId;

      // Sales Reps only see approvals for quotations they own
      if (userRole === 'SALES_REP') {
        const approvals = await prisma.approvalRequest.findMany({
          where: {
            quotation: { salesRepId: userId },
          },
          include: {
            quotation: {
              select: {
                id: true,
                quoteNumber: true,
                riskLevel: true,
                grandTotal: true,
                currentVersion: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                    discountTier: {
                      select: { id: true, name: true, defaultDiscountCeiling: true },
                    },
                  },
                },
              },
            },
            steps: { orderBy: { sequenceNo: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        });
        res.json({ approvals, approvalRequests: approvals });
        return;
      }

      // MANAGER / FINANCE_OPS / ADMIN — see pending approvals awaiting their action
      let stepFilter: Prisma.ApprovalStepWhereInput = { status: ApprovalStepStatus.PENDING };
      if (userRole === 'MANAGER') {
        stepFilter = { status: ApprovalStepStatus.PENDING, approvalLevel: ApprovalLevel.MANAGER };
      } else if (userRole === 'FINANCE_OPS') {
        stepFilter = { status: ApprovalStepStatus.PENDING, approvalLevel: ApprovalLevel.FINANCE };
      }

      const approvals = await prisma.approvalRequest.findMany({
        where: {
          status: ApprovalRequestStatus.PENDING,
          steps: { some: stepFilter },
        },
        include: {
          quotation: {
            select: {
              id: true,
              quoteNumber: true,
              riskLevel: true,
              grandTotal: true,
              currentVersion: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  discountTier: {
                    select: { id: true, name: true, defaultDiscountCeiling: true },
                  },
                },
              },
            },
          },
          steps: { orderBy: { sequenceNo: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ approvals, approvalRequests: approvals });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// ── 2. GET /:id — Get approval request detail with steps and terms_snapshot ───

approvalRouter.get(
  '/:id',
  requireRole('SALES_REP', 'MANAGER', 'FINANCE_OPS', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: req.params.id as string },
        include: {
          quotation: {
            select: {
              id: true,
              quoteNumber: true,
              riskLevel: true,
              grandTotal: true,
              currentVersion: true,
              status: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  discountTier: {
                    select: {
                      id: true,
                      name: true,
                      defaultDiscountCeiling: true,
                    },
                  },
                },
              },
            },
          },
          steps: {
            orderBy: { sequenceNo: 'asc' },
            include: {
              approver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!approval) {
        res.status(404).json({ error: 'Approval request not found' });
        return;
      }

      res.json({ approval, approvalRequest: approval });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// ── 3. POST /:id/steps/:stepId/decide — Submit decision on an approval step ───

approvalRouter.post(
  '/:id/steps/:stepId/decide',
  requireRole('MANAGER', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = decideStepSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      await ApprovalService.decideStep(
        req.params.stepId as string,
        req.user!.userId,
        parsed.data.decision,
        parsed.data.comment,
      );

      // Fetch and return updated approval request with all steps and quotation
      const approvalRequest = await prisma.approvalRequest.findUnique({
        where: { id: req.params.id as string },
        include: {
          quotation: {
            select: {
              id: true,
              quoteNumber: true,
              status: true,
              riskLevel: true,
              currentVersion: true,
            },
          },
          steps: {
            orderBy: { sequenceNo: 'asc' },
            include: {
              approver: {
                select: { id: true, firstName: true, lastName: true, role: true },
              },
            },
          },
        },
      });

      res.json({ approvalRequest, approval: approvalRequest });
    } catch (err: unknown) {
      const e = err as { message: string };
      const status = e.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: e.message });
    }
  },
);
