/**
 * Portal Service — Confirmation workflows & customer validation
 *
 * Spec refs: §6.20 (Customer confirmation rule), §6.18 (Approval validity & stale checks),
 *            §5.15 (Quotation), §5.17 (ApprovalRequest), §5.28 (AuditLog)
 */

import { prisma } from '../../lib/prisma.js';
import {
  QuotationStatus,
  ApprovalRequestStatus,
  AuditAction,
} from '@prisma/client';
import { createFromConfirmedQuotation } from '../subscriptions/subscription.service.js';

export interface ConfirmationValidationResult {
  valid: boolean;
  reason?: string;
  quotation?: any;
}

/**
 * Validates all 5 preconditions required for customer quotation confirmation (§6.20):
 * 1. Customer is authorized for this quotation
 * 2. Quotation is in a customer-visible and confirmable status (APPROVED or UNDER_NEGOTIATION)
 * 3. Quotation is not already confirmed
 * 4. All required internal approvals are completed (if approvals were triggered)
 * 5. Approvals are not stale: latest approval request version must match current quotation version
 */
export async function validateConfirmation(
  quotationId: string,
  customerId: string
): Promise<ConfirmationValidationResult> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      customer: true,
      approvalRequests: {
        orderBy: { quotationVersion: 'desc' },
        take: 1,
      },
    },
  });

  if (!quotation) {
    return { valid: false, reason: 'Quotation not found' };
  }

  // Precondition 1: Ownership
  if (quotation.customerId !== customerId) {
    return { valid: false, reason: 'Quotation does not belong to this customer organization' };
  }

  // Precondition 3: Not already confirmed
  if (quotation.status === QuotationStatus.CONFIRMED) {
    return { valid: false, reason: 'Quotation has already been confirmed' };
  }

  // Precondition 2: Quotation must be customer-visible (not DRAFT, not REJECTED, not PENDING_APPROVAL)
  if (
    quotation.status === QuotationStatus.DRAFT ||
    quotation.status === QuotationStatus.REJECTED ||
    quotation.status === QuotationStatus.PENDING_APPROVAL
  ) {
    return {
      valid: false,
      reason: `Quotation is in ${quotation.status} status and cannot be confirmed`,
    };
  }

  // Preconditions 4 & 5: Approval checks
  const latestApproval = quotation.approvalRequests[0];
  if (latestApproval) {
    // Check if required approval was granted
    if (latestApproval.status !== ApprovalRequestStatus.APPROVED) {
      return {
        valid: false,
        reason: `Pending or non-approved approval request (${latestApproval.status}) blocks confirmation`,
      };
    }

    // Stale check: Version of approval must strictly match quotation version (§6.18)
    if (latestApproval.quotationVersion !== quotation.currentVersion) {
      return {
        valid: false,
        reason: `Approval is stale (approved version ${latestApproval.quotationVersion}, current version is ${quotation.currentVersion}). Re-approval required.`,
      };
    }
  }

  return { valid: true, quotation };
}

/**
 * Confirms a quotation upon customer agreement.
 */
export async function confirmQuotation(
  quotationId: string,
  customerId: string,
  userId?: string
) {
  const validation = await validateConfirmation(quotationId, customerId);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Quotation cannot be confirmed');
  }

  const effectiveUserId =
    userId ??
    (
      await prisma.user.findFirst({
        where: { customerId },
        select: { id: true },
      })
    )?.id;

  const updatedQuotation = await prisma.$transaction(async (tx) => {
    // 1. Update quotation status to CONFIRMED
    const updated = await tx.quotation.update({
      where: { id: quotationId },
      data: {
        status: QuotationStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    // 2. Append AuditLog entry
    if (effectiveUserId) {
      await tx.auditLog.create({
        data: {
          actorUserId: effectiveUserId,
          action: AuditAction.QUOTATION_CONFIRMED,
          entityType: 'quotation',
          entityId: quotationId,
          quotationId,
          metadata: {
            action: 'QUOTATION_CONFIRMED',
            version: updated.currentVersion,
            grandTotal: Number(updated.grandTotal),
          },
        },
      });
    }

    return updated;
  });

  // 3. Contract 3 touchpoint:
  // Convert any recurring lines into active SubscriptionInstances
  if (effectiveUserId) {
    try {
      await createFromConfirmedQuotation(quotationId, effectiveUserId);
    } catch (err) {
      console.warn('[confirmQuotation] Contract 3 note:', err);
    }
  }

  return updatedQuotation;
}
