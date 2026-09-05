/**
 * Portal Middleware — Security boundary for the Customer Portal
 *
 * Spec refs: §8.20 (RBAC & ownership checks), §8.21 (portal isolation),
 *            §2.1 (Customer role boundary)
 */

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { Quotation } from '@prisma/client';

// Extend Express Request to attach loaded quotation for downstream handlers
declare global {
  namespace Express {
    interface Request {
      quotation?: Quotation & {
        customer?: {
          id: string;
          name: string;
          users?: Array<{ id: string }>;
        };
      };
    }
  }
}

/**
 * 1. requirePortalAccess
 * Restricts access exclusively to authenticated accounts with the CUSTOMER role.
 * Internal roles (SALES_REP, MANAGER, FINANCE_OPS, ADMIN) are rejected with 403.
 */
export function requirePortalAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.user.role !== 'CUSTOMER') {
    res.status(403).json({ error: 'Portal access denied' });
    return;
  }

  next();
}

/**
 * 2. requireQuotationOwnership
 * Validates that the requested quotation belongs to the authenticated customer organization.
 * Prevents cross-tenant data leakage (Customer A accessing Customer B's quotations).
 * Attaches the fetched quotation to req.quotation for downstream handlers.
 */
export async function requireQuotationOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = req.params.id as string;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Quotation ID is required' });
      return;
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            users: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!quotation) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    // Verify ownership: customerId matches JWT customerId OR current user belongs to quotation customer organization
    const matchesCustomer =
      Boolean(req.user.customerId) && quotation.customerId === req.user.customerId;
    const userBelongsToCustomer = Boolean(
      quotation.customer?.users?.some((user) => user.id === req.user?.userId)
    );

    if (!matchesCustomer && !userBelongsToCustomer) {
      res.status(403).json({ error: 'Not authorized for this quotation' });
      return;
    }

    req.quotation = quotation;
    next();
  } catch (error) {
    next(error);
  }
}
