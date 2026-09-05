import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function purgeAllQuotationsAndTransactions() {
  console.log('🧹 Purging all quotations, lines, invoices, and transactions...');
  await prisma.$transaction(async (tx) => {
    await tx.creditNote.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.backorder.deleteMany({});
    await tx.fulfillmentAllocation.deleteMany({});
    await tx.subscriptionInstance.deleteMany({});
    await tx.negotiationRequest.deleteMany({});
    await tx.approvalStep.deleteMany({});
    await tx.approvalRequest.deleteMany({});
    await tx.dealHealthFlag.deleteMany({});
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { quotationId: { not: null } },
          {
            entityType: {
              in: [
                'quotation',
                'quotation_line',
                'approval_step',
                'approval_request',
                'negotiation_request',
                'subscription_instances',
                'deal_health_flags',
                'fulfillment_allocations',
                'backorders',
                'invoices',
              ],
            },
          },
        ],
      },
    });
    await tx.quotationLine.deleteMany({});
    await tx.quotation.deleteMany({});
    await tx.stockLevel.updateMany({
      data: { quantityReserved: 0 },
    });
  });

  const count = await prisma.quotation.count();
  console.log(`✨ All quotations purged! Remaining quotations count: ${count}`);
}

if (process.argv[1] && process.argv[1].includes('clean-all-quotations')) {
  purgeAllQuotationsAndTransactions()
    .catch((e) => {
      console.error('Error during purge:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
