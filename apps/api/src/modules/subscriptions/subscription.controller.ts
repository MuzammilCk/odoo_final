/**
 * Subscription Controller — REST endpoints for Subscriptions lifecycle
 *
 * Spec refs: §6.34, §6.35, §8.20 (RBAC)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import * as SubscriptionService from './subscription.service.js';

export const subscriptionRouter = Router();

// ── GET /api/v1/internal/subscriptions ─────────────────────────────────────────

subscriptionRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, customerId } = req.query;
    const subscriptions = await SubscriptionService.listSubscriptions({
      status: status as string | undefined,
      customerId: customerId as string | undefined,
    });
    res.json({ subscriptions });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── GET /api/v1/internal/subscriptions/:id ─────────────────────────────────────

subscriptionRouter.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const subscription = await SubscriptionService.getSubscription(req.params.id as string);
    res.json({ subscription });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── PATCH /api/v1/internal/subscriptions/:id ───────────────────────────────────

const modifySchema = z.object({
  newQuantity: z.number().positive().optional(),
  newPlanInterval: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
});

subscriptionRouter.patch('/:id', authenticateToken, requireRole('ADMIN', 'MANAGER', 'SALES_REP'), async (req: Request, res: Response): Promise<void> => {
  const parsed = modifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await SubscriptionService.modifySubscription(
      req.params.id as string,
      parsed.data,
      req.user!.userId,
    );
    res.json({ message: 'Subscription modified', ...result });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── POST /api/v1/internal/subscriptions/:id/cancel ─────────────────────────────

subscriptionRouter.post('/:id/cancel', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await SubscriptionService.cancelSubscription(
      req.params.id as string,
      req.user!.userId,
    );
    res.json({ message: 'Subscription cancelled', ...result });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── POST /api/v1/internal/subscriptions/create-from-quotation/:quotationId ─────

subscriptionRouter.post('/create-from-quotation/:quotationId', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    await SubscriptionService.createFromConfirmedQuotation(req.params.quotationId as string, req.user!.userId);
    res.json({ message: 'Subscriptions generated from quotation' });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});
