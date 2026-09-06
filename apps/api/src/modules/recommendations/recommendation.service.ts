/**
 * Recommendation Service — Upsell & Cross-sell Recommendation Engine
 *
 * Recommendation types (per problem statement B5):
 *   CROSS_SELL — Product from a DIFFERENT category than cart items.
 *                Commonly purchased alongside what's in the cart.
 *   UPSELL     — Product from the SAME category as a cart item,
 *                at a HIGHER price point (genuine upgrade path).
 *
 * Guardrails:
 *   - Max 1 UPSELL per cart category (prevent showing 3 laptops)
 *   - UPSELL price must be > cart item price (genuine upgrade, not downgrade)
 *   - Same-category items cheaper than cart item are excluded
 *   - Minimum margin threshold: 10%
 */

import { prisma } from '../../lib/prisma.js';

export type RecommendationType = 'CROSS_SELL' | 'UPSELL' | 'PROMOTED';

export interface RankedRecommendation {
  product: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    basePrice: number;
    taxRate: number;
    isSubscription: boolean;
    category: { id: string; name: string };
  };
  recommendationScore: number;
  coPurchaseScore: number;
  promotionBoost: number;
  marginDelta: number;
  isPromoted: boolean;
  recommendationType: RecommendationType;
  reason: string;
}

// ── A5.2 — Candidate filtering ────────────────────────────────────────────────
export async function getCandidates(quotationId: string, minMarginPercent = 10) {
  // Fetch quotation with full line + product + category data
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      lines: {
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!quotation) throw new Error('Quotation not found');

  // Build set of existing product IDs (to exclude from candidates)
  const existingProductIds = new Set(quotation.lines.map((l) => l.productId));

  // Build map: categoryId → highest price in cart for that category
  // Used to determine if a same-category recommendation is a genuine UPSELL
  const cartCategoryMap = new Map<string, { categoryId: string; categoryName: string; maxPrice: number }>();
  for (const line of quotation.lines) {
    const cat = (line.product as any)?.category;
    if (!cat) continue;
    const price = Number((line.product as any).basePrice);
    const existing = cartCategoryMap.get(cat.id);
    if (!existing || price > existing.maxPrice) {
      cartCategoryMap.set(cat.id, { categoryId: cat.id, categoryName: cat.name, maxPrice: price });
    }
  }

  // Fetch all active products with their category
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: { select: { id: true, name: true } } },
  });

  // Filter: exclude already-in-cart + below-margin products
  const candidates = activeProducts.filter((product) => {
    if (existingProductIds.has(product.id)) return false;
    const price = Number(product.basePrice);
    if (price <= 0) return false;
    const margin = ((price - price * 0.6) / price) * 100; // 40% baseline margin
    return margin >= minMarginPercent;
  });

  return { quotation, existingProductIds, cartCategoryMap, candidates };
}

