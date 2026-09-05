/**
 * SubscriptionService — Contract 3 and subscription lifecycle helpers
 *
 * Spec refs: §6.34 (subscription creation from confirmed quotation),
 *            §5.23 (subscription_instances table),
 *            §5.16 (quotation_lines — no line_type column; recurring lines are
 *                   identified by product.isSubscription === true)
 *
 * Contract 3: Lane B's confirm-quotation handler calls
 *   createFromConfirmedQuotation(quotationId, actorUserId)
 * after setting quotation.status = CONFIRMED.
 */

import { prisma } from '../../lib/prisma.js';

// ── Interval helpers ───────────────────────────────────────────────────────────

/**
 * Supported billing intervals sourced from product.recurringInterval.
 * Schema stores a VarChar(20); we normalise to these values.
 */
export type BillingInterval = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

const DEFAULT_INTERVAL: BillingInterval = 'MONTHLY';

/**
 * Add a billing interval to a Date, returning a new Date.
 * Uses plain date arithmetic — no external libraries required.
 */
function addInterval(date: Date, interval: BillingInterval): Date {
  const result = new Date(date);
  switch (interval) {
    case 'MONTHLY':
      result.setMonth(result.getMonth() + 1);
      break;
    case 'QUARTERLY':
      result.setMonth(result.getMonth() + 3);
      break;
    case 'YEARLY':
      result.setFullYear(result.getFullYear() + 1);
      break;
  }
  return result;
}

/**
 * Normalise the raw product.recurringInterval string to a valid BillingInterval.
 * Falls back to MONTHLY if null / unknown.
 */
function normaliseBillingInterval(raw: string | null): BillingInterval {
  const upper = (raw ?? '').toUpperCase();
  if (upper === 'MONTHLY' || upper === 'QUARTERLY' || upper === 'YEARLY') {
    return upper as BillingInterval;
  }
  return DEFAULT_INTERVAL;
}

// ── Contract 3 ─────────────────────────────────────────────────────────────────

/**
 * createFromConfirmedQuotation — Contract 3
 *
 * Called by Lane B's confirm-quotation endpoint immediately after the quotation
 * status flips to CONFIRMED.
 *
 * Steps:
 *  1. Load the quotation + all lines, including each line's product.
 *  2. Identify "recurring lines": lines whose product.isSubscription === true.
 *  3. If none → return early (pure one-time order).
 *  4. For each recurring line, create one SubscriptionInstance.
 *  5. Write one SUBSCRIPTION_CREATED audit entry per instance.
 *
 * @param quotationId  The confirmed quotation's UUID.
 * @param actorUserId  The user ID who triggered confirmation (for audit log).
 *
 * @throws 404-tagged error if the quotation is not found.
 */
export async function createFromConfirmedQuotation(
  quotationId: string,
  actorUserId: string,
): Promise<void> {
  // ── Step 1: Load quotation + lines + products ──────────────────────────────
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      lines: {
        include: {
          product: {
            select: {
              id: true,
              isSubscription: true,
              recurringInterval: true,
            },
          },
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

  // ── Step 2: Filter recurring lines (§5.16 — no line_type column; use product flag) ──
  const recurringLines = quotation.lines.filter(
    (line) => line.product.isSubscription === true,
  );

  // ── Step 3: Nothing to do for pure one-time orders ─────────────────────────
  if (recurringLines.length === 0) {
    return;
  }

  // ── Step 4: Create one SubscriptionInstance per recurring line ─────────────
  const periodStart = quotation.confirmedAt ?? new Date();

  for (const line of recurringLines) {
    const interval = normaliseBillingInterval(line.product.recurringInterval);
    const periodEnd = addInterval(periodStart, interval);

    const subscription = await prisma.subscriptionInstance.create({
      data: {
        quotationId:     quotation.id,
        quotationLineId: line.id,
        customerId:      quotation.customerId,
        productId:       line.product.id,
        status:          'ACTIVE',
        quantity:        line.quantity,
        unitPrice:       line.unitPrice,
        currencyCode:    quotation.currencyCode,
        billingInterval: interval,
        // Store dates as Date objects — Prisma maps @db.Date correctly
        currentPeriodStart: periodStart,
        currentPeriodEnd:   periodEnd,
        nextBillingDate:    periodEnd,
      },
    });

    // ── Step 5: Audit log per instance ───────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action:     'SUBSCRIPTION_CREATED',
        entityType: 'subscription_instances',
        entityId:   subscription.id,
        quotationId: quotation.id,
        metadata: {
          quotationLineId: line.id,
          productId:       line.product.id,
          billingInterval: interval,
          periodStart:     periodStart.toISOString(),
          periodEnd:       periodEnd.toISOString(),
        },
      },
    });
  }
}

