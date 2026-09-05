import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSeedSnapshots() {
  console.log('🔄 Checking approval requests with partial snapshots...');
  const approvalRequests = await prisma.approvalRequest.findMany({
    include: {
      quotation: {
        include: {
          customer: {
            include: { discountTier: true },
          },
          lines: {
            include: { product: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  for (const req of approvalRequests) {
    const q = req.quotation;
    if (!q) continue;

    const fullSnapshot = {
      quotationId: q.id,
      quoteNumber: q.quoteNumber,
      version: q.currentVersion,
      subtotal: Number(q.subtotal),
      discountTotal: Number(q.discountTotal),
      taxTotal: Number(q.taxTotal),
      grandTotal: Number(q.grandTotal),
      marginAmount: Number(q.marginAmount),
      marginPercent: Number(q.marginPercent),
      riskScore: Number(req.riskScore),
      riskLevel: req.riskLevel,
      customer: q.customer,
      lines: q.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        product: l.product,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent),
        discountAmount: Number(l.discountAmount),
        taxAmount: Number(l.taxAmount),
        allowedDiscountPercent: Number(l.allowedDiscountPercent ?? 0),
        discountOveragePercent: Number(l.discountOveragePercent ?? 0),
        lineSubtotal: Number(l.lineTotal),
      })),
    };

    await prisma.approvalRequest.update({
      where: { id: req.id },
      data: { termsSnapshot: fullSnapshot },
    });

    console.log(`✅ Synced termsSnapshot for quotation ${q.quoteNumber} (${q.lines.length} lines, grand total: $${q.grandTotal})`);
  }
}

fixSeedSnapshots()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
