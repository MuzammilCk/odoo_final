/**
 * Billing Controller — REST endpoints for Invoices and Billing Overview
 *
 * Spec refs: §5.24, §6.37–6.39, §8.20 (RBAC)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import * as InvoiceGeneratorService from './services/invoice-generator.service.js';
import { prisma } from '../../lib/prisma.js';

export const billingRouter = Router();

// ── GET /api/v1/internal/invoices ──────────────────────────────────────────────

billingRouter.get('/invoices', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, quotationId } = req.query;
    const invoices = await InvoiceGeneratorService.listInvoices({
      status: status as string | undefined,
      quotationId: quotationId as string | undefined,
    });
    res.json({ invoices });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── GET /api/v1/internal/invoices/:id ──────────────────────────────────────────

billingRouter.get('/invoices/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await InvoiceGeneratorService.getInvoice(req.params.id as string);
    
    // Also compute amountPaid and balanceDue dynamically
    const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalAmount = Number(invoice.totalAmount);
    const balanceDue = Math.max(0, Math.round((totalAmount - totalPaid) * 100) / 100);

    res.json({
      invoice: {
        ...invoice,
        amountPaid: totalPaid,
        balanceDue,
      },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── POST /api/v1/internal/invoices/generate-from-fulfillment ───────────────────

const generateOneTimeSchema = z.object({
  quotationId: z.string().uuid(),
});

billingRouter.post(
  '/invoices/generate-from-fulfillment',
  authenticateToken,
  requireRole('ADMIN', 'FINANCE_OPS', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = generateOneTimeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    try {
      const result = await InvoiceGeneratorService.generateOneTimeInvoice(
        parsed.data.quotationId,
        req.user!.userId,
      );
      res.status(201).json(result);
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── POST /api/v1/internal/invoices/generate-recurring ──────────────────────────

billingRouter.post(
  '/invoices/generate-recurring',
  authenticateToken,
  requireRole('ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await InvoiceGeneratorService.generateRecurringInvoices(req.user!.userId);
      res.json(result);
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── POST /api/v1/internal/invoices/:id/void ────────────────────────────────────

billingRouter.post(
  '/invoices/:id/void',
  authenticateToken,
  requireRole('ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const invoice = await InvoiceGeneratorService.voidInvoice(req.params.id as string, req.user!.userId);
      res.json({ message: 'Invoice voided', invoice });
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── GET /api/v1/internal/billing/summary/:quotationId (Screen 10) ───────────────

billingRouter.get('/summary/:quotationId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const quotationId = req.params.quotationId as string;
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: true,
        lines: {
          include: { product: true },
        },
        invoices: {
          include: {
            payments: true,
            creditNotes: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        subscriptionInstances: {
          include: { product: true },
        },
      },
    });

    if (!quotation) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    // Separate one-time lines vs recurring lines
    const oneTimeLines = quotation.lines.filter((l) => !l.product.isSubscription);
    const recurringLines = quotation.lines.filter((l) => l.product.isSubscription);

    res.json({
      quotation: {
        id: quotation.id,
        quoteNumber: quotation.quoteNumber,
        status: quotation.status,
        customer: quotation.customer,
        currencyCode: quotation.currencyCode,
        grandTotal: quotation.grandTotal,
      },
      oneTimeCharges: oneTimeLines,
      recurringCharges: recurringLines,
      subscriptions: quotation.subscriptionInstances,
      invoices: quotation.invoices,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});