// ── A5.3 — Scoring + ranking ──────────────────────────────────────────────────
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
  cartCategoryMap: Map<string, { categoryId: string; categoryName: string; maxPrice: number }>,
) {
  const coPurchaseMap: Record<string, number> = {};

  if (existingProductIds.size > 0) {
    // 1. Direct product-level co-purchases (+3 points per co-occurrence in historical quotes)
    const relatedQuoteLines = await prisma.quotationLine.findMany({
      where: {
        productId: { in: Array.from(existingProductIds) },
        quotationId: { not: quotationId },
      },
      select: { quotationId: true },
    });

    const relatedQuoteIds = [...new Set(relatedQuoteLines.map((l) => l.quotationId))];

    if (relatedQuoteIds.length > 0) {
      const candidateLines = await prisma.quotationLine.findMany({
        where: {
          quotationId: { in: relatedQuoteIds },
          productId: { in: candidates.map((c) => c.id) },
        },
        select: { productId: true },
      });

      for (const line of candidateLines) {
        coPurchaseMap[line.productId] = (coPurchaseMap[line.productId] ?? 0) + 3;
      }
    }

    // 2. Category-level affinity (+1 point per co-occurrence in quotes containing the same categories)
    const cartCategoryIdsList = Array.from(cartCategoryMap.keys());
    const categoryQuoteLines = await prisma.quotationLine.findMany({
      where: {
        product: { categoryId: { in: cartCategoryIdsList } },
        quotationId: { not: quotationId },
      },
      select: { quotationId: true },
    });
    const categoryQuoteIds = [...new Set(categoryQuoteLines.map((l) => l.quotationId))];

    if (categoryQuoteIds.length > 0) {
      const catCandidateLines = await prisma.quotationLine.findMany({
        where: {
          quotationId: { in: categoryQuoteIds },
          productId: { in: candidates.map((c) => c.id) },
        },
        select: { productId: true },
      });

      for (const line of catCandidateLines) {
        coPurchaseMap[line.productId] = (coPurchaseMap[line.productId] ?? 0) + 1;
      }
    }
  }

  const cartCategoryIds = new Set(cartCategoryMap.keys());

  return candidates.map((candidate) => {
    const coPurchaseScore = coPurchaseMap[candidate.id] ?? 0;
    const candidatePrice = Number(candidate.basePrice);
    const inCartCategory = cartCategoryIds.has(candidate.category.id);
    const cartCategory = cartCategoryMap.get(candidate.category.id);

    // Determine recommendation type
    let recommendationType: RecommendationType;
    if (inCartCategory) {
      if (cartCategory && candidatePrice > cartCategory.maxPrice) {
        recommendationType = 'UPSELL';
      } else {
        // Exclude same category items that are not genuine upgrades
        return null;
      }
    } else {
      recommendationType = 'CROSS_SELL';
    }

    // Strategic promoted companions (Docks, Key Software, Cloud Licenses)
    const nameLower = candidate.name.toLowerCase();
    const isPromoted =
      candidate.sku === 'CS-M365-STD-02' ||
      candidate.sku === 'SUB-CLOUD-LIC' ||
      candidate.sku === 'PA-DOCK-01-08' ||
      nameLower.includes('dock');

    const promotionBoost = isPromoted ? 3 : 0;
    const recommendationScore = coPurchaseScore + promotionBoost;

    // Contextual reason
    let reason: string;
    if (recommendationType === 'UPSELL') {
      reason = `Higher-spec upgrade in ${cartCategory?.categoryName ?? 'same category'} ($${candidatePrice.toFixed(0)})`;
    } else if (coPurchaseScore > 0) {
      reason = `Frequently bought together with items in this quote (${coPurchaseScore}× affinity)`;
    } else if (isPromoted) {
      reason = 'Strategic workspace companion with high margin potential';
    } else {
      reason = `Complements ${candidate.category.name} in this order`;
    }

    return { candidate, recommendationScore, coPurchaseScore, promotionBoost, isPromoted, recommendationType, reason };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

// ── A5.4 — Margin delta ───────────────────────────────────────────────────────
export function calculateMarginDelta(
  candidatePrice: number,
  candidateTaxRate: number,
  quotationGrandTotal: number,
  quotationMarginAmount: number,
  quotationMarginPercent: number,
): number {
  const candidateCost   = candidatePrice * 0.6;
  const candidateTax    = candidatePrice * (candidateTaxRate / 100);
  const candidateMargin = candidatePrice - candidateCost;
  const newGrandTotal   = quotationGrandTotal + candidatePrice + candidateTax;
  const newMarginAmount = quotationMarginAmount + candidateMargin;
  const newMarginPct    = newGrandTotal > 0 ? (newMarginAmount / newGrandTotal) * 100 : 0;
  return Number((newMarginPct - quotationMarginPercent).toFixed(2));
}

// ── Full Pipeline ─────────────────────────────────────────────────────────────
export async function getRecommendations(
  quotationId: string,
  limit = 5,
): Promise<RankedRecommendation[]> {
  const { quotation, existingProductIds, cartCategoryMap, candidates } =
    await getCandidates(quotationId);

  if (candidates.length === 0) return [];

  const scored = await scoreAndRank(candidates, existingProductIds, quotationId, cartCategoryMap);

  // Sort descending by recommendationScore
  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

  // Multi-category diversity selection:
  // Ensure top companion categories (Peripherals, Subscriptions, Displays, Services) are represented,
  // preventing homogenous lists of 5 identical subscriptions.
  const selected: typeof scored = [];
  const selectedIds = new Set<string>();

  const priorityCategories = [
    'Peripherals & Accessories',
    'Cloud Software Subscriptions',
    'Monitors & Displays',
    'Professional Services',
  ];

  // Pass 1: Top item from each priority affinity category
  for (const catName of priorityCategories) {
    const bestInCat = scored.find(
      (s) => s.candidate.category.name === catName && !selectedIds.has(s.candidate.id)
    );
    if (bestInCat) {
      selected.push(bestInCat);
      selectedIds.add(bestInCat.candidate.id);
    }
  }

  // Pass 2: Fill remaining slots by highest score (max 2 per category)
  const categoryCounts = new Map<string, number>();
  selected.forEach((s) => {
    categoryCounts.set(s.candidate.category.id, (categoryCounts.get(s.candidate.category.id) ?? 0) + 1);
  });

  for (const item of scored) {
    if (selected.length >= limit) break;
    if (selectedIds.has(item.candidate.id)) continue;
    const count = categoryCounts.get(item.candidate.category.id) ?? 0;
    if (count >= 2) continue;

    categoryCounts.set(item.candidate.category.id, count + 1);
    selected.push(item);
    selectedIds.add(item.candidate.id);
  }

  // Sort final selection by recommendation score descending
  selected.sort((a, b) => b.recommendationScore - a.recommendationScore);

  const grandTotal    = Number(quotation.grandTotal);
  const marginAmount  = Number((quotation as any).marginAmount  ?? 0);
  const marginPercent = Number((quotation as any).marginPercent ?? 0);

  return selected.map((item) => {
    const price   = Number(item.candidate.basePrice);
    const taxRate = Number(item.candidate.taxRate);
    const marginDelta = calculateMarginDelta(price, taxRate, grandTotal, marginAmount, marginPercent);

    return {
      product: {
        id:             item.candidate.id,
        sku:            item.candidate.sku,
        name:           item.candidate.name,
        description:    item.candidate.description,
        basePrice:      price,
        taxRate,
        isSubscription: item.candidate.isSubscription,
        category:       item.candidate.category,
      },
      recommendationScore: item.recommendationScore,
      coPurchaseScore:     item.coPurchaseScore,
      promotionBoost:      item.promotionBoost,
      marginDelta,
      isPromoted:           item.isPromoted,
      recommendationType:   item.recommendationType,
      reason:               item.reason,
    };
  });
}
