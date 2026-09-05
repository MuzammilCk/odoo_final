/**
 * Inventory Controller — Internal warehouse and stock management
 *
 * Spec refs: §6.28–§6.29 (Inventory release & stock updates),
 *            §7.3 (Internal inventory endpoints)
 *
 * Registered under /api/v1/internal
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import { releaseReservation } from './inventory.service.js';

export const inventoryRouter = Router();

const internalAuth = [authenticateToken, requireRole('FINANCE_OPS', 'MANAGER', 'ADMIN', 'SALES_REP')];

/**
 * 1. GET /api/v1/internal/warehouses
 * Lists all physical warehouses with their shipping cost weights.
 */
inventoryRouter.get(
  '/warehouses',
  ...internalAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const warehouses = await prisma.warehouse.findMany({
        orderBy: { name: 'asc' },
      });
      res.json(warehouses);
    } catch (error) {
      console.error('[inventory/warehouses] Error listing warehouses:', error);
      res.status(500).json({ error: 'Failed to retrieve warehouses' });
    }
  }
);

/**
 * 2. GET /api/v1/internal/warehouses/:id
 * Fetches warehouse details and current stock levels for all products.
 */
inventoryRouter.get(
  '/warehouses/:id',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const warehouse = await prisma.warehouse.findUnique({
        where: { id },
        include: {
          stockLevels: {
            include: { product: true },
          },
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      const formattedStock = warehouse.stockLevels.map((s) => {
        const onHand = Number(s.quantityOnHand);
        const reserved = Number(s.quantityReserved);
        return {
          id: s.id,
          productId: s.productId,
          productName: s.product.name,
          sku: s.product.sku,
          quantityOnHand: onHand,
          quantityReserved: reserved,
          available: Math.max(0, onHand - reserved),
          updatedAt: s.updatedAt,
        };
      });

      res.json({
        ...warehouse,
        stockLevels: formattedStock,
      });
    } catch (error) {
      console.error('[inventory/warehouse/:id] Error getting warehouse:', error);
      res.status(500).json({ error: 'Failed to retrieve warehouse' });
    }
  }
);

/**
 * 3. PATCH /api/v1/internal/stock/:stockLevelId
 * Adjusts on-hand physical stock (simulates goods receipt/replenishment).
 */
inventoryRouter.patch(
  '/stock/:stockLevelId',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const stockLevelId = req.params.stockLevelId as string;
      const { quantityOnHand, increment } = req.body;

      const dataUpdate: any = {};
      if (increment !== undefined) {
        dataUpdate.quantityOnHand = { increment: Number(increment) };
      } else if (quantityOnHand !== undefined) {
        dataUpdate.quantityOnHand = Number(quantityOnHand);
      } else {
        res.status(400).json({ error: 'Either quantityOnHand or increment must be specified' });
        return;
      }

      const updated = await prisma.stockLevel.update({
        where: { id: stockLevelId },
        data: dataUpdate,
        include: {
          product: true,
          warehouse: true,
        },
      });

      // Check if any open backorders exist for this product that can now be resolved
      const backorders = await prisma.backorder.findMany({
        where: {
          quotationLine: { productId: updated.productId },
        },
        include: {
          quotation: true,
        },
      });

      const consolidatableBackorders = backorders.filter(
        (b) => Number(b.quantityBackordered) > Number(b.quantityFulfilledLater)
      );

      res.json({
        success: true,
        stockLevel: {
          id: updated.id,
          warehouseName: updated.warehouse.name,
          productName: updated.product.name,
          quantityOnHand: Number(updated.quantityOnHand),
          quantityReserved: Number(updated.quantityReserved),
          available: Number(updated.quantityOnHand) - Number(updated.quantityReserved),
        },
        pendingBackordersCount: consolidatableBackorders.length,
        consolidatableBackorders: consolidatableBackorders.map((b) => ({
          id: b.id,
          quoteNumber: b.quotation.quoteNumber,
          remainingQuantity: Number(b.quantityBackordered) - Number(b.quantityFulfilledLater),
        })),
      });
    } catch (error: any) {
      console.error('[inventory/stock/patch] Error updating stock level:', error);
      res.status(400).json({ error: error.message ?? 'Failed to update stock level' });
    }
  }
);

/**
 * 4. POST /api/v1/internal/allocations/:id/release
 * Cancels a reservation allocation and restores available stock (§6.29).
 */
inventoryRouter.post(
  '/allocations/:id/release',
  ...internalAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await releaseReservation(id, req.user!.userId);
      res.json({
        message: 'Stock reservation released successfully',
        ...result,
      });
    } catch (error: any) {
      console.error('[inventory/allocations/release] Error releasing allocation:', error);
      res.status(400).json({ error: error.message ?? 'Failed to release reservation' });
    }
  }
);
