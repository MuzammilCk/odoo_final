/**
 * Inventory Service — Concurrency-critical warehouse stock management
 *
 * Spec refs: §6.28 (Warehouse allocation), §8.16 (Concurrency control & row-level locking),
 *            §6.2 rules 11–13 (Available stock = on_hand - reserved), §5.20 (stock_levels table)
 *
 * CRITICAL CONCURRENCY ARCHITECTURE:
 * Stock reservations use PostgreSQL row-level locks via `SELECT ... FOR UPDATE`
 * inside an interactive transaction. This guarantees that concurrent transactions
 * serialize access to the same stock rows, preventing double-reservations and race conditions.
 */

import { prisma } from '../../lib/prisma.js';
import { Prisma, AuditAction } from '@prisma/client';

export interface StockAllocationItem {
  warehouseId: string;
  productId: string;
  quantity: number;
}

export interface ReserveStockResult {
  success: boolean;
  allocations: StockAllocationItem[];
}

/**
 * Transactionally reserves physical stock across one or more warehouses.
 *
 * Concurrency Guarantees:
 * 1. Obtains explicit exclusive row-level locks (`SELECT ... FOR UPDATE`) on target `stock_levels` rows.
 * 2. Orders row lock acquisition deterministically by `(warehouse_id, product_id)` to prevent deadlocks.
 * 3. Re-reads and validates current available stock (`quantity_on_hand - quantity_reserved`) inside the lock.
 * 4. Increments `quantity_reserved` atomically within the same transaction.
 * 5. Writes an immutable audit trail entry before releasing locks upon commit.
 */
export async function reserveStock(
  allocations: StockAllocationItem[],
  userId?: string,
  quotationId?: string
): Promise<ReserveStockResult> {
  if (!allocations || allocations.length === 0) {
    return { success: true, allocations: [] };
  }

  // Validate allocation quantities are positive
  for (const allocation of allocations) {
    if (allocation.quantity <= 0) {
      throw new Error(
        `Invalid allocation quantity: ${allocation.quantity}. Must be greater than 0.`
      );
    }
  }

  // Execute within an interactive transaction to hold locks until commit
  return await prisma.$transaction(async (tx) => {
    // Step 1: Lock the stock rows to prevent concurrent modifications.
    // We sort the pairs to guarantee a deterministic locking order and prevent deadlocks.
    const sortedAllocations = [...allocations].sort((a, b) => {
      const cmp = a.warehouseId.localeCompare(b.warehouseId);
      return cmp !== 0 ? cmp : a.productId.localeCompare(b.productId);
    });

    const valueTuples = sortedAllocations.map(
      (a) => Prisma.sql`(${a.warehouseId}::uuid, ${a.productId}::uuid)`
    );

    // Use raw SQL with FOR UPDATE because Prisma does not support SELECT FOR UPDATE natively
    const lockedStocks = await tx.$queryRaw<
      Array<{
        id: string;
        warehouse_id: string;
        product_id: string;
        quantity_on_hand: string | number;
        quantity_reserved: string | number;
      }>
    >`
      SELECT id, warehouse_id, product_id, quantity_on_hand, quantity_reserved
      FROM stock_levels
      WHERE (warehouse_id, product_id) IN (VALUES ${Prisma.join(valueTuples)})
      ORDER BY warehouse_id, product_id
      FOR UPDATE
    `;

    // Step 2: Validate each allocation against CURRENT available stock inside the transaction
    // Aggregate requested quantities per (warehouseId, productId) in case duplicates exist in batch
    const totalRequestedByPair = new Map<string, number>();
    for (const allocation of allocations) {
      const key = `${allocation.warehouseId}:${allocation.productId}`;
      totalRequestedByPair.set(
        key,
        (totalRequestedByPair.get(key) ?? 0) + allocation.quantity
      );
    }

    for (const [key, requestedQty] of totalRequestedByPair.entries()) {
      const [warehouseId, productId] = key.split(':');
      const stock = lockedStocks.find(
        (s) => s.warehouse_id === warehouseId && s.product_id === productId
      );

      if (!stock) {
        throw new Error(
          `No stock record found for warehouse ${warehouseId} and product ${productId}`
        );
      }

      const onHand = Number(stock.quantity_on_hand);
      const reserved = Number(stock.quantity_reserved);
      const available = onHand - reserved;

      if (available < requestedQty) {
        throw new Error(
          `Insufficient stock: ${available} available, ${requestedQty} requested for product ${productId} in warehouse ${warehouseId}`
        );
      }
    }

    // Step 3: Reserve the stock by incrementing quantity_reserved
    for (const allocation of allocations) {
      await tx.stockLevel.update({
        where: {
          warehouseId_productId: {
            warehouseId: allocation.warehouseId,
            productId: allocation.productId,
          },
        },
        data: {
          quantityReserved: { increment: allocation.quantity },
        },
      });
    }

    // Step 4: Audit the reservation action
    let actorId = userId;
    if (!actorId) {
      const sysUser = await tx.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      actorId = sysUser?.id;
    }

    if (actorId) {
      for (const allocation of allocations) {
        const stock = lockedStocks.find(
          (s) =>
            s.warehouse_id === allocation.warehouseId && s.product_id === allocation.productId
        );
        if (stock) {
          await tx.auditLog.create({
            data: {
              actorUserId: actorId,
              action: AuditAction.WAREHOUSE_UPDATED,
              entityType: 'stock_level',
              entityId: stock.id,
              quotationId: quotationId ?? null,
              metadata: {
                action: 'STOCK_RESERVED',
                warehouseId: allocation.warehouseId,
                productId: allocation.productId,
                quantityReserved: allocation.quantity,
              },
            },
          });
        }
      }
    }

    return {
      success: true,
      allocations,
    };
  });
}
