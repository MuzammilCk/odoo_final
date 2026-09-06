import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const rows = await p.quotation.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, quoteNumber: true, status: true },
  });

  console.log(`\n🗑️  Deleting ${rows.length} quotations one by one...\n`);

  for (const row of rows) {
    const qid = row.id;

    // 1. Audit logs
    await p.auditLog.deleteMany({ where: { quotationId: qid } });

    // 2. Deal health flags
    await p.dealHealthFlag.deleteMany({ where: { quotationId: qid } });

    // 3. Approval steps → approval requests
    const approvalReqs = await p.approvalRequest.findMany({ where: { quotationId: qid }, select: { id: true } });
    for (const ar of approvalReqs) {
      await p.approvalStep.deleteMany({ where: { approvalRequestId: ar.id } });
    }
    await p.approvalRequest.deleteMany({ where: { quotationId: qid } });

    // 4. Portal negotiation requests
    await p.negotiationRequest.deleteMany({ where: { quotationId: qid } });

    // 5. Fulfillment allocations & backorders
    await p.fulfillmentAllocation.deleteMany({ where: { quotationId: qid } });
    await p.backorder.deleteMany({ where: { quotationId: qid } });

    // 6. Subscriptions
    await p.subscriptionInstance.deleteMany({ where: { quotationId: qid } });

    // 7. Payments → credit notes → invoices
    const invoices = await p.invoice.findMany({ where: { quotationId: qid }, select: { id: true } });
    for (const inv of invoices) {
      await p.payment.deleteMany({ where: { invoiceId: inv.id } });
      await p.creditNote.deleteMany({ where: { invoiceId: inv.id } });
    }
    await p.invoice.deleteMany({ where: { quotationId: qid } });

    // 8. Quotation lines
    await p.quotationLine.deleteMany({ where: { quotationId: qid } });

    // 9. Quotation itself
    await p.quotation.delete({ where: { id: qid } });

    console.log(`  ✓ Deleted ${row.quoteNumber.padEnd(22)} [${row.status}]`);
  }

  const remaining = await p.quotation.count();
  console.log(`\n✅ Done. Remaining quotations: ${remaining}\n`);
  await p.$disconnect();
}

main().catch(console.error);
