/**
 * DealHealthService — automated flag detection for the Deal Health monitor
 *
 * Spec refs: §6.41 (deal health flag types), §5.27 (deal_health_flags table)
 *
 * This service is called on a schedule (e.g. cron) by a background job.
 * It does NOT require an actorUserId — flags are system-generated, not
 * user-triggered. AuditLog is intentionally omitted here (actor = system).
 *
 * DealHealthType enum: STALLED | DISCOUNT_ANOMALY | DELIVERY_SLIPPAGE
 * DealHealthStatus enum: OPEN | ACKNOWLEDGED | RESOLVED | DISMISSED
 *
 * Schema reality notes (vs. spec prompt):
 *   - No `flag_type` column — field is `type: DealHealthType`.
 *   - No `is_acknowledged` boolean — existence check uses `status: 'OPEN'`
 *     (an OPEN flag is one not yet ACKNOWLEDGED, RESOLVED, or DISMISSED).
 *   - No `description` column — field is `message`.
 *   - `detectedValue` (Decimal?) used to store days inactive for STALLED flags.
 */

import { prisma } from '../../lib/prisma.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Compute whole-day difference: dateA - dateB in days. */
function daysBetween(dateA: Date, dateB: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / MS_PER_DAY);
}

/**
 * Determine severity based on how many days inactive.
 * > 14 days → HIGH, otherwise → MEDIUM
 * (Assumes caller has already filtered for >= stalledDays, so min is MEDIUM.)
 */
function stalledSeverity(daysInactive: number): string {
  return daysInactive > 14 ? 'HIGH' : 'MEDIUM';
}

// ── Detectors ──────────────────────────────────────────────────────────────────

/**
 * detectStalled — find quotations that haven't been updated in stalledDays days.
 *
 * Only checks "in-flight" statuses:
 *   DRAFT | PENDING_APPROVAL | APPROVED | UNDER_NEGOTIATION
 *
 * Statuses intentionally excluded:
 *   CONFIRMED — deal is won; not stalled.
 *   REJECTED  — deal is dead; stalling is irrelevant.
 *
 * Idempotency: skips quotations that already have an OPEN STALLED flag.
 * Running the detector multiple times per day never creates duplicate flags.
 *
 * @param stalledDays  Inactivity threshold in days (default: 7).
 * @returns Number of new DealHealthFlag rows created.
 */
export async function detectStalled(stalledDays: number = 7): Promise<number> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - stalledDays);

  // ── Step 1: Query stalled quotations ──────────────────────────────────────
  // updatedAt < threshold means the quotation hasn't been touched in stalledDays+ days
  const stalledQuotations = await prisma.quotation.findMany({
    where: {
      status: {
        in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'UNDER_NEGOTIATION'],
      },
      updatedAt: { lt: threshold },
    },
    select: {
      id:        true,
      updatedAt: true,
    },
  });

  if (stalledQuotations.length === 0) {
    return 0;
  }

  const now = new Date();
  let created = 0;

  for (const quotation of stalledQuotations) {
    // ── Step 2a: Check for an existing OPEN STALLED flag (idempotency) ──────
    const existingFlag = await prisma.dealHealthFlag.findFirst({
      where: {
        quotationId: quotation.id,
        type:        'STALLED',
        status:      'OPEN',           // not yet acknowledged or resolved
      },
      select: { id: true },
    });

    if (existingFlag) {
      continue; // already flagged — skip to avoid duplicates
    }

    // ── Step 2b: Create a new STALLED flag ───────────────────────────────────
    const daysInactive = daysBetween(now, new Date(quotation.updatedAt));
    const severity     = stalledSeverity(daysInactive);

    await prisma.dealHealthFlag.create({
      data: {
        quotationId:    quotation.id,
        type:           'STALLED',
        status:         'OPEN',
        severity,
        message:        `Quotation inactive for ${daysInactive} day${daysInactive !== 1 ? 's' : ''}`,
        detectedAt:     now,
        detectedValue:  daysInactive,   // days inactive (useful for dashboards)
        expectedValue:  stalledDays,    // configured threshold
      },
    });

    created++;
  }

  // ── Step 3: Return new flag count ─────────────────────────────────────────
  return created;
}

// ── Discount Anomaly Detection ─────────────────────────────────────────────────