// ── Subscription modification ──────────────────────────────────────────────────

/**
 * Return the whole-day difference between two dates (dateA - dateB).
 * Plain arithmetic — no external libraries.
 */
function differenceInDays(dateA: Date, dateB: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / MS_PER_DAY);
}

/**
 * modifySubscription — change quantity and/or billing interval mid-cycle.
 *
 * Spec refs: §6.35 (proration rules), §5.23 (subscription_instances),
 *            §5.26 (credit_notes)
 *
 * Proration formula:
 *   used_fraction     = days_used / days_in_period   (0 ≤ fraction ≤ 1)
 *   remaining_fraction = 1 - used_fraction
 *   old_amount        = oldUnitPrice × oldQuantity
 *   new_amount        = oldUnitPrice × newQuantity
 *   credit            = old_amount × remaining_fraction
 *   charge            = new_amount × remaining_fraction
 *   adjustment        = charge - credit
 *
 * If adjustment < 0  → downgrade; issue a CreditNote.
 * If adjustment ≥ 0  → upgrade; caller invoices the extra charge separately.
 *
 * Schema constraint: CreditNote.invoiceId is NOT NULL — we look up the most
 * recent invoice for this subscription. If no invoice exists yet (e.g. first
 * billing cycle hasn't run), we log a warning and skip credit note creation.
 *
 * @param subscriptionId  UUID of the SubscriptionInstance to modify.
 * @param changes         Fields to change (at least one must be provided).
 * @param actorUserId     Performer of the action (for audit log).
 *
 * @returns Object with the updated subscription and the proration adjustment amount.
 * @throws 404-tagged error if subscription not found.
 */
