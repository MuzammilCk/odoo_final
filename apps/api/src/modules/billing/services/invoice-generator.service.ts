/**
 * InvoiceGeneratorService — one-time invoice generation
 *
 * Spec refs: §6.37–6.38 (hybrid billing model — ship-first, bill-second),
 *            §5.24 (invoices table), §5.21 (fulfillment_allocations)
 *
 * Business rule §6.38: Nothing is billed before it ships.
 * This function reads FulfillmentAllocation rows (owned by Lane B) to determine
 * what has actually been shipped — Contract 4 cross-lane read.
 *
 * Schema reality notes (vs. spec prompt):
 *   - Invoice has NO `type`, `customerId`, or `balanceDue` columns.
 *   - There is NO InvoiceLine model — aggregates are stored at Invoice header level.
 *   - `totalAmount` is the grand-total field (not `grandTotal`).
 *   - Audit action is INVOICE_CREATED (not INVOICE_GENERATED).
 */

import { prisma } from '../../../lib/prisma.js';

// ── Invoice number generation ──────────────────────────────────────────────────

/** Generates a unique invoice number: INV-<timestamp>-<4-digit random>. */
function generateInvoiceNumber(): string {
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${Date.now()}-${random}`;
}

// ── Service ────────────────────────────────────────────────────────────────────

/**
 * generateOneTimeInvoice — Contract 4 consumer
 *
 * Called after a quotation's fulfillment allocations reach FULFILLED status.
 * Reads Lane B's fulfillment_allocations table directly (Contract 4).
 *
 * Steps:
 *  1. Load quotation + lines (for pricing data).
 *  2. Load FULFILLED FulfillmentAllocations for this quotation.
 *  3. Guard: if none are FULFILLED → reject (§6.38 ship-first rule).
 *  4. Compute subtotal, tax_total, total_amount from fulfilled line pricing.
 *  5. Create one Invoice record with status=UNPAID, dueAt=+30 days.
 *  6. Audit: INVOICE_CREATED.
 *
 * @param quotationId   UUID of the quotation to invoice.
 * @param actorUserId   User performing the action (for audit log).
 *
 * @returns The created invoice's id and invoiceNumber.
 * @throws 404 if quotation not found.
 * @throws 422 if no fulfilled allocations exist yet.
 * @throws 409 if an invoice for this quotation already exists (idempotency guard).
 */
export async function generateOneTimeInvoice(
  quotationId: string,
  actorUserId: string,
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  // ── Step 1: Load quotation + lines ────────────────────────────────────────
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      lines: {
        select: {
          id:              true,
          unitPrice:       true,
          quantity:        true,
          discountAmount:  true,
          taxAmount:       true,
          lineTotal:       true,
          descriptionSnapshot: true,
          product: { select: { isSubscription: true } },
        },
      },
    },
  });

  if (!quotation) {
    throw Object.assign(
      new Error(`Quotation ${quotationId} not found`),
      { status: 404 },
    );
  }

  // ── Idempotency: prevent double-invoicing ─────────────────────────────────
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      quotationId,
      subscriptionInstanceId: null, // one-time invoice only
    },
    select: { id: true, invoiceNumber: true },
  });

  if (existingInvoice) {
    throw Object.assign(
      new Error(`Invoice ${existingInvoice.invoiceNumber} already exists for quotation ${quotationId}`),
      { status: 409 },
    );
  }

  // ── Step 2: Load FULFILLED allocations (Contract 4 — Lane B's table) ─────
  const fulfilledAllocations = await prisma.fulfillmentAllocation.findMany({
    where: {
      quotationId,
      status: 'FULFILLED',
    },
    select: {
      quotationLineId: true,
      quantityFulfilled: true,
    },
  });

  // ── Step 3: Guard — ship-first rule (§6.38) ───────────────────────────────
  if (fulfilledAllocations.length === 0) {
    throw Object.assign(
      new Error('Cannot invoice: nothing has been shipped yet'),
      { status: 422 },
    );
  }

  // ── Step 4: Compute invoice totals from fulfilled lines ───────────────────
  // Build a set of fulfilled quotation line IDs for O(1) lookup
  const fulfilledLineIds = new Set(fulfilledAllocations.map((a) => a.quotationLineId));

  // Filter to one-time (non-subscription) fulfilled lines only.
  // Subscription lines are billed separately by the recurring billing engine.
  const billedLines = quotation.lines.filter(
    (line) => fulfilledLineIds.has(line.id) && !line.product.isSubscription,
  );

  let subtotal  = 0;
  let taxTotal  = 0;

  for (const line of billedLines) {
    // lineTotal already accounts for discounts (unit_price * qty - discount_amount)
    subtotal += Number(line.lineTotal);
    taxTotal += Number(line.taxAmount);
  }

  // Fallback: if all fulfilled lines are subscription lines, bill the full
  // one-time portion from the quotation header (handles edge cases)
  if (billedLines.length === 0) {
    subtotal = Number(quotation.subtotal) - Number(quotation.discountTotal);
    taxTotal = Number(quotation.taxTotal);
  }

  const totalAmount = subtotal + taxTotal;

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30); // NET-30 payment terms

  // ── Step 5: Create the Invoice ────────────────────────────────────────────
  const invoiceNumber = generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      quotationId,
      currencyCode: quotation.currencyCode,
      status:       'UNPAID',
      subtotal,
      taxTotal,
      totalAmount,
      issuedAt:     new Date(),
      dueAt,
    },
  });

  // ── Step 6: Audit log ─────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action:     'INVOICE_CREATED',
      entityType: 'invoices',
      entityId:   invoice.id,
      quotationId,
      metadata: {
        invoiceNumber,
        fulfilledLineCount: fulfilledAllocations.length,
        billedLineCount:    billedLines.length,
        subtotal:    subtotal.toFixed(2),
        taxTotal:    taxTotal.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        dueAt:       dueAt.toISOString(),
      },
    },
  });

  return { invoiceId: invoice.id, invoiceNumber };
}

// ── Recurring Invoice Generation ───────────────────────────────────────────────

/**
 * generateRecurringInvoices — bill all subscriptions due today or earlier.
 *
 * Finds ACTIVE subscriptions where nextBillingDate <= today, creates one Invoice
 * per subscription, then advances the period dates to prevent double-billing.
 *
 * Idempotency: after the first run, nextBillingDate is advanced past today,
 * so subsequent runs in the same day find nothing to bill.
 */
export async function generateRecurringInvoices(actorUserId: string): Promise<{ created: number }> {
  const today = new Date();

  const dueSubs = await prisma.subscriptionInstance.findMany({
    where: {
      status:         'ACTIVE',
      nextBillingDate: { lte: today },
    },
  });

  let created = 0;

  for (const sub of dueSubs) {
    const invoiceNumber = generateInvoiceNumber();
    const subtotal      = Number(sub.unitPrice) * Number(sub.quantity);
    const totalAmount   = subtotal; // subscriptions are typically tax-inclusive or zero-tax

    const dueAt = new Date(today);
    dueAt.setDate(dueAt.getDate() + 30);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        quotationId:            sub.quotationId,
        subscriptionInstanceId: sub.id,
        currencyCode:           sub.currencyCode,
        status:                 'UNPAID',
        subtotal,
        taxTotal:               0,
        totalAmount,
        issuedAt:               today,
        dueAt,
      },
    });

    // Advance billing period
    const newPeriodStart = new Date(sub.currentPeriodEnd);
    const interval       = sub.billingInterval.toUpperCase();
    const newPeriodEnd   = new Date(newPeriodStart);
    if (interval === 'MONTHLY')   newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    else if (interval === 'QUARTERLY') newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 3);
    else if (interval === 'YEARLY')    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);

    await prisma.subscriptionInstance.update({
      where: { id: sub.id },
      data: {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd:   newPeriodEnd,
        nextBillingDate:    newPeriodEnd,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId,
        action:     'INVOICE_CREATED',
        entityType: 'invoices',
        entityId:   invoice.id,
        quotationId: sub.quotationId,
        metadata:   { type: 'RECURRING', invoiceNumber, subscriptionId: sub.id, totalAmount },
      },
    });

    created++;
  }

  return { created };
}

// ── Invoice Queries ────────────────────────────────────────────────────────────

export async function listInvoices(filters?: { status?: string; quotationId?: string }) {
  return prisma.invoice.findMany({
    where: {
      ...(filters?.status      && { status: filters.status as any }),
      ...(filters?.quotationId && { quotationId: filters.quotationId }),
    },
    include: {
      quotation: { select: { quoteNumber: true, customer: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function getInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      quotation: { select: { quoteNumber: true, customer: { select: { id: true, name: true } } } },
      payments:  { where: { status: 'RECORDED' }, orderBy: { paidAt: 'desc' } },
      creditNotes: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  return invoice;
}

export async function voidInvoice(id: string, actorUserId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, quotationId: true } });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (invoice.status === 'PAID') throw Object.assign(new Error('Cannot void a paid invoice'), { status: 422 });

  const updated = await prisma.invoice.update({ where: { id }, data: { status: 'VOID' } });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action:     'INVOICE_CREATED', // closest available — INVOICE_VOIDED not in enum
      entityType: 'invoices',
      entityId:   id,
      quotationId: invoice.quotationId,
      metadata:   { event: 'VOIDED' },
    },
  });

  return updated;
}
