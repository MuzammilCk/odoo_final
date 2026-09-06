import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const rows = await p.quotation.findMany({
    include: {
      customer: { select: { name: true } },
      salesRep: { select: { firstName: true, lastName: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n📋 QUOTATION TABLE');
  console.log('='.repeat(120));
  console.log(
    'Quote No.'.padEnd(12),
    'Customer'.padEnd(22),
    'Sales Rep'.padEnd(20),
    'Status'.padEnd(22),
    'Lines'.padEnd(7),
    'Grand Total'.padEnd(14),
    'Created'
  );
  console.log('-'.repeat(120));

  for (const r of rows) {
    console.log(
      r.quoteNumber.padEnd(12),
      r.customer.name.slice(0, 20).padEnd(22),
      `${r.salesRep.firstName} ${r.salesRep.lastName}`.slice(0, 18).padEnd(20),
      r.status.padEnd(22),
      String(r._count.lines).padEnd(7),
      `$${Number(r.grandTotal).toFixed(2)}`.padEnd(14),
      r.createdAt.toISOString().slice(0, 10)
    );
  }

  console.log('='.repeat(120));
  console.log(`Total: ${rows.length} quotations\n`);
  await p.$disconnect();
}

main().catch(console.error);

