/**
 * Backorder Service — Management and consolidation of unfulfilled order lines
 *
 * Spec refs: §6.30–§6.32 (Backorder lifecycle & inventory consolidation),
 *            §5.22 (backorders table), §5.28 (AuditLog)
 */

import { prisma } from '../../lib/prisma.js';
import {
  AuditAction,
  FulfillmentStatus,
} from '@prisma/client';
import {
  getAvailableStock,
  reserveStock,
} from '../inventory/inventory.service.js';

export async function listOpenBackorders() {
  const backorders = await prisma.backorder.findMany({
    include: {
      quotation: {
        include: { customer: { select: { id: true, name: true } } },
      },
      quotationLine: {
        include: { product: true },
      },
      fulfillmentAllocation: {
        include: { warehouse: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return backorders
    .map((b) => {
      const backordered = Number(b.quantityBackordered);
      const fulfilled = Number(b.quantityFulfilledLater);
      const remaining = Math.max(0, backordered - fulfilled);

      return {
        id: b.id,
        quotationId: b.quotationId,
        quoteNumber: b.quotation.quoteNumber,
        customerName: b.quotation.customer.name,
        productId: b.quotationLine.productId,
        productName: b.quotationLine.product.name,
        quantityBackordered: backordered,
        quantityFulfilledLater: fulfilled,
        remainingQuantity: remaining,
        isFullyResolved: remaining === 0,
        createdAt: b.createdAt,
      };
    })
    .filter((b) => !b.isFullyResolved);
}

/**
 * Consolidates an open backorder when new stock becomes available in a warehouse (§6.32).
 */
export async function consolidateBackorder(
  backorderId: string,
  targetWarehouseId?: string,
  userId?: string
) {
  const backorder = await prisma.backorder.findUnique({
    where: { id: backorderId },
    include: {
      quotationLine: {
        include: { product: true },
      },
      quotation: true,
    },
  });

  if (!backorder) {
    throw new Error('Backorder record not found');
  }

  const backordered = Number(backorder.quantityBackordered);
  const fulfilled = Number(backorder.quantityFulfilledLater);
  const remaining = Math.max(0, backordered - fulfilled);

  if (remaining <= 0) {
    throw new Error('Backorder is already fully resolved');
  }

  // Check available stock
  const candidates = await getAvailableStock(backorder.quotationLine.productId);
  let chosenWarehouse = candidates.find((c) => c.warehouseId === targetWarehouseId && c.available > 0);
  if (!chosenWarehouse) {
    chosenWarehouse = candidates.find((c) => c.available > 0);
  }

  if (!chosenWarehouse || chosenWarehouse.available <= 0) {
    throw new Error('No available stock currently exists to consolidate this backorder');
  }

  const allocQuantity = Math.min(chosenWarehouse.available, remaining);

  // Reserve stock
  await reserveStock(
    [
      {
        warehouseId: chosenWarehouse.warehouseId,
        productId: backorder.quotationLine.productId,
        quantity: allocQuantity,
      },
    ],
    userId,
    backorder.quotationId
  );

  return await prisma.$transaction(async (tx) => {
    // 1. Create fulfillment allocation for the newly available stock
    const allocation = await tx.fulfillmentAllocation.create({
      data: {
        quotationId: backorder.quotationId,
        quotationLineId: backorder.quotationLineId,
        warehouseId: chosenWarehouse!.warehouseId,
        quantityAllocated: allocQuantity,
        status: FulfillmentStatus.SPLIT_PENDING,
      },
    });

    // 2. Increment fulfilled later
    const updatedBackorder = await tx.backorder.update({
      where: { id: backorderId },
      data: {
        quantityFulfilledLater: { increment: allocQuantity },
      },
    });

    // 3. Audit log
    if (userId) {
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.BACKORDER_CONSOLIDATED,
          entityType: 'backorder',
          entityId: backorderId,
          quotationId: backorder.quotationId,
          metadata: {
            action: 'BACKORDER_CONSOLIDATED',
            warehouseId: chosenWarehouse!.warehouseId,
            allocatedQuantity: allocQuantity,
            remainingShortfall: remaining - allocQuantity,
          },
        },
      });
    }

    return {
      success: true,
      allocatedQuantity: allocQuantity,
      remainingQuantity: remaining - allocQuantity,
      allocation,
      backorder: updatedBackorder,
    };
  });
}
