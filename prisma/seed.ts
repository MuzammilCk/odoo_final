/**
 * DealFlow360 — Prisma Master Seed
 *
 * Source of truth: docs/5_Database_Schema.md (LOCKED)
 * Seeds only authentic master catalog & system infrastructure data:
 * - Discount Tiers (Bronze, Silver, Gold)
 * - Customer Organizations (Acme Corp, Beta Industries)
 * - User Accounts across all 5 roles
 * - Categories & Category Discount Ceilings
 * - Products, Variants, and Price List Entries
 * - Warehouses and Inventory Stock Levels
 *
 * Zero mock transactional data (quotations, invoices, etc.) is seeded.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const DEMO_PASSWORD = 'password123';

async function main() {
  console.log('🌱 Starting master configuration seed...');

  // ── 1. Hash password once ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  // ── 2. Discount Tiers ──────────────────────────────────────────────────────
  console.log('  → Discount tiers...');
  const [bronze, silver, gold] = await Promise.all([
    prisma.discountTier.upsert({
      where: { name: 'Bronze' },
      update: {},
      create: { name: 'Bronze', defaultDiscountCeiling: 5.0 },
    }),
    prisma.discountTier.upsert({
      where: { name: 'Silver' },
      update: {},
      create: { name: 'Silver', defaultDiscountCeiling: 10.0 },
    }),
    prisma.discountTier.upsert({
      where: { name: 'Gold' },
      update: {},
      create: { name: 'Gold', defaultDiscountCeiling: 15.0 },
    }),
  ]);

  // ── 3. Customers ───────────────────────────────────────────────────────────
  console.log('  → Customers...');
  const [acme, beta] = await Promise.all([
    prisma.customer.upsert({
      where: { name: 'Acme Corp' },
      update: {},
      create: { name: 'Acme Corp', discountTierId: gold.id },
    }),
    prisma.customer.upsert({
      where: { name: 'Beta Industries' },
      update: {},
      create: { name: 'Beta Industries', discountTierId: silver.id },
    }),
  ]);

  // ── 4. Users ───────────────────────────────────────────────────────────────
  console.log('  → Users...');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      passwordHash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  const rep = await prisma.user.upsert({
    where: { email: 'rep@demo.com' },
    update: {},
    create: {
      email: 'rep@demo.com',
      passwordHash,
      role: 'SALES_REP',
      firstName: 'Sarah',
      lastName: 'Sales',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@demo.com' },
    update: {},
    create: {
      email: 'manager@demo.com',
      passwordHash,
      role: 'MANAGER',
      firstName: 'Mike',
      lastName: 'Manager',
    },
  });

  const finance = await prisma.user.upsert({
    where: { email: 'finance@demo.com' },
    update: {},
    create: {
      email: 'finance@demo.com',
      passwordHash,
      role: 'FINANCE_OPS',
      firstName: 'Fiona',
      lastName: 'Finance',
    },
  });

  // Customer users — linked to their customer record
  await prisma.user.upsert({
    where: { email: 'customer@acme.com' },
    update: {},
    create: {
      email: 'customer@acme.com',
      passwordHash,
      role: 'CUSTOMER',
      firstName: 'Alex',
      lastName: 'Acme',
      customerId: acme.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@beta.com' },
    update: {},
    create: {
      email: 'customer@beta.com',
      passwordHash,
      role: 'CUSTOMER',
      firstName: 'Beth',
      lastName: 'Beta',
      customerId: beta.id,
    },
  });

  // ── 5. Categories ──────────────────────────────────────────────────────────
  console.log('  → Categories...');
  const [catHardware, catServices, catSubscriptions] = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Hardware' },
      update: {},
      create: { name: 'Hardware', description: 'Physical hardware products' },
    }),
    prisma.category.upsert({
      where: { name: 'Services' },
      update: {},
      create: { name: 'Services', description: 'Professional services' },
    }),
    prisma.category.upsert({
      where: { name: 'Subscriptions' },
      update: {},
      create: { name: 'Subscriptions', description: 'Recurring software subscriptions' },
    }),
  ]);

  // ── 6. Category Discount Ceilings ──────────────────────────────────────────
  console.log('  → Category discount ceilings...');
  await Promise.all([
    prisma.categoryDiscountCeiling.upsert({
      where: { categoryId: catHardware.id },
      update: {},
      create: { categoryId: catHardware.id, maxDiscount: 15.0 }, // Hardware max = 15%
    }),
    prisma.categoryDiscountCeiling.upsert({
      where: { categoryId: catServices.id },
      update: {},
      create: { categoryId: catServices.id, maxDiscount: 10.0 }, // Services max = 10%
    }),
    prisma.categoryDiscountCeiling.upsert({
      where: { categoryId: catSubscriptions.id },
      update: {},
      create: { categoryId: catSubscriptions.id, maxDiscount: 12.0 }, // Subscriptions max = 12%
    }),
  ]);

  // ── 7. Products ────────────────────────────────────────────────────────────
  console.log('  → Products...');
  const [laptopPro, monitor, keyboard, setupService, cloudLicense, premiumSupport] =
    await Promise.all([
      prisma.product.upsert({
        where: { sku: 'HW-LAPTOP-PRO' },
        update: {},
        create: {
          sku: 'HW-LAPTOP-PRO',
          name: 'Laptop Pro',
          categoryId: catHardware.id,
          unit: 'unit',
          basePrice: 1200.0,
          taxRate: 8.0,
          isSubscription: false,
        },
      }),
      prisma.product.upsert({
        where: { sku: 'HW-MONITOR-27' },
        update: {},
        create: {
          sku: 'HW-MONITOR-27',
          name: 'Monitor 27"',
          categoryId: catHardware.id,
          unit: 'unit',
          basePrice: 450.0,
          taxRate: 8.0,
          isSubscription: false,
        },
      }),
      prisma.product.upsert({
        where: { sku: 'HW-KBD-WIRELESS' },
        update: {},
        create: {
          sku: 'HW-KBD-WIRELESS',
          name: 'Keyboard Wireless',
          categoryId: catHardware.id,
          unit: 'unit',
          basePrice: 85.0,
          taxRate: 8.0,
          isSubscription: false,
        },
      }),
      prisma.product.upsert({
        where: { sku: 'SVC-SETUP' },
        update: {},
        create: {
          sku: 'SVC-SETUP',
          name: 'Setup Service',
          categoryId: catServices.id,
          unit: 'engagement',
          basePrice: 500.0,
          taxRate: 0.0,
          isSubscription: false,
        },
      }),
      prisma.product.upsert({
        where: { sku: 'SUB-CLOUD-LIC' },
        update: {},
        create: {
          sku: 'SUB-CLOUD-LIC',
          name: 'Cloud License',
          categoryId: catSubscriptions.id,
          unit: 'seat/month',
          basePrice: 90.0,
          taxRate: 5.0,
          isSubscription: true,
          recurringInterval: 'MONTHLY',
        },
      }),
      prisma.product.upsert({
        where: { sku: 'SUB-PREMIUM-SUP' },
        update: {},
        create: {
          sku: 'SUB-PREMIUM-SUP',
          name: 'Premium Support',
          categoryId: catSubscriptions.id,
          unit: 'seat/month',
          basePrice: 150.0,
          taxRate: 5.0,
          isSubscription: true,
          recurringInterval: 'MONTHLY',
        },
      }),
    ]);

  // ── 8. Product Variants ────────────────────────────────────────────────────
  console.log('  → Product variants...');
  await Promise.all([
    prisma.productVariant.upsert({
      where: { productId_attributeName_attributeValue: { productId: laptopPro.id, attributeName: 'RAM', attributeValue: '16GB' } },
      update: {},
      create: { productId: laptopPro.id, attributeName: 'RAM', attributeValue: '16GB', extraPrice: 200.0 },
    }),
    prisma.productVariant.upsert({
      where: { productId_attributeName_attributeValue: { productId: laptopPro.id, attributeName: 'RAM', attributeValue: '32GB' } },
      update: {},
      create: { productId: laptopPro.id, attributeName: 'RAM', attributeValue: '32GB', extraPrice: 500.0 },
    }),
    prisma.productVariant.upsert({
      where: { productId_attributeName_attributeValue: { productId: monitor.id, attributeName: 'Panel', attributeValue: 'IPS' } },
      update: {},
      create: { productId: monitor.id, attributeName: 'Panel', attributeValue: 'IPS', extraPrice: 0.0 },
    }),
    prisma.productVariant.upsert({
      where: { productId_attributeName_attributeValue: { productId: monitor.id, attributeName: 'Panel', attributeValue: 'OLED' } },
      update: {},
      create: { productId: monitor.id, attributeName: 'Panel', attributeValue: 'OLED', extraPrice: 150.0 },
    }),
  ]);

  // ── 9. Price List Entries ──────────────────────────────────────────────────
  console.log('  → Price list entries...');
  await Promise.all([
    prisma.priceListEntry.upsert({
      where: { productId_discountTierId_currencyCode: { productId: laptopPro.id, discountTierId: gold.id, currencyCode: 'USD' } },
      update: {},
      create: { productId: laptopPro.id, discountTierId: gold.id, currencyCode: 'USD', price: 1100.0 },
    }),
    prisma.priceListEntry.upsert({
      where: { productId_discountTierId_currencyCode: { productId: laptopPro.id, discountTierId: silver.id, currencyCode: 'USD' } },
      update: {},
      create: { productId: laptopPro.id, discountTierId: silver.id, currencyCode: 'USD', price: 1150.0 },
    }),
    prisma.priceListEntry.upsert({
      where: { productId_discountTierId_currencyCode: { productId: cloudLicense.id, discountTierId: gold.id, currencyCode: 'USD' } },
      update: {},
      create: { productId: cloudLicense.id, discountTierId: gold.id, currencyCode: 'USD', price: 80.0 },
    }),
  ]);

  // ── 10. Warehouses ─────────────────────────────────────────────────────────
  console.log('  → Warehouses...');
  const [mainWh, eastWh] = await Promise.all([
    prisma.warehouse.upsert({
      where: { name: 'Main Warehouse' },
      update: {},
      create: { name: 'Main Warehouse', shippingCostWeight: 1.0 },
    }),
    prisma.warehouse.upsert({
      where: { name: 'East Depot' },
      update: {},
      create: { name: 'East Depot', shippingCostWeight: 1.5 },
    }),
  ]);

  // ── 11. Stock Levels (Clean baseline with 0 reserved) ──────────────────────
  console.log('  → Stock levels...');
  const stockEntries = [
    // Main Warehouse
    { warehouseId: mainWh.id, productId: laptopPro.id, quantityOnHand: 50, quantityReserved: 0 },
    { warehouseId: mainWh.id, productId: monitor.id, quantityOnHand: 30, quantityReserved: 0 },
    { warehouseId: mainWh.id, productId: keyboard.id, quantityOnHand: 100, quantityReserved: 0 },
    // East Depot
    { warehouseId: eastWh.id, productId: laptopPro.id, quantityOnHand: 15, quantityReserved: 0 },
    { warehouseId: eastWh.id, productId: monitor.id, quantityOnHand: 8, quantityReserved: 0 },
    { warehouseId: eastWh.id, productId: keyboard.id, quantityOnHand: 25, quantityReserved: 0 },
  ];

  for (const entry of stockEntries) {
    await prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: entry.warehouseId, productId: entry.productId } },
      update: { quantityOnHand: entry.quantityOnHand, quantityReserved: 0 },
      create: entry,
    });
  }

  console.log('\n✅ Master configuration seed complete!');
  console.log('   Users: admin@demo.com, rep@demo.com, manager@demo.com, finance@demo.com, customer@acme.com, customer@beta.com');
  console.log('   Password for all: demo123');
  console.log('   Zero mock transactional data seeded — system ready for live deals.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
