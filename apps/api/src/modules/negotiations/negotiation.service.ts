/**
 * Negotiation Service — Business logic for customer quotation negotiations
 *
 * Spec refs: §6.21 (Negotiation rules & state machine), UC-12 (Negotiate quotation),
 *            §5.19 (negotiation_requests table), §5.28 (audit_logs table)
 */

import { prisma } from '../../lib/prisma.js';
import {
  QuotationStatus,
  NegotiationType,
  NegotiationStatus,
  AuditAction,
} from '@prisma/client';
import { QuotationCalculatorService } from '../quotations/services/quotation-calculator.service.js';

export interface CreateNegotiationRequestInput {
  type: 'COMMENT' | 'CHANGE_REQUEST' | 'COUNTER_DISCOUNT' | 'DELIVERY_DATE' | string;
  lineId?: string;
  content: string;
  proposedDiscount?: number;
  requestedDeliveryDate?: Date;
}

export interface ResolveNegotiationInput {
  accepted: boolean;
  adjustedDiscount?: number;
  comment?: string;
}

import { evaluateAndRoute } from '../quotations/services/discount-risk.service.js';
import { createApprovalRequest } from '../approvals/approval.service.js';

/**
 * Maps incoming negotiation request type to Prisma schema enum.
 */
function mapNegotiationType(type: string): NegotiationType {
  switch (type) {
    case 'COMMENT':
    case 'LINE_COMMENT':
      return NegotiationType.LINE_COMMENT;
    case 'CHANGE_REQUEST':
      return NegotiationType.CHANGE_REQUEST;
    case 'COUNTER_DISCOUNT':
      return NegotiationType.COUNTER_DISCOUNT;
    case 'DELIVERY_DATE':
    case 'DELIVERY_DATE_REQUEST':
      return NegotiationType.DELIVERY_DATE_REQUEST;
    default:
      return NegotiationType.CHANGE_REQUEST;
  }
}

/**
 * Creates a new customer negotiation request against an eligible quotation.
 *
 * Preconditions:
 * 1. Quotation must exist and belong to the calling customer organization.
 * 2. Quotation must be in an active, negotiable state (APPROVED or UNDER_NEGOTIATION).
 *
 * Effects:
 * - Inserts NegotiationRequest record with status OPEN.
 * - Transitions quotation from APPROVED to UNDER_NEGOTIATION (if currently APPROVED).
 * - Records audit trail entry.
 */
export async function createNegotiationRequest(
  quotationId: string,
  customerId: string,
  request: CreateNegotiationRequestInput,
  userId?: string
) {
  // 1. Load quotation & verify ownership
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      customer: {
        include: {
          users: { select: { id: true } },
        },
      },
    },
  });

  if (!quotation) {
    throw new Error('Quotation not found');
  }

  if (quotation.customerId !== customerId) {
    throw new Error('Quotation does not belong to this customer');
  }

  // 2. Verify quotation is in a negotiable state (§6.21)
  const NEGOTIABLE_STATUSES: QuotationStatus[] = [
    QuotationStatus.APPROVED,
    QuotationStatus.UNDER_NEGOTIATION,
  ];

  if (!NEGOTIABLE_STATUSES.includes(quotation.status)) {
    throw new Error(
      `Quotation cannot be negotiated in its current status: ${quotation.status}. Only APPROVED or UNDER_NEGOTIATION quotations are eligible.`
    );
  }

  // Determine user ID for audit / requestedBy foreign key
  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const defaultUser = quotation.customer?.users?.[0];
    if (defaultUser) {
      effectiveUserId = defaultUser.id;
    } else {
      const fallbackUser = await prisma.user.findFirst({
        where: { customerId },
        select: { id: true },
      });
      effectiveUserId = fallbackUser?.id;
    }
  }

  if (!effectiveUserId) {
    throw new Error('Unable to resolve customer user for negotiation request');
  }

  // Execute creation, state transition, and audit within an atomic transaction
  return await prisma.$transaction(async (tx) => {
    // 3. Create NegotiationRequest record
    const mappedType = mapNegotiationType(request.type);
    const negotiation = await tx.negotiationRequest.create({
      data: {
        quotationId,
        customerId,
        requestedByUserId: effectiveUserId!,
        negotiationType: mappedType,
        quotationLineId: request.lineId ?? null,
        message: request.content,
        requestedDiscountPercent:
          request.proposedDiscount !== undefined && request.proposedDiscount !== null
            ? request.proposedDiscount
            : null,
        requestedDeliveryDate: request.requestedDeliveryDate ?? null,
        status: NegotiationStatus.OPEN,
      },
    });

    // 4. Transition quotation status: APPROVED → UNDER_NEGOTIATION
    if (quotation.status === QuotationStatus.APPROVED) {
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: QuotationStatus.UNDER_NEGOTIATION,
        },
      });
    }

    // 5. Append immutable audit log entry
    await tx.auditLog.create({
      data: {
        actorUserId: effectiveUserId!,
        action: AuditAction.NEGOTIATION_CREATED,
        entityType: 'negotiation_request',
        entityId: negotiation.id,
        quotationId: quotation.id,
        metadata: {
          action: 'NEGOTIATION_REQUESTED',
          type: request.type,
          proposedDiscount: request.proposedDiscount,
          content: request.content,
        },
      },
    });

    // 6. Return created negotiation request
    return negotiation;
  });
}