/**
 * detectDiscountAnomalies — flag quotations where a rep's discount is abnormally high.
 *
 * Spec refs: §6.42 (discount anomaly rule), §5.27 (deal_health_flags)
 *
 * Algorithm per rep:
 *  1. Compute the rep's historical baseline: AVG(discountPercent) across all
 *     lines of their last 20 quotations.
 *  2. For each of their quotations created in the last 7 days, compute the
 *     average discount across its lines.
 *  3. If currentAvg > historicalAvg × anomalyThreshold → create DISCOUNT_ANOMALY flag.
 *
 * Severity rules:
 *   currentAvg > historicalAvg × 2 × threshold → HIGH
 *   currentAvg > historicalAvg × threshold     → MEDIUM
 *
 * Idempotency: skips quotations already carrying an OPEN DISCOUNT_ANOMALY flag.
 * Zero-avg guard: skips reps whose historical avg is 0 (no discount data yet)
 *   to avoid spurious flags for new reps.
 *
 * @param anomalyThreshold  Multiplier above historical avg that triggers a flag (default: 1.5).
 * @returns Number of new DealHealthFlag rows created.
 */
export async function detectDiscountAnomalies(
  anomalyThreshold: number = 1.5,
): Promise<number> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  // ── Step 1: Load all active SALES_REP users ────────────────────────────────
  const reps = await prisma.user.findMany({
    where: { role: 'SALES_REP', isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  let created = 0;

  for (const rep of reps) {
    // ── Step 2a: Historical baseline — last 20 quotation IDs ────────────────
    const historicalQuotations = await prisma.quotation.findMany({
      where:   { salesRepId: rep.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select:  { id: true },
    });

    if (historicalQuotations.length === 0) continue; // new rep — no history

    const historicalIds = historicalQuotations.map((q) => q.id);

    // Single aggregate query across all lines in those 20 quotations
    const agg = await prisma.quotationLine.aggregate({
      where: { quotationId: { in: historicalIds } },
      _avg:  { discountPercent: true },
      _count: true,
    });

    const historicalAvg = Number(agg._avg.discountPercent ?? 0);

    // Skip reps with no line data or zero average (guards against false positives
    // and division-by-zero in threshold math)
    if (agg._count === 0 || historicalAvg === 0) continue;

    // ── Step 2b: Recent quotations (last 7 days) for this rep ───────────────
    const recentQuotations = await prisma.quotation.findMany({
      where: {
        salesRepId: rep.id,
        createdAt:  { gte: sevenDaysAgo },
        // Only check active/in-flight quotations
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'UNDER_NEGOTIATION'] },
      },
      select: {
        id: true,
        lines: {
          select: { discountPercent: true },
        },
      },
    });

    for (const quotation of recentQuotations) {
      if (quotation.lines.length === 0) continue;

      // ── Step 2c: Average discount across this quotation's lines ───────────
      const lineDiscounts   = quotation.lines.map((l) => Number(l.discountPercent));
      const currentAvg      = lineDiscounts.reduce((sum, d) => sum + d, 0) / lineDiscounts.length;

      // ── Step 2d: Threshold check ──────────────────────────────────────────
      if (currentAvg <= historicalAvg * anomalyThreshold) continue;

      // Idempotency: skip if an OPEN flag already exists for this quotation
      const existingFlag = await prisma.dealHealthFlag.findFirst({
        where: {
          quotationId: quotation.id,
          type:        'DISCOUNT_ANOMALY',
          status:      'OPEN',
        },
        select: { id: true },
      });

      if (existingFlag) continue;

      // Severity: HIGH if more than 2× threshold above historical, else MEDIUM
      const severity = currentAvg > historicalAvg * 2 * anomalyThreshold ? 'HIGH' : 'MEDIUM';

      await prisma.dealHealthFlag.create({
        data: {
          quotationId:   quotation.id,
          type:          'DISCOUNT_ANOMALY',
          status:        'OPEN',
          severity,
          message:       `Discount ${currentAvg.toFixed(2)}% is significantly above rep's average of ${historicalAvg.toFixed(2)}%`,
          detectedAt:    now,
          detectedValue: currentAvg,     // actual discount avg on this quotation
          expectedValue: historicalAvg,  // rep's historical baseline
        },
      });

      created++;
    }
  }

  return created;
}

// ── Delivery Slippage Detection ────────────────────────────────────────────────

/**
 * detectDeliverySlippage — flag fulfillment allocations pending too long.
 *
 * Checks allocations with status SPLIT_PENDING or PARTIAL that were created
 * more than slippageDays ago. Idempotent — skips quotations with an existing
 * OPEN DELIVERY_SLIPPAGE flag.
 */
export async function detectDeliverySlippage(slippageDays: number = 5): Promise<number> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - slippageDays);

  const pendingAllocations = await prisma.fulfillmentAllocation.findMany({
    where: {
      status:    { in: ['SPLIT_PENDING', 'PARTIAL'] },
      createdAt: { lt: threshold },
    },
    select: { quotationId: true, createdAt: true, status: true },
  });

  if (pendingAllocations.length === 0) return 0;

  const now = new Date();
  let created = 0;

  // Deduplicate by quotationId (multiple allocations per quotation possible)
  const seen = new Set<string>();
  for (const alloc of pendingAllocations) {
    if (seen.has(alloc.quotationId)) continue;
    seen.add(alloc.quotationId);

    const existingFlag = await prisma.dealHealthFlag.findFirst({
      where: { quotationId: alloc.quotationId, type: 'DELIVERY_SLIPPAGE', status: 'OPEN' },
      select: { id: true },
    });
    if (existingFlag) continue;

    const daysLate = daysBetween(now, new Date(alloc.createdAt));
    const severity = daysLate > 14 ? 'HIGH' : 'MEDIUM';

    await prisma.dealHealthFlag.create({
      data: {
        quotationId:   alloc.quotationId,
        type:          'DELIVERY_SLIPPAGE',
        status:        'OPEN',
        severity,
        message:       `Fulfillment ${alloc.status.toLowerCase().replace('_', ' ')} for ${daysLate} day${daysLate !== 1 ? 's' : ''}`,
        detectedAt:    now,
        detectedValue: daysLate,
        expectedValue: slippageDays,
      },
    });
    created++;
  }

  return created;
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

