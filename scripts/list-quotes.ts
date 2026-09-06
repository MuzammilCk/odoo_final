import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const quotations = await prisma.quotation.findMany({
    include: {
      customer: { select: { name: true } },
      negotiationRequests: {
        include: { requestedBy: true },
      },
      lines: {
        include: { product: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${quotations.length} quotations:`);
  for (const q of quotations) {
    console.log(`- [${q.id}] ${q.quoteNumber} (v${q.currentVersion}) | Status: ${q.status} | Customer: ${q.customer?.name} | Negotiations: ${q.negotiationRequests.length}`);
    for (const n of q.negotiationRequests) {
      console.log(`    -> Neg [${n.id}] ${n.negotiationType} status=${n.status} proposedDisc=${n.requestedDiscountPercent}% msg="${n.message}"`);
    }
  }
}

main().finally(() => prisma.$disconnect());
