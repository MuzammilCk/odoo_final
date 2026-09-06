import { PrismaClient } from '@prisma/client';
import { getRecommendations } from '../apps/api/src/modules/recommendations/recommendation.service.js';

const p = new PrismaClient();

async function main() {
  const quotes = await p.quotation.findMany({
    include: {
      lines: {
        include: {
          product: {
            include: { category: true }
          }
        }
      }
    }
  });

  const quote = await p.quotation.findFirst({
    where: { quoteNumber: 'Q-1788646967860' },
    include: {
      lines: {
        include: {
          product: { include: { category: true } }
        }
      }
    }
  });

  if (!quote) return;
  console.log('Cart items:', quote.lines.map(l => l.product.name));

  const recs = await getRecommendations(quote.id, 15);
  console.log('\nTop 15 recommendations:');
  recs.forEach((r, idx) => {
    console.log(`${idx + 1}. [Score ${r.recommendationScore}] (coPurchase=${r.coPurchaseScore}, boost=${r.promotionBoost}) ${r.product.name} - $${r.product.basePrice} (${r.product.category.name})`);
  });

  await p.$disconnect();
}

main().catch(console.error);
