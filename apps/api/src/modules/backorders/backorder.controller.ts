/**
 * Backorder Controller — Internal REST endpoints for backorder tracking and consolidation
 *
 * Spec refs: §6.30–§6.32 (Backorder tracking & consolidation),
 *            §7.3 (Internal backorders API surface)
 *
 * Registered under /api/v1/internal/backorders
 */

import { Router, type Request, type Response } from 'express';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import {
  listOpenBackorders,
  consolidateBackorder,
} from './backorder.service.js';

export const backorderRouter = Router();

const internalAuth = [authenticateToken, requireRole('FINANCE_OPS', 'MANAGER', 'ADMIN', 'SALES_REP')];

/**
 * 1. GET /api/v1/internal/backorders
 * Lists all active, unresolved backorders across all quotations.
 */
backorderRouter.get(
  '/',
  ...internalAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const backorders = await listOpenBackorders();
      res.json(backorders);
    } catch (error) {
      console.error('[backorders/list] Error listing open backorders:', error);
      res.status(500).json({ error: 'Failed to retrieve open backorders' });
    }
  }
);

/**
 * 2. POST /api/v1/internal/backorders/:id/consolidate
 * Consolidates an open backorder using newly available warehouse inventory.
 */
backorderRouter.post(
  '/:id/consolidate',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { warehouseId } = req.body;

      const result = await consolidateBackorder(id, warehouseId, req.user!.userId);
      res.json({
        message: 'Backorder consolidated successfully',
        ...result,
      });
    } catch (error: any) {
      console.error('[backorders/consolidate] Error consolidating backorder:', error);
      res.status(400).json({ error: error.message ?? 'Failed to consolidate backorder' });
    }
  }
);
