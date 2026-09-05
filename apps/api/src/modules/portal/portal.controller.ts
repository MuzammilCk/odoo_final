/**
 * Portal Controller — Customer-facing REST endpoints
 *
 * Spec refs: §8.21 (Portal isolation & hard security boundary),
 *            §7.2 (Customer Portal API surface), §6.20–§6.21
 *
 * Registered in apps/api/src/index.ts under /api/v1/portal
 *
 * SECURITY BOUNDARY:
 * NEVER expose internal margin, estimated cost, discount overages,
 * blended risk scores, or approval history in these endpoints.
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { QuotationStatus } from '@prisma/client';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requirePortalAccess, requireQuotationOwnership } from './portal.middleware.js';

export const portalRouter = Router();

// Only these statuses may be viewed by customers per §6.6 / §8.21
const CUSTOMER_VISIBLE_STATUSES: QuotationStatus[] = [
  QuotationStatus.APPROVED,
  QuotationStatus.UNDER_NEGOTIATION,
  QuotationStatus.CONFIRMED,
];

/**
 * 1. GET /api/v1/portal/quotations
 * Lists customer-visible quotations for the authenticated customer organization.
 */
portalRouter.get(
  '/quotations',
  authenticateToken,
  requirePortalAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      let customerId = user.customerId;

      // If customerId is not present directly on JWT, fetch from DB
      if (!customerId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { customerId: true },
        });
        customerId = dbUser?.customerId ?? null;
      }

      if (!customerId) {
        res.status(403).json({ error: 'No customer organization associated with this account' });
        return;
      }

      const quotations = await prisma.quotation.findMany({
        where: {
          customerId,
          status: { in: CUSTOMER_VISIBLE_STATUSES },
        },
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          grandTotal: true,
          currencyCode: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Explicitly return ONLY customer-safe fields (providing snake_case + camelCase)
      const safeQuotations = quotations.map((q) => ({
        id: q.id,
        quote_number: q.quoteNumber,
        quoteNumber: q.quoteNumber,
        status: q.status,
        grand_total: Number(q.grandTotal),
        grandTotal: Number(q.grandTotal),
        currency_code: q.currencyCode,
        currencyCode: q.currencyCode,
        created_at: q.createdAt,
        createdAt: q.createdAt,
      }));

      res.json(safeQuotations);
    } catch (error) {
      console.error('[portal/quotations] Error listing portal quotations:', error);
      res.status(500).json({ error: 'Failed to retrieve quotations' });
    }
  }
);

/**
 * 2. GET /api/v1/portal/quotations/:id
 * Fetches single quotation with lines, enforcing tenant ownership and customer-safe projection.
 */
portalRouter.get(
  '/quotations/:id',
  authenticateToken,
  requirePortalAccess,
  requireQuotationOwnership,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const quotation = await prisma.quotation.findUnique({
        where: { id },
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          currencyCode: true,
          subtotal: true,
          discountTotal: true,
          taxTotal: true,
          grandTotal: true,
          createdAt: true,
          lines: {
            select: {
              id: true,
              descriptionSnapshot: true,
              quantity: true,
              unitPrice: true,
              discountPercent: true,
              discountAmount: true,
              lineTotal: true,
              product: {
                select: {
                  name: true,
                  isSubscription: true,
                },
              },
            },
          },
        },
      });

      if (!quotation) {
        res.status(404).json({ error: 'Quotation not found' });
        return;
      }

      // Check that status is permissible for customer viewing
      if (!CUSTOMER_VISIBLE_STATUSES.includes(quotation.status)) {
        res.status(403).json({ error: 'Quotation is not available for customer viewing' });
        return;
      }

      // Format lines with explicit projection (exclude estimatedUnitCost, margins, risk, etc.)
      const formattedLines = quotation.lines.map((line) => {
        const productName = line.product?.name ?? line.descriptionSnapshot;
        const lineType = line.product?.isSubscription ? 'RECURRING' : 'ONE_TIME';

        return {
          id: line.id,
          product_name: productName,
          productName,
          name: productName,
          quantity: Number(line.quantity),
          unit_price: Number(line.unitPrice),
          unitPrice: Number(line.unitPrice),
          discount_percent: Number(line.discountPercent),
          discountPercent: Number(line.discountPercent),
          discount_amount: Number(line.discountAmount),
          discountAmount: Number(line.discountAmount),
          line_total: Number(line.lineTotal),
          lineTotal: Number(line.lineTotal),
          line_type: lineType,
          lineType,
        };
      });

      const safeQuotation = {
        id: quotation.id,
        quote_number: quotation.quoteNumber,
        quoteNumber: quotation.quoteNumber,
        status: quotation.status,
        currency_code: quotation.currencyCode,
        currencyCode: quotation.currencyCode,
        subtotal: Number(quotation.subtotal),
        discount_total: Number(quotation.discountTotal),
        discountTotal: Number(quotation.discountTotal),
        tax_total: Number(quotation.taxTotal),
        taxTotal: Number(quotation.taxTotal),
        grand_total: Number(quotation.grandTotal),
        grandTotal: Number(quotation.grandTotal),
        created_at: quotation.createdAt,
        createdAt: quotation.createdAt,
        lines: formattedLines,
      };

      res.json(safeQuotation);
    } catch (error) {
      console.error('[portal/quotations/:id] Error fetching quotation details:', error);
      res.status(500).json({ error: 'Failed to retrieve quotation details' });
    }
  }
);
