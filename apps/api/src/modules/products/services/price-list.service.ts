/**
 * PriceListService — Contract 2
 *
 * Spec refs: §6.8 (price resolution rule), §5.12 (price_list_entries table)
 *
 * Contract 2: Lane A calls resolvePrice() when a sales rep adds a product to a
 * quotation line. This service is the single source of truth for unit pricing.
 *
 * Resolution chain (§6.8):
 *   price_list_entries (productId + discountTierId + currencyCode match)
 *     → found  : return entry.price   (source: 'PRICE_LIST')
 *     → missing: return product.basePrice  (source: 'BASE')
 */

import { prisma } from '../../../lib/prisma.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ResolvedPrice {
  unitPrice: number;
  source: 'PRICE_LIST' | 'BASE';
}

// ── Service ────────────────────────────────────────────────────────────────────

/**
 * Resolve the correct unit price for a product given the customer's discount
 * tier and the quotation currency.
 *
 * Steps:
 *  1. Look for an active price_list_entry matching all three keys.
 *  2. If found  → return that price (source: 'PRICE_LIST').
 *  3. If not    → fall back to product.basePrice (source: 'BASE').
 *
 * Note: The current schema stores a single `price` per (product, tier, currency)
 * without date windows. If date-window columns are added in a future migration,
 * add `validFrom <= NOW() AND (validTo IS NULL OR validTo >= NOW())` here.
 *
 * @throws 404-tagged error if the product does not exist.
 */
export async function resolvePrice(
  productId: string,
  discountTierId: string,
  currencyCode: string,
): Promise<ResolvedPrice> {
  // Step 1 — look for a tier/currency-specific price list entry (§5.12)
  const entry = await prisma.priceListEntry.findUnique({
    where: {
      productId_discountTierId_currencyCode: {
        productId,
        discountTierId,
        currencyCode,
      },
    },
  });

  if (entry) {
    // Step 2 — price list hit: return the negotiated tier price
    return { unitPrice: Number(entry.price), source: 'PRICE_LIST' };
  }

  // Step 3 — no matching entry: fall back to product base price (§6.8)
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { basePrice: true },
  });

  if (!product) {
    throw Object.assign(
      new Error(`Product ${productId} not found`),
      { status: 404 },
    );
  }

  return { unitPrice: Number(product.basePrice), source: 'BASE' };
}
