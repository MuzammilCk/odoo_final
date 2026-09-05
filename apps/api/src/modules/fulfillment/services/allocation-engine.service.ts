/**
 * Allocation Engine Service — Warehouse fulfillment logic & greedy splitting
 *
 * Spec refs: §6.26–§6.28 (Warehouse allocation rules & greedy algorithm),
 *            §6.30–§6.31 (Backorders), §5.21 (FulfillmentAllocation), §5.22 (Backorder)
 */

import { prisma } from '../../../lib/prisma.js';
import {
  FulfillmentStatus,
  QuotationStatus,
  AuditAction,
} from '@prisma/client';
import {
  getAvailableStock,
  rankWarehouses,
  reserveStock,
  type StockAllocationItem,
} from '../../inventory/inventory.service.js';

export interface ProposedAllocationLine {
  lineId: string;
  productId: string;
  productName: string;
  quantityNeeded: number;
  allocations: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    shippingCostWeight: number;
  }>;
  backorderQuantity: number;
}

export interface AllocationRecommendation {
  quotationId: string;
  quoteNumber: string;
  lines: ProposedAllocationLine[];
  hasSplit: boolean;
  hasBackorder: boolean;
  summary: {
    totalNeeded: number;
    totalAllocated: number;
    totalBackordered: number;
  };
}

/**
 * Calculates a recommended warehouse allocation for all physical lines of a confirmed quotation.
 * Implements the greedy multi-warehouse allocation algorithm (§6.27).
 */
export async function calculateAllocation(quotationId: string): Promise<AllocationRecommendation> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      lines: {
        include: { product: true },
      },
    },
  });

  if (!quotation) {
    throw new Error(`Quotation ${quotationId} not found`);
  }

  const resultLines: ProposedAllocationLine[] = [];
  let hasSplit = false;
  let hasBackorder = false;
  let totalNeeded = 0;
  let totalAllocated = 0;
  let totalBackordered = 0;

  // We only allocate physical items (skip non-physical if any)
  for (const line of quotation.lines) {
    const qtyNeeded = Number(line.quantity);
    totalNeeded += qtyNeeded;

    const candidates = await getAvailableStock(line.productId);
    const ranked = rankWarehouses(candidates, qtyNeeded);

    let remaining = qtyNeeded;
    const lineAllocations: Array<{
      warehouseId: string;
      warehouseName: string;
      quantity: number;
      shippingCostWeight: number;
    }> = [];

    for (const wh of ranked) {
      if (remaining <= 0) break;
      if (wh.available <= 0) continue;

      const take = Math.min(wh.available, remaining);
      lineAllocations.push({
        warehouseId: wh.warehouseId,
        warehouseName: wh.warehouseName,
        quantity: take,
        shippingCostWeight: wh.shippingCostWeight,
      });

      remaining -= take;
      wh.available -= take; // Deduct locally for this calculation run
    }

    if (lineAllocations.length > 1) {
      hasSplit = true;
    }

    const backorderQty = remaining > 0 ? remaining : 0;
    if (backorderQty > 0) {
      hasBackorder = true;
    }

    const allocatedForLine = qtyNeeded - backorderQty;
    totalAllocated += allocatedForLine;
    totalBackordered += backorderQty;

    resultLines.push({
      lineId: line.id,
      productId: line.productId,
      productName: line.product?.name ?? line.descriptionSnapshot,
      quantityNeeded: qtyNeeded,
      allocations: lineAllocations,
      backorderQuantity: backorderQty,
    });
  }

  return {
    quotationId: quotation.id,
    quoteNumber: quotation.quoteNumber,
    lines: resultLines,
    hasSplit,
    hasBackorder,
    summary: {
      totalNeeded,
      totalAllocated,
      totalBackordered,
    },
  };
}

export interface AcceptAllocationPayload {
  allocations: Array<{
    lineId: string;
    warehouseId: string;
    quantity: number;
  }>;
}

/**
 * Accepts and commits a recommended or overridden warehouse allocation.
 * Atomically reserves physical stock with row-level locks, persists fulfillment allocations,
 * and creates backorders for any remaining shortfalls.
 */
