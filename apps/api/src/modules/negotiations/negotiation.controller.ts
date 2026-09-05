/**
 * Internal Negotiation Controller — Sales Rep & Manager negotiation handling
 *
 * Spec refs: §6.21 (Negotiation workflow & rep resolution),
 *            §7.3 (Internal negotiation endpoints)
 *
 * Registered under /api/v1/internal/quotations
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import { resolveNegotiation } from './negotiation.service.js';

export const negotiationRouter = Router({ mergeParams: true });

/**
 * GET /api/v1/internal/quotations/:id/negotiations
 * Lists all negotiation requests and resolution history for sales reps and managers.
 */
negotiationRouter.get(
  '/:id/negotiations',
  authenticateToken,
  requireRole('SALES_REP', 'MANAGER', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const requests = await prisma.negotiationRequest.findMany({
        where: { quotationId: id },
        include: {
          customer: {
            select: { id: true, name: true },
          },
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          resolvedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          quotationLine: {
            select: {
              id: true,
              descriptionSnapshot: true,
              quantity: true,
              unitPrice: true,
              discountPercent: true,
              lineTotal: true,
              product: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(requests);
    } catch (error) {
      console.error('[internal/negotiations] Error listing negotiation requests:', error);
      res.status(500).json({ error: 'Failed to retrieve negotiation requests' });
    }
  }
);

/**
 * POST /api/v1/internal/quotations/:id/negotiations/:nId/respond
 * Sales rep or manager resolves a negotiation request (accept with optional discount adjustment, or reject).
 */
negotiationRouter.post(
  '/:id/negotiations/:nId/respond',
  authenticateToken,
  requireRole('SALES_REP', 'MANAGER', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const nId = req.params.nId as string;
      const { accepted, adjustedDiscount, comment } = req.body;

      if (typeof accepted !== 'boolean') {
        res.status(400).json({ error: "'accepted' boolean field is required" });
        return;
      }

      const result = await resolveNegotiation(nId, req.user!.userId, {
        accepted,
        adjustedDiscount: adjustedDiscount !== undefined ? Number(adjustedDiscount) : undefined,
        comment,
      });

      res.json({
        success: true,
        message: `Negotiation request ${accepted ? 'accepted' : 'rejected'}`,
        ...result,
      });
    } catch (error: any) {
      console.error('[internal/negotiations/respond] Error resolving negotiation:', error);
      res.status(400).json({ error: error.message ?? 'Failed to resolve negotiation' });
    }
  }
);