/**
 * evaluate — run all three detectors and return a summary.
 * Called by both the HTTP endpoint (manual trigger) and the background worker.
 */
export async function evaluate(opts?: { stalledDays?: number; anomalyThreshold?: number; slippageDays?: number }) {
  const [stalled, anomalies, slippage] = await Promise.all([
    detectStalled(opts?.stalledDays),
    detectDiscountAnomalies(opts?.anomalyThreshold),
    detectDeliverySlippage(opts?.slippageDays),
  ]);
  return { stalled, anomalies, slippage, total: stalled + anomalies + slippage };
}

// ── Flag Queries & Actions ─────────────────────────────────────────────────────

export async function listFlags(filters?: { type?: string; status?: string; severity?: string }) {
  return prisma.dealHealthFlag.findMany({
    where: {
      ...(filters?.type     && { type:     filters.type as any }),
      ...(filters?.status   && { status:   filters.status as any }),
      ...(filters?.severity && { severity: filters.severity }),
    },
    include: {
      quotation: { select: { quoteNumber: true, customer: { select: { name: true } } } },
    },
    orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
  });
}

export async function getFlag(id: string) {
  const flag = await prisma.dealHealthFlag.findUnique({
    where: { id },
    include: { quotation: { select: { quoteNumber: true, customerId: true } } },
  });
  if (!flag) throw Object.assign(new Error('Flag not found'), { status: 404 });
  return flag;
}

export async function acknowledgeFlag(id: string, actorUserId: string) {
  const flag = await prisma.dealHealthFlag.findUnique({ where: { id }, select: { status: true, quotationId: true } });
  if (!flag) throw Object.assign(new Error('Flag not found'), { status: 404 });

  const updated = await prisma.dealHealthFlag.update({
    where: { id },
    data: { status: 'ACKNOWLEDGED', acknowledgedBy: actorUserId, acknowledgedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action:     'DEAL_HEALTH_UPDATED',
      entityType: 'deal_health_flags',
      entityId:   id,
      quotationId: flag.quotationId,
      metadata:   { event: 'ACKNOWLEDGED' },
    },
  });

  return updated;
}

export async function resolveFlag(id: string, actorUserId: string) {
  const flag = await prisma.dealHealthFlag.findUnique({ where: { id }, select: { status: true, quotationId: true } });
  if (!flag) throw Object.assign(new Error('Flag not found'), { status: 404 });

  const updated = await prisma.dealHealthFlag.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedBy: actorUserId, resolvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action:     'DEAL_HEALTH_UPDATED',
      entityType: 'deal_health_flags',
      entityId:   id,
      quotationId: flag.quotationId,
      metadata:   { event: 'RESOLVED' },
    },
  });

  return updated;
}
