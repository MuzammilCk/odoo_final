/**
 * Deal Health Controller — REST endpoints for Deal Health monitoring
 *
 * Spec refs: §5.27, §6.41–§6.43, §8.20 (RBAC)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import * as DealHealthService from './deal-health.service.js';
import { prisma } from '../../lib/prisma.js';

export const dealHealthRouter = Router();

// ── GET /api/v1/internal/deal-health ───────────────────────────────────────────

dealHealthRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, status, severity } = req.query;
    const flags = await DealHealthService.listFlags({
      type: type as string | undefined,
      status: status as string | undefined,
      severity: severity as string | undefined,
    });
    res.json({ flags });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── GET /api/v1/internal/deal-health/:id ───────────────────────────────────────

dealHealthRouter.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const flag = await DealHealthService.getFlag(req.params.id as string);
    res.json({ flag });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── POST /api/v1/internal/deal-health/:id/acknowledge ──────────────────────────

dealHealthRouter.post(
  '/:id/acknowledge',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const flag = await DealHealthService.acknowledgeFlag(req.params.id as string, req.user!.userId);
      res.json({ message: 'Flag acknowledged', flag });
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── POST /api/v1/internal/deal-health/:id/resolve ──────────────────────────────

dealHealthRouter.post(
  '/:id/resolve',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const flag = await DealHealthService.resolveFlag(req.params.id as string, req.user!.userId);
      res.json({ message: 'Flag resolved', flag });
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── POST /api/v1/internal/deal-health/:id/nudge ────────────────────────────────

dealHealthRouter.post(
  '/:id/nudge',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const flag = await DealHealthService.getFlag(req.params.id as string);

      // Record audit log for the nudge action
      await prisma.auditLog.create({
        data: {
          actorUserId: req.user!.userId,
          action:     'DEAL_HEALTH_UPDATED',
          entityType: 'deal_health_flags',
          entityId:   flag.id,
          quotationId: flag.quotationId,
          metadata:   { event: 'NUDGE_SENT', flagType: flag.type },
        },
      });

      res.json({ message: 'Nudge sent successfully for deal health flag' });
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── POST /api/v1/internal/deal-health/evaluate ─────────────────────────────────

const evaluateSchema = z.object({
  stalledDays: z.number().positive().optional(),
  anomalyThreshold: z.number().positive().optional(),
  slippageDays: z.number().positive().optional(),
});

dealHealthRouter.post(
  '/evaluate',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = evaluateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    try {
      const result = await DealHealthService.evaluate(parsed.data);
      res.json(result);
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);