/**
 * Resolves a customer negotiation request.
 *
 * Logic:
 * 1. Load the negotiation request with its quotation
 * 2. If accepted AND adjustedDiscount provided:
 *    a. Update the quotation line's discount_percent to adjustedDiscount
 *    b. Increment quotation.current_version (material edit)
 *    c. Call QuotationCalculatorService.recalculateQuotation(quotationId) — imported from Lane A's module
 *    d. CALL CONTRACT 1: DiscountRiskService.evaluateAndRoute(quotationId)
 *       Stubbed until Lane A is ready
 *    e. If riskResult.requiresApproval → set quotation.status = PENDING_APPROVAL
 *       If not → quotation stays at UNDER_NEGOTIATION (customer-visible)
 * 3. Mark negotiation: status = accepted ? 'ACCEPTED' : 'REJECTED', resolved_by = repId, resolved_at = now()
 * 4. Audit: NEGOTIATION_RESOLVED
 * 5. Return updated negotiation + quotation
 */
export async function resolveNegotiation(
  negotiationId: string,
  repId: string,
  input: ResolveNegotiationInput
) {
  // 1. Load the negotiation request with its quotation
  const negotiation = await prisma.negotiationRequest.findUnique({
    where: { id: negotiationId },
    include: {
      quotation: {
        include: {
          lines: true,
        },
      },
    },
  });

  if (!negotiation) {
    throw new Error('Negotiation request not found');
  }

  // 2. If accepted AND adjustedDiscount provided
  if (input.accepted && input.adjustedDiscount !== undefined) {
    // a. Update the quotation line's discount_percent to adjustedDiscount
    if (negotiation.quotationLineId) {
      await prisma.quotationLine.update({
        where: { id: negotiation.quotationLineId },
        data: {
          discountPercent: input.adjustedDiscount,
        },
      });
    }

    // b. Increment quotation.current_version (material edit per §6.4)
    await prisma.quotation.update({
      where: { id: negotiation.quotationId },
      data: {
        currentVersion: { increment: 1 },
      },
    });

    // c. Call QuotationCalculatorService.recalculateQuotation(quotationId)
    await QuotationCalculatorService.recalculateQuotation(negotiation.quotationId);

    // d. CALL CONTRACT 1: DiscountRiskService.evaluateAndRoute(quotationId)
    const riskResult = await evaluateAndRoute(negotiation.quotationId);

    // e. If riskResult.requiresApproval → create approval request and set quotation.status = PENDING_APPROVAL
    //    If not → quotation returns to APPROVED (customer-visible, ready to confirm)
    if (riskResult.requiresApproval) {
      await createApprovalRequest(
        negotiation.quotationId,
        riskResult.riskLevel as 'MEDIUM' | 'HIGH',
        riskResult.riskScore,
      );
      await prisma.quotation.update({
        where: { id: negotiation.quotationId },
        data: {
          status: QuotationStatus.PENDING_APPROVAL,
        },
      });
    } else {
      await prisma.quotation.update({
        where: { id: negotiation.quotationId },
        data: {
          status: QuotationStatus.APPROVED,
        },
      });
    }
  }

  // 3. Mark negotiation: status = accepted ? 'ACCEPTED' : 'REJECTED', resolved_by = repId, resolved_at = now()
  const updatedNegotiation = await prisma.negotiationRequest.update({
    where: { id: negotiationId },
    data: {
      status: input.accepted ? NegotiationStatus.ACCEPTED : NegotiationStatus.REJECTED,
      resolvedByUserId: repId,
      resolvedAt: new Date(),
    },
  });

  // 4. Audit: NEGOTIATION_RESOLVED
  await prisma.auditLog.create({
    data: {
      actorUserId: repId,
      action: AuditAction.NEGOTIATION_RESOLVED,
      entityType: 'negotiation_request',
      entityId: negotiation.id,
      quotationId: negotiation.quotationId,
      reason: input.comment ?? null,
      metadata: {
        action: 'NEGOTIATION_RESOLVED',
        accepted: input.accepted,
        adjustedDiscount: input.adjustedDiscount,
        comment: input.comment,
      },
    },
  });

  // 5. Return updated negotiation + quotation
  const updatedQuotation = await prisma.quotation.findUnique({
    where: { id: negotiation.quotationId },
    include: {
      lines: {
        include: {
          product: true,
        },
      },
    },
  });

  return {
    negotiation: updatedNegotiation,
    quotation: updatedQuotation,
  };
}

