/**
 * Fulfillment Controller — Internal warehouse operations and fulfillment management
 *
 * Spec refs: §6.26–§6.29 (Fulfillment engine & manual override),
 *            §7.3 (Internal fulfillment API surface)
 *
 * Registered under /api/v1/internal/fulfillment
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { QuotationStatus } from '@prisma/client';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import {
  calculateAllocation,
  acceptAllocation,
} from './services/allocation-engine.service.js';

export const fulfillmentRouter = Router();

// Middleware: all internal fulfillment endpoints require INTERNAL roles
const internalAuth = [authenticateToken, requireRole('FINANCE_OPS', 'MANAGER', 'ADMIN', 'SALES_REP')];

/**
 * 1. GET /api/v1/internal/fulfillment/quotations
 * Lists confirmed quotations awaiting or undergoing fulfillment allocation.
 */
fulfillmentRouter.get(
  '/quotations',
  ...internalAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const quotations = await prisma.quotation.findMany({
        where: {
          status: QuotationStatus.CONFIRMED,
        },
        include: {
          customer: { select: { id: true, name: true } },
          salesRep: { select: { id: true, firstName: true, lastName: true } },
          fulfillmentAllocations: {
            include: { warehouse: { select: { id: true, name: true } } },
          },
          Backorder: true,
        },
        orderBy: { confirmedAt: 'desc' },
      });

      const formatted = quotations.map((q) => {
        const totalAllocated = q.fulfillmentAllocations.reduce(
          (sum, a) => sum + Number(a.quantityAllocated),
          0
        );
        const totalBackordered = q.Backorder.reduce(
          (sum, b) => sum + Number(b.quantityBackordered),
          0
        );

        let allocationState = 'AWAITING_ALLOCATION';
        if (q.fulfillmentAllocations.length > 0) {
          allocationState = totalBackordered > 0 ? 'PARTIAL_BACKORDER' : 'ALLOCATED';
        }

        return {
          id: q.id,
          quoteNumber: q.quoteNumber,
          customerName: q.customer.name,
          salesRepName: `${q.salesRep.firstName} ${q.salesRep.lastName}`,
          grandTotal: Number(q.grandTotal),
          currencyCode: q.currencyCode,
          confirmedAt: q.confirmedAt,
          allocationState,
          allocationsCount: q.fulfillmentAllocations.length,
          backordersCount: q.Backorder.length,
          totalAllocated,
          totalBackordered,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error('[fulfillment/quotations] Error listing fulfillment quotations:', error);
      res.status(500).json({ error: 'Failed to retrieve fulfillment quotations' });
    }
  }
);

/**
 * 2. GET /api/v1/internal/fulfillment/quotations/:id
 * Fetches fulfillment detail for a single quotation including lines, existing allocations, and backorders.
 */
fulfillmentRouter.get(
  '/quotations/:id',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const quotation = await prisma.quotation.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, name: true } },
          lines: {
            include: {
              product: true,
              fulfillmentAllocations: {
                include: { warehouse: { select: { id: true, name: true } } },
              },
              backorders: true,
            },
          },
          fulfillmentAllocations: {
            include: { warehouse: { select: { id: true, name: true } } },
          },
          Backorder: true,
        },
      });

      if (!quotation) {
        res.status(404).json({ error: 'Quotation not found' });
        return;
      }

      res.json(quotation);
    } catch (error) {
      console.error('[fulfillment/quotation/:id] Error getting fulfillment detail:', error);
      res.status(500).json({ error: 'Failed to retrieve fulfillment detail' });
    }
  }
);

/**
 * 3. POST /api/v1/internal/fulfillment/quotations/:id/allocate
 * Calculates and returns the greedy warehouse allocation recommendation (no stock reserved).
 */
fulfillmentRouter.post(
  '/quotations/:id/allocate',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const recommendation = await calculateAllocation(id);
      res.json(recommendation);
    } catch (error: any) {
      console.error('[fulfillment/allocate] Error computing allocation recommendation:', error);
      res.status(400).json({ error: error.message ?? 'Failed to compute allocation recommendation' });
    }
  }
);

