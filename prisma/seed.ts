/**
 * DealFlow360 — Prisma Seed
 *
 * Source of truth: docs/5_Database_Schema.md (LOCKED)
 * Prompt reference: docs/team/06_Starting_Prompts_All.md → F3
 *
 * SPEC RECONCILIATION NOTES (Section 5 wins over F3 prompt where they conflict):
 *  - customers: no `code` column in §5.6 — using `name` as unique identifier
 *  - products: no `estimated_cost` or `is_promoted` in §5.8 — omitted
 *  - category_discount_ceilings: §5.11 has ONE ceiling per category (no discount_tier_id)
 *    — seeding the most-restrictive (Bronze) ceiling per category as the governance ceiling
 *  - quotation_lines: no `line_type` in §5.16 — recurring identified by subscriptionInstance
 *  - approval_steps: approverUserId is NOT NULL in §5.18 — assigning real users
 */

import { PrismaClient, QuotationStatus, ApprovalRequestStatus, ApprovalStepStatus, ApprovalLevel, NegotiationType, FulfillmentStatus, SubscriptionStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const DEMO_PASSWORD = 'demo123';

async function main() {
  console.log('🌱 Starting seed...');

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
  const customerAcme = await prisma.user.upsert({
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
  // §5.11: ONE ceiling per category (no discount_tier_id).
  // Seeding the most permissive governance ceiling per category (Gold-level ceiling).
  // The discount risk service (Lane A) handles the MIN(tier, category) logic at runtime.
  console.log('  → Category discount ceilings...');
  await Promise.all([
    prisma.categoryDiscountCeiling.upsert({
      where: { categoryId: catHardware.id },
      update: {},
      create: { categoryId: catHardware.id, maxDiscount: 15.0 }, // Hardware max = Gold 15%
    }),
    prisma.categoryDiscountCeiling.upsert({
      where: { categoryId: catServices.id },
      update: {},
      create: { categoryId: catServices.id, maxDiscount: 10.0 }, // Services max = Gold 10%
    }),
    prisma.categoryDiscountCeiling.upsert({
      where: { categoryId: catSubscriptions.id },
      update: {},
      create: { categoryId: catSubscriptions.id, maxDiscount: 12.0 }, // Subscriptions max = Gold 12%
    }),
  ]);

  // ── 7. Products ────────────────────────────────────────────────────────────
  // §5.8: sku is required UNIQUE. No estimated_cost/is_promoted (not in Section 5).
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

  // ── 11. Stock Levels ───────────────────────────────────────────────────────
  console.log('  → Stock levels...');
  const stockEntries = [
    // Main Warehouse
    { warehouseId: mainWh.id, productId: laptopPro.id, quantityOnHand: 50, quantityReserved: 10 },
    { warehouseId: mainWh.id, productId: monitor.id, quantityOnHand: 30, quantityReserved: 5 },
    { warehouseId: mainWh.id, productId: keyboard.id, quantityOnHand: 100, quantityReserved: 0 },
    // East Depot
    { warehouseId: eastWh.id, productId: laptopPro.id, quantityOnHand: 15, quantityReserved: 0 },
    { warehouseId: eastWh.id, productId: monitor.id, quantityOnHand: 8, quantityReserved: 0 },
    { warehouseId: eastWh.id, productId: keyboard.id, quantityOnHand: 25, quantityReserved: 0 },
  ];

  for (const entry of stockEntries) {
    await prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: entry.warehouseId, productId: entry.productId } },
      update: {},
      create: entry,
    });
  }

  // ── 12. Quotations ─────────────────────────────────────────────────────────
  // Helper: compute line totals given discount % and tax %
  function calcLine(unitPrice: number, qty: number, discPct: number, taxRatePct: number, allowedPct: number) {
    const discAmt = unitPrice * qty * (discPct / 100);
    const net = unitPrice * qty - discAmt;
    const taxAmt = net * (taxRatePct / 100);
    const total = net + taxAmt;
    const overagePct = Math.max(0, discPct - allowedPct);
    return { discAmt, taxAmt, total, net, overagePct };
  }

  console.log('  → Quotations...');

  // ── Q-1001: Acme DRAFT ─────────────────────────────────────────────────────
  {
    // Gold ceiling for Hardware = 15%, for Services = 10%
    const l1 = calcLine(1100, 2, 10, 8, 15); // Laptop x2, 10% disc (allowed 15%)
    const l2 = calcLine(500, 1, 5, 0, 10);   // Service x1, 5% disc (allowed 10%)
    const subtotal = l1.net + l2.net;
    const discountTotal = l1.discAmt + l2.discAmt;
    const taxTotal = l1.taxAmt + l2.taxAmt;
    const grandTotal = subtotal + taxTotal;

    const q1001 = await prisma.quotation.create({
      data: {
        quoteNumber: 'Q-1001',
        customerId: acme.id,
        salesRepId: rep.id,
        status: QuotationStatus.DRAFT,
        currencyCode: 'USD',
        currentVersion: 1,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        marginAmount: grandTotal * 0.25, // approximate for demo
        marginPercent: 25.0,
        customerVisibleAt: null,
        lines: {
          create: [
            {
              productId: laptopPro.id,
              descriptionSnapshot: 'Laptop Pro',
              skuSnapshot: 'HW-LAPTOP-PRO',
              quantity: 2,
              unitPrice: 1100,
              discountPercent: 10,
              discountAmount: l1.discAmt,
              taxAmount: l1.taxAmt,
              lineTotal: l1.total,
              estimatedUnitCost: 800,
              estimatedMarginAmount: l1.net - 800 * 2,
              estimatedMarginPercent: ((l1.net - 800 * 2) / l1.total) * 100,
              allowedDiscountPercent: 15,
              discountOveragePercent: 0,
            },
            {
              productId: setupService.id,
              descriptionSnapshot: 'Setup Service',
              skuSnapshot: 'SVC-SETUP',
              quantity: 1,
              unitPrice: 500,
              discountPercent: 5,
              discountAmount: l2.discAmt,
              taxAmount: l2.taxAmt,
              lineTotal: l2.total,
              estimatedUnitCost: 350,
              estimatedMarginAmount: l2.net - 350,
              estimatedMarginPercent: ((l2.net - 350) / l2.total) * 100,
              allowedDiscountPercent: 10,
              discountOveragePercent: 0,
            },
          ],
        },
      },
    });
    console.log(`    ✓ ${q1001.quoteNumber} (DRAFT)`);
  }

  // ── Q-1002: Acme PENDING_APPROVAL with HIGH risk ───────────────────────────
  {
    const l1 = calcLine(1100, 5, 12, 8, 15); // Laptop x5, 12% (allowed 15%)
    const l2 = calcLine(500, 3, 18, 0, 10);  // Service x3, 18% (exceeds ceiling 10% → overage 8)
    const subtotal = l1.net + l2.net;
    const discountTotal = l1.discAmt + l2.discAmt;
    const taxTotal = l1.taxAmt + l2.taxAmt;
    const grandTotal = subtotal + taxTotal;

    const q1002 = await prisma.quotation.create({
      data: {
        quoteNumber: 'Q-1002',
        customerId: acme.id,
        salesRepId: rep.id,
        status: QuotationStatus.PENDING_APPROVAL,
        currencyCode: 'USD',
        currentVersion: 1,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        marginAmount: grandTotal * 0.2,
        marginPercent: 20.0,
        blendedRiskScore: 8.0,
        riskLevel: 'HIGH',
        lines: {
          create: [
            {
              productId: laptopPro.id,
              descriptionSnapshot: 'Laptop Pro',
              skuSnapshot: 'HW-LAPTOP-PRO',
              quantity: 5,
              unitPrice: 1100,
              discountPercent: 12,
              discountAmount: l1.discAmt,
              taxAmount: l1.taxAmt,
              lineTotal: l1.total,
              estimatedUnitCost: 800,
              estimatedMarginAmount: l1.net - 800 * 5,
              estimatedMarginPercent: ((l1.net - 800 * 5) / l1.total) * 100,
              allowedDiscountPercent: 15,
              discountOveragePercent: 0,
            },
            {
              productId: setupService.id,
              descriptionSnapshot: 'Setup Service',
              skuSnapshot: 'SVC-SETUP',
              quantity: 3,
              unitPrice: 500,
              discountPercent: 18,
              discountAmount: l2.discAmt,
              taxAmount: l2.taxAmt,
              lineTotal: l2.total,
              estimatedUnitCost: 350,
              estimatedMarginAmount: l2.net - 350 * 3,
              estimatedMarginPercent: ((l2.net - 350 * 3) / l2.total) * 100,
              allowedDiscountPercent: 10,
              discountOveragePercent: 8, // exceeds ceiling by 8%
            },
          ],
        },
      },
    });

    // ApprovalRequest + 2 steps (HIGH risk → Manager + Finance)
    await prisma.approvalRequest.create({
      data: {
        quotationId: q1002.id,
        quotationVersion: 1,
        status: ApprovalRequestStatus.PENDING,
        riskScore: 8.0,
        riskLevel: 'HIGH',
        requiredApprovalCount: 2,
        termsSnapshot: { quoteNumber: 'Q-1002', riskScore: 8, riskLevel: 'HIGH', grandTotal },
        submittedAt: new Date(),
        createdBy: rep.id,
        steps: {
          create: [
            {
              sequenceNo: 1,
              approvalLevel: ApprovalLevel.MANAGER,
              approverUserId: manager.id,
              status: ApprovalStepStatus.PENDING,
            },
            {
              sequenceNo: 2,
              approvalLevel: ApprovalLevel.FINANCE,
              approverUserId: finance.id,
              status: ApprovalStepStatus.PENDING,
            },
          ],
        },
      },
    });
    console.log(`    ✓ ${q1002.quoteNumber} (PENDING_APPROVAL, HIGH risk, 2 steps)`);
  }

  // ── Q-1003: Beta UNDER_NEGOTIATION v2 ─────────────────────────────────────
  {
    const l1 = calcLine(450, 10, 8, 8, 15);  // Monitor x10, 8% (allowed 15%)
    const l2 = calcLine(80, 10, 5, 5, 12);   // Cloud License x10, 5% (allowed 12%)
    const subtotal = l1.net + l2.net;
    const discountTotal = l1.discAmt + l2.discAmt;
    const taxTotal = l1.taxAmt + l2.taxAmt;
    const grandTotal = subtotal + taxTotal;

    const q1003 = await prisma.quotation.create({
      data: {
        quoteNumber: 'Q-1003',
        customerId: beta.id,
        salesRepId: rep.id,
        status: QuotationStatus.UNDER_NEGOTIATION,
        currencyCode: 'USD',
        currentVersion: 2,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        marginAmount: grandTotal * 0.3,
        marginPercent: 30.0,
        customerVisibleAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        lines: {
          create: [
            {
              productId: monitor.id,
              descriptionSnapshot: 'Monitor 27"',
              skuSnapshot: 'HW-MONITOR-27',
              quantity: 10,
              unitPrice: 450,
              discountPercent: 8,
              discountAmount: l1.discAmt,
              taxAmount: l1.taxAmt,
              lineTotal: l1.total,
              estimatedUnitCost: 250,
              estimatedMarginAmount: l1.net - 250 * 10,
              estimatedMarginPercent: ((l1.net - 250 * 10) / l1.total) * 100,
              allowedDiscountPercent: 15,
              discountOveragePercent: 0,
            },
            {
              productId: cloudLicense.id,
              descriptionSnapshot: 'Cloud License',
              skuSnapshot: 'SUB-CLOUD-LIC',
              quantity: 10,
              unitPrice: 80,
              discountPercent: 5,
              discountAmount: l2.discAmt,
              taxAmount: l2.taxAmt,
              lineTotal: l2.total,
              estimatedUnitCost: 20,
              estimatedMarginAmount: l2.net - 20 * 10,
              estimatedMarginPercent: ((l2.net - 20 * 10) / l2.total) * 100,
              allowedDiscountPercent: 12,
              discountOveragePercent: 0,
            },
          ],
        },
      },
    });

    // Customer negotiation request: COUNTER_DISCOUNT at 12%
    await prisma.negotiationRequest.create({
      data: {
        quotationId: q1003.id,
        customerId: beta.id,
        requestedByUserId: (await prisma.user.findFirst({ where: { customerId: beta.id } }))!.id,
        negotiationType: NegotiationType.COUNTER_DISCOUNT,
        message: 'We would like a 12% discount on the Cloud License seats.',
        requestedDiscountPercent: 12.0,
        status: 'OPEN',
      },
    });
    console.log(`    ✓ ${q1003.quoteNumber} (UNDER_NEGOTIATION, v2, with counter-discount request)`);
  }

  // ── Q-1004: Acme CONFIRMED + Fulfillment + Backorder + Subscription ────────
  {
    const confirmedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const l1 = calcLine(1100, 60, 5, 8, 15);  // Laptop x60, 5%
    const l2 = calcLine(80, 20, 0, 5, 12);    // Cloud License x20, 0%
    const subtotal = l1.net + l2.net;
    const discountTotal = l1.discAmt + l2.discAmt;
    const taxTotal = l1.taxAmt + l2.taxAmt;
    const grandTotal = subtotal + taxTotal;

    const q1004 = await prisma.quotation.create({
      data: {
        quoteNumber: 'Q-1004',
        customerId: acme.id,
        salesRepId: rep.id,
        status: QuotationStatus.CONFIRMED,
        currencyCode: 'USD',
        currentVersion: 1,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        marginAmount: grandTotal * 0.28,
        marginPercent: 28.0,
        customerVisibleAt: confirmedAt,
        confirmedAt,
        lines: {
          create: [
            {
              productId: laptopPro.id,
              descriptionSnapshot: 'Laptop Pro',
              skuSnapshot: 'HW-LAPTOP-PRO',
              quantity: 60,
              unitPrice: 1100,
              discountPercent: 5,
              discountAmount: l1.discAmt,
              taxAmount: l1.taxAmt,
              lineTotal: l1.total,
              estimatedUnitCost: 800,
              estimatedMarginAmount: l1.net - 800 * 60,
              estimatedMarginPercent: ((l1.net - 800 * 60) / l1.total) * 100,
              allowedDiscountPercent: 15,
              discountOveragePercent: 0,
            },
            {
              productId: cloudLicense.id,
              descriptionSnapshot: 'Cloud License',
              skuSnapshot: 'SUB-CLOUD-LIC',
              quantity: 20,
              unitPrice: 80,
              discountPercent: 0,
              discountAmount: 0,
              taxAmount: l2.taxAmt,
              lineTotal: l2.total,
              estimatedUnitCost: 20,
              estimatedMarginAmount: l2.net - 20 * 20,
              estimatedMarginPercent: ((l2.net - 20 * 20) / l2.total) * 100,
              allowedDiscountPercent: 12,
              discountOveragePercent: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });

    const laptopLine = q1004.lines.find(l => l.productId === laptopPro.id)!;
    const cloudLine  = q1004.lines.find(l => l.productId === cloudLicense.id)!;

    // Fulfillment: 40 from Main (FULFILLED), 15 from East (FULFILLED)
    const alloc1 = await prisma.fulfillmentAllocation.create({
      data: {
        quotationId: q1004.id,
        quotationLineId: laptopLine.id,
        warehouseId: mainWh.id,
        quantityAllocated: 40,
        quantityFulfilled: 40,
        status: FulfillmentStatus.FULFILLED,
        estimatedShipmentCost: 40 * 1.0 * 10,
      },
    });

    const alloc2 = await prisma.fulfillmentAllocation.create({
      data: {
        quotationId: q1004.id,
        quotationLineId: laptopLine.id,
        warehouseId: eastWh.id,
        quantityAllocated: 15,
        quantityFulfilled: 15,
        status: FulfillmentStatus.FULFILLED,
        estimatedShipmentCost: 15 * 1.5 * 10,
      },
    });

    // Backorder: 5 units remain (60 - 40 - 15 = 5)
    await prisma.backorder.create({
      data: {
        quotationId: q1004.id,
        quotationLineId: laptopLine.id,
        fulfillmentAllocationId: alloc2.id,
        quantityBackordered: 5,
        quantityFulfilledLater: 0,
      },
    });

    // SubscriptionInstance for Cloud License line
    const periodStart = confirmedAt;
    const periodEnd = new Date(confirmedAt);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await prisma.subscriptionInstance.create({
      data: {
        quotationId: q1004.id,
        quotationLineId: cloudLine.id,
        customerId: acme.id,
        productId: cloudLicense.id,
        status: SubscriptionStatus.ACTIVE,
        quantity: 20,
        unitPrice: 80,
        currencyCode: 'USD',
        billingInterval: 'MONTHLY',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
      },
    });

    console.log(`    ✓ ${q1004.quoteNumber} (CONFIRMED, allocs: 40+15, backorder: 5, subscription created)`);
  }

  // ── Q-1005: Acme STALLED DRAFT (30 days old) ──────────────────────────────
  {
    const stalledDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const l1 = calcLine(150, 5, 15, 5, 12); // Premium Support x5, 15% (exceeds sub ceiling 12%)
    const subtotal = l1.net;
    const taxTotal = l1.taxAmt;
    const grandTotal = subtotal + taxTotal;

    // Create draft, then manually update updated_at to simulate staleness
    const q1005 = await prisma.quotation.create({
      data: {
        quoteNumber: 'Q-1005',
        customerId: acme.id,
        salesRepId: rep.id,
        status: QuotationStatus.DRAFT,
        currencyCode: 'USD',
        currentVersion: 1,
        subtotal,
        discountTotal: l1.discAmt,
        taxTotal,
        grandTotal,
        marginAmount: grandTotal * 0.15,
        marginPercent: 15.0,
        blendedRiskScore: 3.0,
        riskLevel: 'MEDIUM',
        lines: {
          create: [
            {
              productId: premiumSupport.id,
              descriptionSnapshot: 'Premium Support',
              skuSnapshot: 'SUB-PREMIUM-SUP',
              quantity: 5,
              unitPrice: 150,
              discountPercent: 15,
              discountAmount: l1.discAmt,
              taxAmount: l1.taxAmt,
              lineTotal: l1.total,
              estimatedUnitCost: 60,
              estimatedMarginAmount: l1.net - 60 * 5,
              estimatedMarginPercent: ((l1.net - 60 * 5) / l1.total) * 100,
              allowedDiscountPercent: 12,
              discountOveragePercent: 3, // 15% - 12% ceiling = 3% overage
            },
          ],
        },
      },
    });

    // Backdate updated_at using raw SQL to simulate a stalled quote
    await prisma.$executeRaw`
      UPDATE quotations
      SET updated_at = ${stalledDate}
      WHERE id = ${q1005.id}::uuid
    `;
    console.log(`    ✓ ${q1005.quoteNumber} (DRAFT/STALLED, 30 days old, discount overage)`);
  }

  console.log('\n✅ Seed complete!');
  console.log('   Users: admin@demo.com, rep@demo.com, manager@demo.com, finance@demo.com, customer@acme.com, customer@beta.com');
  console.log('   Password for all: demo123');
  console.log('   Quotations: Q-1001 (DRAFT), Q-1002 (PENDING_APPROVAL), Q-1003 (UNDER_NEGOTIATION), Q-1004 (CONFIRMED), Q-1005 (STALLED)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
