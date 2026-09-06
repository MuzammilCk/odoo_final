import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testAlgorithm() {
  const quote = await prisma.quotation.findFirst({
    where: { quoteNumber: 'Q-1788646967860' },
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

  if (!quote) return;
  console.log('Testing for quote:', quote.quoteNumber);
  console.log('Cart lines:', quote.lines.map(l => `${l.product.name} ($${l.product.basePrice}) [${l.product.category?.name}]`));

  const existingProductIds = new Set(quote.lines.map((l) => l.productId));
  const cartCategoryMap = new Map<string, { categoryId: string; categoryName: string; maxPrice: number }>();
  for (const line of quote.lines) {
    const cat = (line.product as any)?.category;
    if (!cat) continue;
    const price = Number((line.product as any).basePrice);
    const existing = cartCategoryMap.get(cat.id);
    if (!existing || price > existing.maxPrice) {
      cartCategoryMap.set(cat.id, { categoryId: cat.id, categoryName: cat.name, maxPrice: price });
    }
  }

  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: { select: { id: true, name: true } } },
  });

  const candidates = activeProducts.filter((product) => {
    if (existingProductIds.has(product.id)) return false;
    const price = Number(product.basePrice);
    if (price <= 0) return false;
    return true;
  });

  // Co-purchase calculation
  const coPurchaseMap: Record<string, number> = {};

  // 1. Exact product co-purchases
  const relatedQuoteLines = await prisma.quotationLine.findMany({
    where: {
      productId: { in: Array.from(existingProductIds) },
      quotationId: { not: quote.id },
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

  // 2. Category-level co-purchases (affinity across similar products in the same category)
  const cartCategoryIdsList = Array.from(cartCategoryMap.keys());
  const categoryQuoteLines = await prisma.quotationLine.findMany({
    where: {
      product: { categoryId: { in: cartCategoryIdsList } },
      quotationId: { not: quote.id },
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

  const cartCategoryIds = new Set(cartCategoryMap.keys());

  const scored = candidates.map((candidate) => {
    const coPurchaseScore = coPurchaseMap[candidate.id] ?? 0;
    const candidatePrice = Number(candidate.basePrice);
    const inCartCategory = cartCategoryIds.has(candidate.category.id);
    const cartCategory = cartCategoryMap.get(candidate.category.id);

    let recommendationType: 'CROSS_SELL' | 'UPSELL';
    if (inCartCategory) {
      if (cartCategory && candidatePrice > cartCategory.maxPrice) {
        recommendationType = 'UPSELL';
      } else {
        return null;
      }
    } else {
      recommendationType = 'CROSS_SELL';
    }

    // Strategic promoted products — workspace companion & recurring software
    const nameLower = candidate.name.toLowerCase();
    const isPromoted =
      candidate.sku === 'CS-M365-STD-02' ||
      candidate.sku === 'SUB-CLOUD-LIC' ||
      nameLower.includes('dock') ||
      candidate.sku === 'PA-DOCK-01-08';
    const promotionBoost = isPromoted ? 3 : 0;
    const recommendationScore = coPurchaseScore + promotionBoost;

    let reason: string;
    if (recommendationType === 'UPSELL') {
      reason = `Upgrade path in ${cartCategory?.categoryName ?? 'same category'} — higher spec at $${candidatePrice.toFixed(0)}`;
    } else if (coPurchaseScore > 0) {
      reason = `Frequently bought together with items in this quote (${coPurchaseScore}× co-purchased)`;
    } else if (isPromoted) {
      reason = 'Promoted add-on — recurring revenue with strong margin';
    } else {
      reason = `Complements ${candidate.category.name} items in this order`;
    }

    return { candidate, recommendationScore, coPurchaseScore, promotionBoost, isPromoted, recommendationType, reason };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

  // Pick top recommendations with category diversity
  // Target: ensure top accessories (Peripherals), software (Subscriptions), and displays appear
  const selected: typeof scored = [];
  const selectedIds = new Set<string>();

  // Pass 1: Ensure top item from high-affinity categories when laptops/hardware are in cart
  const priorityCategories = [
    'Peripherals & Accessories',
    'Cloud Software Subscriptions',
    'Monitors & Displays',
    'Professional Services',
  ];

  for (const catName of priorityCategories) {
    const bestInCat = scored.find(
      (s) => s.candidate.category.name === catName && !selectedIds.has(s.candidate.id)
    );
    if (bestInCat) {
      selected.push(bestInCat);
      selectedIds.add(bestInCat.candidate.id);
    }
  }

  // Pass 2: Fill remaining slots with the highest remaining scores (max 2 per category overall)
  const categoryCounts = new Map<string, number>();
  selected.forEach(s => {
    categoryCounts.set(s.candidate.category.id, (categoryCounts.get(s.candidate.category.id) ?? 0) + 1);
  });

  for (const item of scored) {
    if (selected.length >= 5) break;
    if (selectedIds.has(item.candidate.id)) continue;
    const count = categoryCounts.get(item.candidate.category.id) ?? 0;
    if (count >= 2) continue;

    categoryCounts.set(item.candidate.category.id, count + 1);
    selected.push(item);
    selectedIds.add(item.candidate.id);
  }

  // Sort final 5 by recommendationScore descending
  selected.sort((a, b) => b.recommendationScore - a.recommendationScore);

  console.log('\n--- BALANCED FINAL 5 RECOMMENDATIONS ---');
  selected.forEach((r, idx) => {
    console.log(`${idx + 1}. [Score ${r.recommendationScore}] ${r.candidate.name} - $${r.candidate.basePrice} (${r.candidate.category.name}) ${r.isPromoted ? '★ Promoted' : ''}`);
    console.log(`   Reason: ${r.reason}`);
  });

  console.log('\n--- TOP 15 RAW SCORED ITEMS ---');
  scored.slice(0, 15).forEach((r, idx) => {
    console.log(`${idx + 1}. [Score ${r.recommendationScore}] ${r.candidate.name} - $${r.candidate.basePrice} (${r.candidate.category.name})`);
  });

  await prisma.$disconnect();
}

testAlgorithm().catch(console.error);