/**
 * 4. POST /api/v1/internal/fulfillment/quotations/:id/accept-split
 * Accepts the recommended allocation split and commits transactional reservation.
 */
fulfillmentRouter.post(
  '/quotations/:id/accept-split',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await acceptAllocation(id, undefined, req.user!.userId);
      res.json({
        message: 'Suggested allocation split accepted and inventory reserved',
        ...result,
      });
    } catch (error: any) {
      console.error('[fulfillment/accept-split] Error accepting split:', error);
      res.status(400).json({ error: error.message ?? 'Failed to accept allocation split' });
    }
  }
);

/**
 * 5. POST /api/v1/internal/fulfillment/quotations/:id/override-split
 * Commits a manually overridden allocation across specified warehouses.
 */
fulfillmentRouter.post(
  '/quotations/:id/override-split',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { allocations } = req.body;

      if (!Array.isArray(allocations) || allocations.length === 0) {
        res.status(400).json({ error: 'Allocations array is required for manual override' });
        return;
      }

      const result = await acceptAllocation(id, { allocations }, req.user!.userId);
      res.json({
        message: 'Manual allocation override committed and inventory reserved',
        ...result,
      });
    } catch (error: any) {
      console.error('[fulfillment/override-split] Error committing manual override:', error);
      res.status(400).json({ error: error.message ?? 'Failed to commit manual override' });
    }
  }
);

/**
 * 6. POST /api/v1/internal/fulfillment/allocations/:id/fulfill
 * Dispatches and fulfills a single allocation.
 */
fulfillmentRouter.post(
  '/allocations/:id/fulfill',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const allocation = await prisma.fulfillmentAllocation.findUnique({
        where: { id },
        include: { quotationLine: true },
      });

      if (!allocation) {
        res.status(404).json({ error: 'Allocation not found' });
        return;
      }

      const qty = Number(allocation.quantityAllocated);

      const result = await prisma.$transaction(async (tx) => {
        await tx.stockLevel.update({
          where: {
            warehouseId_productId: {
              warehouseId: allocation.warehouseId,
              productId: allocation.quotationLine.productId,
            },
          },
          data: {
            quantityOnHand: { decrement: qty },
            quantityReserved: { decrement: qty },
          },
        });

        return await tx.fulfillmentAllocation.update({
          where: { id },
          data: {
            status: 'FULFILLED',
          },
        });
      });

      res.json({
        message: 'Allocation fulfilled and inventory dispatched',
        allocation: result,
      });
    } catch (error: any) {
      console.error('[fulfillment/fulfill] Error fulfilling allocation:', error);
      res.status(500).json({ error: error.message ?? 'Failed to fulfill allocation' });
    }
  }
);

/**
 * 7. POST /api/v1/internal/fulfillment/quotations/:id/fulfill-all
 * Dispatches and fulfills all pending allocations for a quotation.
 */
fulfillmentRouter.post(
  '/quotations/:id/fulfill-all',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const allocations = await prisma.fulfillmentAllocation.findMany({
        where: {
          quotationId: id,
          status: { not: 'FULFILLED' },
        },
        include: { quotationLine: true },
      });

      if (allocations.length === 0) {
        res.status(400).json({ error: 'No unfulfilled allocations found for this quotation' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        for (const allocation of allocations) {
          const qty = Number(allocation.quantityAllocated);
          await tx.stockLevel.update({
            where: {
              warehouseId_productId: {
                warehouseId: allocation.warehouseId,
                productId: allocation.quotationLine.productId,
              },
            },
            data: {
              quantityOnHand: { decrement: qty },
              quantityReserved: { decrement: qty },
            },
          });

          await tx.fulfillmentAllocation.update({
            where: { id: allocation.id },
            data: {
              status: 'FULFILLED',
            },
          });
        }
      });

      res.json({
        message: `Successfully fulfilled ${allocations.length} allocation(s)`,
        count: allocations.length,
      });
    } catch (error: any) {
      console.error('[fulfillment/fulfill-all] Error fulfilling all allocations:', error);
      res.status(500).json({ error: error.message ?? 'Failed to fulfill allocations' });
    }
  }
);
