import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const [users, customers, tiers, warehouses, products, quotations] = await Promise.all([
    p.user.findMany({ select: { email: true, role: true, firstName: true, lastName: true } }),
    p.customer.findMany({ include: { discountTier: { select: { name: true } } } }),
    p.discountTier.findMany({ include: { _count: { select: { customers: true } } } }),
    p.warehouse.findMany({ include: { stockLevels: { select: { quantityOnHand: true } } } }),
    p.product.count(),
    p.quotation.count(),
  ]);

  console.log('\n👥 USERS');
  console.log('='.repeat(80));
  users.forEach(u => console.log(`  ${u.email.padEnd(35)} ${u.role.padEnd(15)} ${u.firstName} ${u.lastName}`));

  console.log('\n🏢 CUSTOMERS');
  console.log('='.repeat(80));
  customers.forEach(c => console.log(`  ${c.name.padEnd(25)} ${(c.email||'').padEnd(30)} Tier: ${c.discountTier?.name || 'none'}`));

  console.log('\n💰 DISCOUNT TIERS');
  console.log('='.repeat(80));
  tiers.forEach(t => console.log(`  ${t.name.padEnd(15)} Ceiling: ${t.defaultDiscountCeiling}%  Customers: ${t._count.customers}  MANAGER_THRESHOLD: ${t.managerApprovalThreshold}%  FINANCE_THRESHOLD: ${t.financeApprovalThreshold}%`));

  console.log('\n🏭 WAREHOUSES');
  console.log('='.repeat(80));
  warehouses.forEach(w => {
    const totalStock = w.stockLevels.reduce((s, sl) => s + sl.quantityOnHand, 0);
    console.log(`  ${w.name.padEnd(25)} Code: ${w.code.padEnd(10)} Stock lines: ${w.stockLevels.length}  Total qty: ${totalStock}`);
  });

  console.log('\n📦 PRODUCTS:', products, 'total');
  console.log('📋 QUOTATIONS:', quotations, 'total');
  console.log('');

  await p.$disconnect();
}

main().catch(console.error);