export async function acceptAllocation(
  quotationId: string,
  payload?: AcceptAllocationPayload,
  userId?: string
) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      lines: {
        include: { product: true },
      },
    },
  });

  if (!quotation) {
    throw new Error('Quotation not found');
  }

  if (quotation.status !== QuotationStatus.CONFIRMED) {
    throw new Error(
      `Quotation must be in CONFIRMED status to allocate fulfillment (current: ${quotation.status})`
    );
  }

  // 1. Determine allocations: use payload override if provided, else compute recommendation
  let allocationItemsToReserve: StockAllocationItem[] = [];
  let lineAllocationMap: Array<{
    lineId: string;
    warehouseId: string;
    quantity: number;
    productId: string;
  }> = [];
  let backordersToCreate: Array<{
    lineId: string;
    remainingQuantity: number;
  }> = [];

  if (payload && payload.allocations && payload.allocations.length > 0) {
    for (const alloc of payload.allocations) {
      const line = quotation.lines.find((l) => l.id === alloc.lineId);
      if (!line) {
        throw new Error(`Line ${alloc.lineId} does not belong to quotation ${quotationId}`);
      }
      lineAllocationMap.push({
        lineId: alloc.lineId,
        warehouseId: alloc.warehouseId,
        quantity: alloc.quantity,
        productId: line.productId,
      });
      allocationItemsToReserve.push({
        warehouseId: alloc.warehouseId,
        productId: line.productId,
        quantity: alloc.quantity,
      });
    }

    // Check if any line has unallocated quantities for backorder
    for (const line of quotation.lines) {
      const totalForLine = lineAllocationMap
        .filter((a) => a.lineId === line.id)
        .reduce((sum, a) => sum + a.quantity, 0);
      const needed = Number(line.quantity);
      if (totalForLine < needed) {
        backordersToCreate.push({
          lineId: line.id,
          remainingQuantity: needed - totalForLine,
        });
      }
    }
  } else {
    // Automatically use recommended greedy allocation
    const rec = await calculateAllocation(quotationId);
    for (const line of rec.lines) {
      for (const a of line.allocations) {
        lineAllocationMap.push({
          lineId: line.lineId,
          warehouseId: a.warehouseId,
          quantity: a.quantity,
          productId: line.productId,
        });
        allocationItemsToReserve.push({
          warehouseId: a.warehouseId,
          productId: line.productId,
          quantity: a.quantity,
        });
      }
      if (line.backorderQuantity > 0) {
        backordersToCreate.push({
          lineId: line.lineId,
          remainingQuantity: line.backorderQuantity,
        });
      }
    }
  }

  // 2. Transactionally reserve physical stock using row-level locking
  await reserveStock(allocationItemsToReserve, userId, quotationId);

  // 3. Persist FulfillmentAllocation and Backorder records
  return await prisma.$transaction(async (tx) => {
    const createdAllocations = [];
    for (const alloc of lineAllocationMap) {
      const created = await tx.fulfillmentAllocation.create({
        data: {
          quotationId,
          quotationLineId: alloc.lineId,
          warehouseId: alloc.warehouseId,
          quantityAllocated: alloc.quantity,
          status: FulfillmentStatus.SPLIT_PENDING,
          estimatedShipmentCost: 0,
        },
      });
      createdAllocations.push(created);
    }

    const createdBackorders = [];
    for (const bo of backordersToCreate) {
      const created = await tx.backorder.create({
        data: {
          quotationId,
          quotationLineId: bo.lineId,
          quantityBackordered: bo.remainingQuantity,
        },
      });
      createdBackorders.push(created);
    }

    // Audit log
    if (userId) {
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.FULFILLMENT_CREATED,
          entityType: 'quotation',
          entityId: quotationId,
          quotationId,
          metadata: {
            action: 'ALLOCATIONS_COMMITTED',
            allocationsCount: createdAllocations.length,
            backordersCount: createdBackorders.length,
          },
        },
      });
    }

    return {
      success: true,
      allocations: createdAllocations,
      backorders: createdBackorders,
    };
  });
}
