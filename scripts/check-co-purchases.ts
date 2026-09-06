import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const laptopLines = await p.quotationLine.findMany({
    where: {
      product: { name: { contains: 'Laptop' } }
    },
    include: {
      product: true,
      quotation: {
        include: {
          lines: {
            include: { product: { include: { category: true } } }
          }
        }
      }
    }
  });

  for (const l of laptopLines) {
    console.log(`\nQuote ${l.quotation.quoteNumber} has ${l.product.name}:`);
    l.quotation.lines.forEach(ql => {
      console.log(`   - ${ql.product.name} ($${ql.product.basePrice}) [${ql.product.category?.name}]`);
    });
  }

  await p.$disconnect();
}

main().catch(console.error);
