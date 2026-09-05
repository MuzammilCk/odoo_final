/**
 * Quotation Controller — REST endpoints for quotation CRUD
 *
 * Spec refs: §7.4 (quotation endpoints), §6.6 (creation rules),
 *            §3.8 (use-case permissions)
 *
 * Routes registered in apps/api/src/index.ts under /api/v1/internal/quotations
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { QuotationStatus, AuditAction } from '@prisma/client';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import { prisma } from '../../lib/prisma.js';
import * as QuotationService from './quotation.service.js';
import * as RecommendationService from '../recommendations/recommendation.service.js';
import { evaluateAndRoute } from './services/discount-risk.service.js';
import { createApprovalRequest } from '../approvals/approval.service.js';

export const quotationRouter = Router();

// All quotation routes require authentication
quotationRouter.use(authenticateToken);

// ── Zod schemas ────────────────────────────────────────────────────────────────

const createQuotationSchema = z.object({
  customerId: z.string().uuid(),
  currencyCode: z.string().length(3),
});

const addLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  discountPercent: z.number().min(0).max(100),
});

const updateLineSchema = z
  .object({
    quantity: z.number().positive().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    unitPrice: z.number().positive().optional(),
  })
  .refine(
    (data) =>
      data.quantity !== undefined ||
      data.discountPercent !== undefined ||
      data.unitPrice !== undefined,
    {
      message: 'At least one field (quantity, discountPercent, or unitPrice) must be provided',
    },
  );



// ── POST / — Create a new quotation ──────────────────────────────────────────

quotationRouter.post(
  '/',
  requireRole('SALES_REP'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createQuotationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const quotation = await QuotationService.createQuotation(
        req.user!.userId,
        parsed.data.customerId,
        parsed.data.currencyCode,
      );
      res.status(201).json({ quotation });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(400).json({ error: e.message });
    }
  },
);

// ── GET / — List quotations with optional filters ────────────────────────────

quotationRouter.get(
  '/',
  requireRole('SALES_REP', 'MANAGER', 'ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, salesRepId } = req.query;

      const where: Record<string, unknown> = {};
      if (status && Object.values(QuotationStatus).includes(status as QuotationStatus)) {
        where.status = status as QuotationStatus;
      }
      if (salesRepId && typeof salesRepId === 'string') {
        where.salesRepId = salesRepId;
      }

      const quotations = await prisma.quotation.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          salesRep: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      res.json({ quotations });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// ── GET /helpers/customers — List active customers for quote creation ────────
quotationRouter.get(
  '/helpers/customers',
  requireRole('SALES_REP', 'MANAGER', 'ADMIN', 'FINANCE_OPS'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const customers = await prisma.customer.findMany({
        where: { isActive: true },
        include: { discountTier: true },
        orderBy: { name: 'asc' },
      });
      res.json({ customers });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// ── GET /helpers/products — List active products for adding line items ───────
quotationRouter.get(
  '/helpers/products',
  requireRole('SALES_REP', 'MANAGER', 'ADMIN', 'FINANCE_OPS'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { name: 'asc' },
      });
      res.json({ products });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// ── GET /:id — Quotation detail with lines + customer ────────────────────────

quotationRouter.get(
  '/:id',
  requireRole('SALES_REP', 'MANAGER', 'ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quotation = await prisma.quotation.findUnique({
        where: { id: req.params.id as string },
        include: {
          customer: { select: { id: true, name: true, discountTierId: true } },
          salesRep: { select: { id: true, firstName: true, lastName: true } },
          lines: {
            include: {
              product: { select: { id: true, name: true, categoryId: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!quotation) {
        res.status(404).json({ error: 'Quotation not found' });
        return;
      }

      res.json({ quotation });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// ── POST /:id/lines — Add a line to a quotation ─────────────────────────────

quotationRouter.post(
  '/:id/lines',
  requireRole('SALES_REP'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = addLineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const quotation = await QuotationService.addLine(req.params.id as string, parsed.data);
      res.status(201).json({ quotation });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(400).json({ error: e.message });
    }
  },
);

// ── PATCH /:id/lines/:lineId — Update a quotation line ──────────────────────

quotationRouter.patch(
  '/:id/lines/:lineId',
  requireRole('SALES_REP'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = updateLineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const quotation = await QuotationService.updateLine(
        req.params.id as string,
        req.params.lineId as string,
        parsed.data,
      );
      res.json({ quotation });
    } catch (err: unknown) {
      const e = err as { message: string };
      const status = e.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: e.message });
    }
  },
);

// ── DELETE /:id/lines/:lineId — Delete a quotation line ─────────────────────

quotationRouter.delete(
  '/:id/lines/:lineId',
  requireRole('SALES_REP'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quotation = await QuotationService.deleteLine(
        req.params.id as string,
        req.params.lineId as string,
      );
      res.json({ quotation });
    } catch (err: unknown) {
      const e = err as { message: string };
      const status = e.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: e.message });
    }
  },
);

// ── GET /:id/recommendations — Upsell/cross-sell recommendations ────────────

quotationRouter.get(
  '/:id/recommendations',
  requireRole('SALES_REP', 'MANAGER', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const recommendations = await RecommendationService.getRecommendations(
        req.params.id as string,
      );
      res.json({ recommendations });
    } catch (err: unknown) {
      const e = err as { message: string };
      const status = e.message.includes('not found') ? 404 : 500;
      res.status(status).json({ error: e.message });
    }
  },
);

// ── POST /:id/submit — Submit quotation for approval / auto-approval ─────────

quotationRouter.post(
  '/:id/submit',
  requireRole('SALES_REP'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quotationId = req.params.id as string;

      const quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: { lines: true },
      });

      if (!quotation) {
        res.status(404).json({ error: 'Quotation not found' });
        return;
      }

      if (quotation.status !== QuotationStatus.DRAFT) {
        res.status(400).json({
          error: `Cannot submit quotation with status '${quotation.status}'. Only DRAFT quotations can be submitted.`,
        });
        return;
      }

      if (quotation.lines.length === 0) {
        res.status(400).json({ error: 'Cannot submit a quotation with no line items' });
        return;
      }

      // 1. Evaluate discount risk & route (Contract 1)
      const routing = await evaluateAndRoute(quotationId);

      let approvalRequest = null;

      if (!routing.requiresApproval) {
        // LOW risk: auto-approve
        const updated = await prisma.quotation.update({
          where: { id: quotationId },
          data: { status: QuotationStatus.APPROVED },
          include: {
            customer: { select: { id: true, name: true } },
            salesRep: { select: { id: true, firstName: true, lastName: true } },
            lines: true,
          },
        });

        await prisma.auditLog.create({
          data: {
            actorUserId: req.user!.userId,
            action: AuditAction.QUOTATION_SUBMITTED,
            entityType: 'quotation',
            entityId: quotation.id,
            quotationId: quotation.id,
            metadata: {
              quotationVersion: quotation.currentVersion,
              riskLevel: routing.riskLevel,
              riskScore: routing.riskScore,
              autoApproved: true,
            },
          },
        });

        res.json({
          quotation: updated,
          routing,
          approvalRequest: null,
          message: 'Quotation auto-approved (LOW risk)',
        });
        return;
      }

      // MEDIUM or HIGH risk: create approval request & set PENDING_APPROVAL
      approvalRequest = await createApprovalRequest(
        quotationId,
        routing.riskLevel as 'MEDIUM' | 'HIGH',
        routing.riskScore,
      );

      const updated = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: {
          customer: { select: { id: true, name: true } },
          salesRep: { select: { id: true, firstName: true, lastName: true } },
          lines: true,
        },
      });

      res.json({
        quotation: updated,
        routing,
        approvalRequest,
        message: `Quotation submitted for ${routing.riskLevel} risk approval`,
      });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);


