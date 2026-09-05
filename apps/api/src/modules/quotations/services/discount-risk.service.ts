/**
 * Discount Risk Service — Commercial discount governance & risk evaluation
 *
 * Spec refs: §6.9 (governance rule), §6.10 (effective ceiling rule),
 *            §5.10 (discount tiers), §5.11 (category discount ceilings)
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Calculates the effective discount ceiling for a customer tier and product category.
 * Uses the stricter (MIN) applicable ceiling per §6.10.
 */
export async function getEffectiveCeiling(
  discountTierId: string,
  categoryId: string,
): Promise<number> {
  const [tier, categoryCeiling] = await Promise.all([
    discountTierId
      ? prisma.discountTier.findUnique({ where: { id: discountTierId } })
      : null,
    categoryId
      ? prisma.categoryDiscountCeiling.findUnique({ where: { categoryId } })
      : null,
  ]);

  const tierCeiling = tier && tier.isActive ? Number(tier.defaultDiscountCeiling) : null;
  const catCeiling =
    categoryCeiling && categoryCeiling.isActive ? Number(categoryCeiling.maxDiscount) : null;

  // 1. If both exist: return MIN(tier_ceiling, category_ceiling)
  if (tierCeiling !== null && catCeiling !== null) {
    return Math.min(tierCeiling, catCeiling);
  }

  // 2. If only tier exists: fall back to tier ceiling
  if (tierCeiling !== null) {
    return tierCeiling;
  }

  // 3. If neither: no discount allowed
  return 0;
}

/**
 * Calculates the discount overage for a line per §6.11:
 * overage = MAX(0, requested_discount - effective_allowed_discount)
 */
export function calculateLineOverage(discountPercent: number, effectiveCeiling: number): number {
  return Math.max(0, Number((discountPercent - effectiveCeiling).toFixed(4)));
}

export interface LineRiskDetail {
  lineId: string;
  effectiveCeiling: number;
  overage: number;
  discountPercent: number;
}

export interface BlendedRiskResult {
  riskScore: number;
  lineDetails: LineRiskDetail[];
}

/**
 * Calculates the blended risk score for a quotation per §6.11–6.12.
 * Evaluates overage for each line, updates lines with their overage and ceiling in DB,
 * and returns the cumulative blended risk score with line-level details.
 */
export async function calculateBlendedRisk(quotationId: string): Promise<BlendedRiskResult> {
  // 1. Load quotation with customer discount tier and all lines with product category
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      customer: {
        select: { discountTierId: true },
      },
      lines: {
        include: {
          product: {
            select: { categoryId: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!quotation) {
    throw new Error('Quotation not found');
  }

  const discountTierId = quotation.customer?.discountTierId ?? '';
  let sumOverages = 0;
  const lineDetails: LineRiskDetail[] = [];

  // 2. Evaluate overage for each line
  for (const line of quotation.lines) {
    const discountPercent = Number(line.discountPercent);
    const categoryId = line.product.categoryId;
    const effectiveCeiling = await getEffectiveCeiling(discountTierId, categoryId);
    const overage = calculateLineOverage(discountPercent, effectiveCeiling);

    // 3c. Store overage and allowed ceiling on the line (update in DB)
    await prisma.quotationLine.update({
      where: { id: line.id },
      data: {
        allowedDiscountPercent: effectiveCeiling,
        discountOveragePercent: overage,
      },
    });

    sumOverages = Number((sumOverages + overage).toFixed(4));

    lineDetails.push({
      lineId: line.id,
      effectiveCeiling,
      overage,
      discountPercent,
    });
  }

  // 4. Update blended risk score on quotation
  const riskScore = sumOverages;
  await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      blendedRiskScore: riskScore,
    },
  });

  // 5. Return riskScore and lineDetails
  return {
    riskScore,
    lineDetails,
  };
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Determines the risk level from the blended risk score per §6.14:
 * score === 0           → LOW (no approval needed)
 * score > 0 && score <= 5 → MEDIUM (manager approval)
 * score > 5             → HIGH (manager + finance approval)
 */
export function determineRiskLevel(score: number): RiskLevel {
  if (score === 0) return 'LOW';
  if (score <= 5) return 'MEDIUM';
  return 'HIGH';
}

export interface EvaluateAndRouteResult {
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  riskScore: number;
}

/**
 * Contract 1 — Commercial Risk Evaluation & Approval Routing
 * Called by Lane A (quotation submit) and Lane B (after negotiation updates terms).
 *
 * Logic:
 * 1. Call calculateBlendedRisk(quotationId)
 * 2. Determine risk level from score:
 *    score === 0         → LOW (no approval)
 *    score > 0 && <= 5   → MEDIUM (manager only)
 *    score > 5           → HIGH (manager + finance)
 * 3. Return { requiresApproval: riskLevel !== 'LOW', riskLevel, riskScore }
 */
export async function evaluateAndRoute(quotationId: string): Promise<EvaluateAndRouteResult> {
  // 1. Calculate blended risk score and evaluate all line overages
  const { riskScore } = await calculateBlendedRisk(quotationId);

  // 2. Determine risk level from score
  const riskLevel = determineRiskLevel(riskScore);

  // Update quotation's risk level in DB
  await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      riskLevel,
    },
  });

  // 3. Return routing decision
  return {
    requiresApproval: riskLevel !== 'LOW',
    riskLevel,
    riskScore,
  };
}


