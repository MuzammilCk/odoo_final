import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking existing records...');
  const quoteCount = await prisma.quotation.count();
  console.log(`Found ${quoteCount} quotations.`);

  if (quoteCount === 0) {
    console.log('No quotations found to remove.');
    return;
  }

  console.log('🗑️ Removing quotation transactional records in foreign-key dependency order...');

  // 1. Disassociate audit logs from quotations
  const auditUpdated = await prisma.auditLog.updateMany({
    where: { quotationId: { not: null } },
    data: { quotationId: null },
  });
  console.log(`  ✓ Unlinked ${auditUpdated.count} audit logs from quotations`);

  // 2. Payments on quotation invoices
  const paymentsDeleted = await prisma.payment.deleteMany({});
  console.log(`  ✓ Deleted ${paymentsDeleted.count} payments`);

  // 3. Credit notes
  const creditNotesDeleted = await prisma.creditNote.deleteMany({});
  console.log(`  ✓ Deleted ${creditNotesDeleted.count} credit notes`);

  // 4. Invoices
  const invoicesDeleted = await prisma.invoice.deleteMany({});
  console.log(`  ✓ Deleted ${invoicesDeleted.count} invoices`);

  // 5. Subscription instances
  const subscriptionsDeleted = await prisma.subscriptionInstance.deleteMany({});
  console.log(`  ✓ Deleted ${subscriptionsDeleted.count} subscription instances`);

  // 6. Backorders
  const backordersDeleted = await prisma.backorder.deleteMany({});
  console.log(`  ✓ Deleted ${backordersDeleted.count} backorders`);

  // 7. Fulfillment allocations
  const allocationsDeleted = await prisma.fulfillmentAllocation.deleteMany({});
  console.log(`  ✓ Deleted ${allocationsDeleted.count} fulfillment allocations`);

  // 8. Deal Health flags
  const flagsDeleted = await prisma.dealHealthFlag.deleteMany({});
  console.log(`  ✓ Deleted ${flagsDeleted.count} deal health flags`);

  // 9. Negotiation requests
  const negotiationsDeleted = await prisma.negotiationRequest.deleteMany({});
  console.log(`  ✓ Deleted ${negotiationsDeleted.count} negotiation requests`);

  // 10. Approval steps
  const stepsDeleted = await prisma.approvalStep.deleteMany({});
  console.log(`  ✓ Deleted ${stepsDeleted.count} approval steps`);

  // 11. Approval requests
  const approvalRequestsDeleted = await prisma.approvalRequest.deleteMany({});
  console.log(`  ✓ Deleted ${approvalRequestsDeleted.count} approval requests`);

  // 12. Quotation lines
  const linesDeleted = await prisma.quotationLine.deleteMany({});
  console.log(`  ✓ Deleted ${linesDeleted.count} quotation lines`);

  // 13. Quotations
  const quotesDeleted = await prisma.quotation.deleteMany({});
  console.log(`  ✓ Deleted ${quotesDeleted.count} quotations`);

  // 14. Reset reserved stock levels to 0 since no quotes are holding inventory
  const stockReset = await prisma.stockLevel.updateMany({
    data: { quantityReserved: 0 },
  });
  console.log(`  ✓ Reset reserved inventory quantities across ${stockReset.count} warehouse stock records`);

  console.log('✅ ALL QUOTATIONS AND DEPENDENT TRANSACTIONAL RECORDS SUCCESSFULLY REMOVED!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Failed to clear quotations:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