export async function modifySubscription(
  subscriptionId: string,
  changes: { newQuantity?: number; newPlanInterval?: BillingInterval },
  actorUserId: string,
): Promise<{ prorataAdjustment: number }> {
  // ── Step 1: Load subscription ───────────────────────────────────────────────
  const sub = await prisma.subscriptionInstance.findUnique({
    where: { id: subscriptionId },
  });

  if (!sub) {
    throw Object.assign(
      new Error(`Subscription ${subscriptionId} not found`),
      { status: 404 },
    );
  }

  if (sub.status !== 'ACTIVE') {
    throw Object.assign(
      new Error(`Cannot modify a subscription with status ${sub.status}`),
      { status: 422 },
    );
  }

  // ── Step 2: Proration fractions ─────────────────────────────────────────────
  const today     = new Date();
  const periodStart = new Date(sub.currentPeriodStart);
  const periodEnd   = new Date(sub.currentPeriodEnd);

  const daysUsed    = Math.max(0, differenceInDays(today, periodStart));
  const daysInPeriod = Math.max(1, differenceInDays(periodEnd, periodStart)); // guard /0
  const usedFraction      = Math.min(daysUsed / daysInPeriod, 1);            // clamp at 1
  const remainingFraction = 1 - usedFraction;

  // ── Step 3: Proration amounts ────────────────────────────────────────────────
  const oldQty    = Number(sub.quantity);
  const newQty    = changes.newQuantity ?? oldQty;
  const unitPrice = Number(sub.unitPrice);

  const oldAmount    = unitPrice * oldQty;
  const newAmount    = unitPrice * newQty;
  const creditForRemaining = oldAmount * remainingFraction;
  const chargeForRemaining = newAmount * remainingFraction;
  const adjustment         = chargeForRemaining - creditForRemaining; // + = more to pay, - = refund

  // ── Step 4: Issue credit note when adjustment < 0 (downgrade) ──────────────
  if (adjustment < 0) {
    // CreditNote.invoiceId is NOT NULL — find latest invoice for this subscription
    const latestInvoice = await prisma.invoice.findFirst({
      where: { subscriptionInstanceId: subscriptionId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, currencyCode: true },
    });

    if (latestInvoice) {
      const creditAmount = Math.abs(adjustment);
      const creditNoteNumber = `CN-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      await prisma.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId:             latestInvoice.id,
          subscriptionInstanceId: subscriptionId,
          amount:      creditAmount,
          currencyCode: latestInvoice.currencyCode,
          reason:  `Proration credit for subscription downgrade (${oldQty} → ${newQty} units, ${Math.round(remainingFraction * 100)}% of period remaining)`,
          status:  'DRAFT',
          createdBy: actorUserId,
        },
      });
    } else {
      // No invoice exists yet — credit note can't be created; caller should be aware.
      console.warn(
        `[SubscriptionService] modifySubscription: adjustment is negative (${adjustment.toFixed(2)}) ` +
        `but no invoice found for subscription ${subscriptionId}. Credit note skipped.`,
      );
    }
  }

  // ── Step 5: Apply changes to the subscription ───────────────────────────────
  await prisma.subscriptionInstance.update({
    where: { id: subscriptionId },
    data: {
      ...(changes.newQuantity     !== undefined && { quantity:        changes.newQuantity }),
      ...(changes.newPlanInterval !== undefined && { billingInterval: changes.newPlanInterval }),
    },
  });

  // ── Step 6: Audit log ────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action:     'SUBSCRIPTION_UPDATED',
      entityType: 'subscription_instances',
      entityId:   subscriptionId,
      quotationId: sub.quotationId,
      metadata: {
        oldQuantity:        oldQty,
        newQuantity:        newQty,
        oldInterval:        sub.billingInterval,
        newInterval:        changes.newPlanInterval ?? sub.billingInterval,
        daysUsed,
        daysInPeriod,
        usedFractionPct:    Math.round(usedFraction * 10000) / 100,  // e.g. 33.33
        prorataAdjustment:  Math.round(adjustment * 100) / 100,
      },
    },
  });

  return { prorataAdjustment: Math.round(adjustment * 100) / 100 };
}

// ── Cancellation ───────────────────────────────────────────────────────────────

/**
 * cancelSubscription — cancel mid-cycle, optionally issue a prorated credit note.
 *
 * If a refund is due (remaining fraction > 0) AND an invoice exists for this
 * subscription, a DRAFT CreditNote is created automatically.
 */
export async function cancelSubscription(
  subscriptionId: string,
  actorUserId: string,
): Promise<{ refundAmount: number }> {
  const sub = await prisma.subscriptionInstance.findUnique({
    where: { id: subscriptionId },
  });
  if (!sub) throw Object.assign(new Error(`Subscription ${subscriptionId} not found`), { status: 404 });
  if (sub.status !== 'ACTIVE') {
    throw Object.assign(new Error(`Cannot cancel a ${sub.status} subscription`), { status: 422 });
  }

  const today       = new Date();
  const periodStart = new Date(sub.currentPeriodStart);
  const periodEnd   = new Date(sub.currentPeriodEnd);
  const MS_PER_DAY  = 1000 * 60 * 60 * 24;
  const daysUsed    = Math.max(0, Math.floor((today.getTime() - periodStart.getTime()) / MS_PER_DAY));
  const daysInPeriod = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY));
  const usedFraction = Math.min(daysUsed / daysInPeriod, 1);
  const remainingFraction = 1 - usedFraction;

  const periodAmount  = Number(sub.unitPrice) * Number(sub.quantity);
  const refundAmount  = Math.round(periodAmount * remainingFraction * 100) / 100;

  // Create credit note if refund is due and an invoice exists
  if (refundAmount > 0) {
    const latestInvoice = await prisma.invoice.findFirst({
      where:   { subscriptionInstanceId: subscriptionId },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, currencyCode: true },
    });
    if (latestInvoice) {
      const cnNumber = `CN-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      await prisma.creditNote.create({
        data: {
          creditNoteNumber:      cnNumber,
          invoiceId:             latestInvoice.id,
          subscriptionInstanceId: subscriptionId,
          amount:                refundAmount,
          currencyCode:          latestInvoice.currencyCode,
          reason:                `Cancellation refund — ${Math.round(remainingFraction * 100)}% of billing period remaining`,
          status:                'DRAFT',
          createdBy:             actorUserId,
        },
      });
    }
  }

  await prisma.subscriptionInstance.update({
    where: { id: subscriptionId },
    data:  { status: 'CANCELLED', cancelledAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action:     'SUBSCRIPTION_UPDATED',
      entityType: 'subscription_instances',
      entityId:   subscriptionId,
      quotationId: sub.quotationId,
      metadata:   { event: 'CANCELLED', refundAmount, daysUsed, daysInPeriod },
    },
  });

  return { refundAmount };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listSubscriptions(filters?: { status?: string; customerId?: string }) {
  return prisma.subscriptionInstance.findMany({
    where: {
      ...(filters?.status     && { status: filters.status as any }),
      ...(filters?.customerId && { customerId: filters.customerId }),
    },
    include: {
      customer:     { select: { id: true, name: true } },
      product:      { select: { id: true, name: true, sku: true } },
      quotationLine: false,
    },
    orderBy: { nextBillingDate: 'asc' },
  });
}

export async function getSubscription(id: string) {
  const sub = await prisma.subscriptionInstance.findUnique({
    where: { id },
    include: {
      customer:  { select: { id: true, name: true } },
      product:   { select: { id: true, name: true, sku: true } },
      invoices:  { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, invoiceNumber: true, totalAmount: true, status: true, dueAt: true } },
      creditNotes: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!sub) throw Object.assign(new Error('Subscription not found'), { status: 404 });
  return sub;
}
