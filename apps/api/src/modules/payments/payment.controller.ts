/**
 * Payment Controller — REST endpoints for Payments and Credit Notes
 *
 * Spec refs: §5.25, §5.26, §6.39, §8.20 (RBAC)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import * as PaymentService from './payment.service.js';
import * as CreditNoteService from './credit-note.service.js';
import { prisma } from '../../lib/prisma.js';

export const paymentRouter = Router();

// ── Payments ───────────────────────────────────────────────────────────────────

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  currencyCode: z.string().length(3),
  paymentReference: z.string().min(1),
});

paymentRouter.post(
  '/payments',
  authenticateToken,
  requireRole('ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = recordPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    try {
      const result = await PaymentService.recordPayment(
        parsed.data.invoiceId,
        parsed.data.amount,
        parsed.data.currencyCode,
        parsed.data.paymentReference,
        req.user!.userId,
      );
      res.status(201).json(result);
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

paymentRouter.get('/invoices/:id/payments', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      where: { invoiceId: req.params.id as string },
      orderBy: { paidAt: 'desc' },
      include: { createdByUser: { select: { firstName: true, lastName: true, email: true } } },
    });
    res.json({ payments });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

paymentRouter.post(
  '/payments/:id/reverse',
  authenticateToken,
  requireRole('ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await PaymentService.reversePayment(req.params.id as string, req.user!.userId);
      res.json({ message: 'Payment reversed', ...result });
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── Credit Notes ───────────────────────────────────────────────────────────────

const createCreditNoteSchema = z.object({
  invoiceId: z.string().uuid(),
  subscriptionInstanceId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currencyCode: z.string().length(3),
  reason: z.string().min(1),
});

paymentRouter.post(
  '/credit-notes',
  authenticateToken,
  requireRole('ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createCreditNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    try {
      const creditNote = await CreditNoteService.createCreditNote({
        ...parsed.data,
        actorUserId: req.user!.userId,
      });
      res.status(201).json({ creditNote });
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

paymentRouter.get('/credit-notes', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoiceId, subscriptionInstanceId } = req.query;
    const creditNotes = await CreditNoteService.listCreditNotes({
      invoiceId: invoiceId as string | undefined,
      subscriptionInstanceId: subscriptionInstanceId as string | undefined,
    });
    res.json({ creditNotes });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

paymentRouter.post(
  '/credit-notes/:id/issue',
  authenticateToken,
  requireRole('ADMIN', 'FINANCE_OPS'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const creditNote = await CreditNoteService.issueCreditNote(req.params.id as string, req.user!.userId);
      res.json({ message: 'Credit note issued', creditNote });
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);
