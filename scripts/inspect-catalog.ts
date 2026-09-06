import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const cats = await p.category.findMany({
    select: { id: true, name: true, _count: { select: { products: true } } }
  });
  console.log('Categories:');
  cats.forEach(c => console.log(`  - ${c.name} (${c._count.products} products)`));

  const laptops = await p.product.findMany({
    where: { name: { contains: 'Laptop' } },
    select: { id: true, name: true, sku: true, basePrice: true }
  });
  console.log('Laptops in DB:');
  laptops.forEach(l => console.log(`  - ${l.name} ($${l.basePrice}) [${l.sku}] id=${l.id}`));

  await p.$disconnect();
}

main().catch(console.error);
