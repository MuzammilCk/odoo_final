import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showDatabase() {
  console.log('================================================================');
  console.log('              DEALFLOW360 — CURRENT DATABASE STATUS             ');
  console.log('================================================================\n');

  // 1. Transactional Models (Should all be 0)
  const [
    quotationsCount,
    quotationLinesCount,
    approvalRequestsCount,
    approvalStepsCount,
    negotiationsCount,
    fulfillmentsCount,
    backordersCount,
    subscriptionsCount,
    invoicesCount,
    paymentsCount,
    creditNotesCount,
    dealHealthFlagsCount,
  ] = await Promise.all([
    prisma.quotation.count(),
    prisma.quotationLine.count(),
    prisma.approvalRequest.count(),
    prisma.approvalStep.count(),
    prisma.negotiationRequest.count(),
    prisma.fulfillmentAllocation.count(),
    prisma.backorder.count(),
    prisma.subscriptionInstance.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.creditNote.count(),
    prisma.dealHealthFlag.count(),
  ]);

  console.log('--- 1. TRANSACTIONAL TABLES (All Clean / Zero Rows) ---');
  console.log(`  • Quotations:             ${quotationsCount} rows`);
  console.log(`  • QuotationLines:        ${quotationLinesCount} rows`);
  console.log(`  • ApprovalRequests:      ${approvalRequestsCount} rows`);
  console.log(`  • ApprovalSteps:         ${approvalStepsCount} rows`);
  console.log(`  • NegotiationRequests:   ${negotiationsCount} rows`);
  console.log(`  • FulfillmentAllocations: ${fulfillmentsCount} rows`);
  console.log(`  • Backorders:            ${backordersCount} rows`);
  console.log(`  • SubscriptionInstances: ${subscriptionsCount} rows`);
  console.log(`  • Invoices:              ${invoicesCount} rows`);
  console.log(`  • Payments:              ${paymentsCount} rows`);
  console.log(`  • CreditNotes:           ${creditNotesCount} rows`);
  console.log(`  • DealHealthFlags:       ${dealHealthFlagsCount} rows`);

  // 2. Master Setup / Configuration Data
  console.log('\n--- 2. MASTER CONFIGURATION & CATALOG DATA ---');

  // Users
  const users = await prisma.user.findMany({
    select: { email: true, role: true, firstName: true, lastName: true, isActive: true },
    orderBy: { role: 'asc' },
  });
  console.log(`\n• Users (${users.length} configured):`);
  console.table(users);

  // Customers
  const customers = await prisma.customer.findMany({
    include: { discountTier: { select: { name: true, defaultDiscountCeiling: true } } },
  });
  console.log(`\n• Customers (${customers.length} organizations):`);
  console.table(
    customers.map((c) => ({
      Name: c.name,
      Tier: c.discountTier?.name,
      TierCeiling: `${c.discountTier?.defaultDiscountCeiling}%`,
      Active: c.isActive,
    }))
  );

  // Discount Tiers
  const tiers = await prisma.discountTier.findMany();
  console.log(`\n• Discount Tiers (${tiers.length} tiers):`);
  console.table(
    tiers.map((t) => ({
      Tier: t.name,
      Ceiling: `${t.defaultDiscountCeiling}%`,
    }))
  );

  // Categories & Ceilings
  const categories = await prisma.category.findMany({
    include: { categoryDiscountCeiling: true },
  });
  console.log(`\n• Product Categories & Ceilings (${categories.length} categories):`);
  console.table(
    categories.map((cat) => ({
      Category: cat.name,
      MaxCeiling: cat.categoryDiscountCeiling ? `${cat.categoryDiscountCeiling.maxDiscount}%` : 'N/A',
      Description: cat.description,
    }))
  );

  // Products
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { sku: 'asc' },
  });
  console.log(`\n• Product Catalog (${products.length} products):`);
  console.table(
    products.map((p) => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category.name,
      BasePrice: `$${Number(p.basePrice).toFixed(2)}`,
      TaxRate: `${p.taxRate}%`,
      Type: p.isSubscription ? `Subscription (${p.recurringInterval})` : 'One-time',
    }))
  );

  // Warehouses & Stock Levels
  const stock = await prisma.stockLevel.findMany({
    include: { warehouse: true, product: true },
    orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
  });
  console.log(`\n• Warehouse Inventory (${stock.length} stock positions):`);
  console.table(
    stock.map((s) => ({
      Warehouse: s.warehouse.name,
      Weight: s.warehouse.shippingCostWeight,
      Product: s.product.name,
      OnHand: Number(s.quantityOnHand),
      Reserved: Number(s.quantityReserved),
      Available: Number(s.quantityOnHand) - Number(s.quantityReserved),
    }))
  );
}

showDatabase()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
