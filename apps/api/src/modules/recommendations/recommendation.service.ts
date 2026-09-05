/**
 * Recommendation Service — Upsell & Cross-sell Recommendation Engine
 *
 * Spec refs: §6.22 (recommendation rules), §6.23 (ranking algorithm),
 *            §6.24 (margin delta calculation), §7.27 (recommendation surface)
 */

import { prisma } from '../../lib/prisma.js';

export interface RankedRecommendation {
  product: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    basePrice: number;
    taxRate: number;
    isSubscription: boolean;
    category: {
      id: string;
      name: string;
    };
  };
  recommendationScore: number;
  coPurchaseScore: number;
  promotionBoost: number;
  marginDelta: number;
  isPromoted: boolean;
}

/**
 * A5.2 — Candidate filtering:
 * 1. Loads quotation lines to identify products already in quote
 * 2. Fetches all active products
 * 3. Filters out products already in the quotation
 * 4. Filters out products below minimum margin threshold (default 10%)
 */
export async function getCandidates(quotationId: string, minMarginPercent = 10) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      lines: {
        select: { productId: true },
      },
    },
  });

  if (!quotation) {
    throw new Error('Quotation not found');
  }

  const existingProductIds = new Set(quotation.lines.map((l) => l.productId));

  // Get all active products with category
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: { select: { id: true, name: true } } },
  });

  // Filter candidates:
  // - Exclude products already on the quote (§6.23)
  // - Exclude products below minimum margin threshold (§6.22)
  const candidates = activeProducts.filter((product) => {
    if (existingProductIds.has(product.id)) {
      return false;
    }

    const price = Number(product.basePrice);
    if (price <= 0) return false;

    // Standard baseline cost heuristic (60% of base price = 40% margin)
    const estimatedCost = price * 0.6;
    const marginPercent = ((price - estimatedCost) / price) * 100;

    return marginPercent >= minMarginPercent;
  });

  return { quotation, existingProductIds, candidates };
}

/**
 * A5.3 — Scoring + ranking:
 * - co_purchase_score: number of times this product appeared alongside quote products in other quotes
 * - promotion_boost: +5 boost for strategic/subscription products
 * - recommendation_score: co_purchase_score + promotion_boost
 */
export async function scoreAndRank(
  candidates: Array<{
    id: string;
    sku: string;
    name: string;
    description: string | null;
    basePrice: any;
    taxRate: any;
    isSubscription: boolean;
    category: { id: string; name: string };
  }>,
  existingProductIds: Set<string>,
  quotationId: string,
) {
  // Find other quotations containing any of the existing products
  let coPurchaseMap: Record<string, number> = {};

  if (existingProductIds.size > 0) {
    const relatedQuoteLines = await prisma.quotationLine.findMany({
      where: {
        productId: { in: Array.from(existingProductIds) },
        quotationId: { not: quotationId },
      },
      select: { quotationId: true },
    });

    const relatedQuoteIds = Array.from(new Set(relatedQuoteLines.map((l) => l.quotationId)));

    if (relatedQuoteIds.length > 0) {
      // Count appearances of candidate products in those related quotations
      const candidateLines = await prisma.quotationLine.findMany({
        where: {
          quotationId: { in: relatedQuoteIds },
          productId: { in: candidates.map((c) => c.id) },
        },
        select: { productId: true },
      });

      for (const line of candidateLines) {
        coPurchaseMap[line.productId] = (coPurchaseMap[line.productId] ?? 0) + 1;
      }
    }
  }

  return candidates.map((candidate) => {
    const coPurchaseScore = coPurchaseMap[candidate.id] ?? 0;
    // Strategic promotion boost for subscriptions or cloud licenses
    const isPromoted =
      candidate.isSubscription ||
      candidate.name.toLowerCase().includes('cloud') ||
      candidate.name.toLowerCase().includes('pro');
    const promotionBoost = isPromoted ? 5 : 0;
    const recommendationScore = coPurchaseScore + promotionBoost;

    return {
      candidate,
      recommendationScore,
      coPurchaseScore,
      promotionBoost,
      isPromoted,
    };
  });
}

/**
 * A5.4 — Margin delta calculation (§6.24):
 * Calculates how adding 1 unit of candidate at base price changes the quote's margin %
 */
export function calculateMarginDelta(
  candidatePrice: number,
  candidateTaxRate: number,
  quotationGrandTotal: number,
  quotationMarginAmount: number,
  quotationMarginPercent: number,
): number {
  const candidateCost = candidatePrice * 0.6;
  const candidateTax = candidatePrice * (candidateTaxRate / 100);
  const candidateMargin = candidatePrice - candidateCost;

  const newGrandTotal = quotationGrandTotal + candidatePrice + candidateTax;
  const newMarginAmount = quotationMarginAmount + candidateMargin;
  const newMarginPercent = newGrandTotal > 0 ? (newMarginAmount / newGrandTotal) * 100 : 0;

  return Number((newMarginPercent - quotationMarginPercent).toFixed(2));
}

/**
 * Full Recommendation Pipeline (§7.27):
 * Orchestrates filtering, scoring, ranking, and margin delta calculation.
 */
export async function getRecommendations(
  quotationId: string,
  limit = 5,
): Promise<RankedRecommendation[]> {
  const { quotation, existingProductIds, candidates } = await getCandidates(quotationId);

  if (candidates.length === 0) {
    return [];
  }

  // Score and rank candidates
  const scored = await scoreAndRank(candidates, existingProductIds, quotationId);

  // Sort descending by recommendationScore
  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

  const grandTotal = Number(quotation.grandTotal);
  const marginAmount = Number(quotation.marginAmount);
  const marginPercent = Number(quotation.marginPercent);

  // Take top N and calculate margin delta
  const topCandidates = scored.slice(0, limit);

  return topCandidates.map((item) => {
    const price = Number(item.candidate.basePrice);
    const taxRate = Number(item.candidate.taxRate);
    const marginDelta = calculateMarginDelta(
      price,
      taxRate,
      grandTotal,
      marginAmount,
      marginPercent,
    );

    return {
      product: {
        id: item.candidate.id,
        sku: item.candidate.sku,
        name: item.candidate.name,
        description: item.candidate.description,
        basePrice: price,
        taxRate,
        isSubscription: item.candidate.isSubscription,
        category: item.candidate.category,
      },
      recommendationScore: item.recommendationScore,
      coPurchaseScore: item.coPurchaseScore,
      promotionBoost: item.promotionBoost,
      marginDelta,
      isPromoted: item.isPromoted,
    };
  });
}
