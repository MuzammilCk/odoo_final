/**
 * Approval Service — Governance approval workflows & state machine
 *
 * Spec refs: §6.12–6.16 (approval routing rules, levels, ordering),
 *            §5.17–5.18 (ApprovalRequest & ApprovalStep schema),
 *            §6.4–6.5 (versioning and terms snapshot)
 */

import {
  QuotationStatus,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  ApprovalLevel,
  AuditAction,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/**
 * Creates an approval request and associated approval steps for a quotation.
 * Wrapped in a Prisma transaction for atomic execution.
 */
export async function createApprovalRequest(
  quotationId: string,
  riskLevel: 'MEDIUM' | 'HIGH',
  riskScore: number,
) {
  return prisma.$transaction(async (tx) => {
    // 1. Load the quotation (with lines) to get current_version and details
    const quotation = await tx.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: {
          include: { discountTier: true },
        },
        lines: {
          include: { product: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!quotation) {
      throw new Error('Quotation not found');
    }

    // 2. Create terms_snapshot: JSON captures exactly what the approver is reviewing
    const termsSnapshot = JSON.parse(
      JSON.stringify({
        quotationId: quotation.id,
        quoteNumber: quotation.quoteNumber,
        version: quotation.currentVersion,
        subtotal: quotation.subtotal,
        discountTotal: quotation.discountTotal,
        taxTotal: quotation.taxTotal,
        grandTotal: quotation.grandTotal,
        marginAmount: quotation.marginAmount,
        marginPercent: quotation.marginPercent,
        riskScore,
        riskLevel,
        customer: quotation.customer,
        lines: quotation.lines,
      }),
    );

    // Resolve approver users
    const managerUser = await tx.user.findFirst({
      where: { role: UserRole.MANAGER },
    });
    const financeUser = await tx.user.findFirst({
      where: { role: UserRole.FINANCE_OPS },
    });

    const managerApproverId = managerUser?.id ?? quotation.salesRepId;
    const financeApproverId = financeUser?.id ?? managerApproverId;

    // 4. Create ApprovalStep(s):
    //    If MEDIUM: 1 step → { sequenceNo: 1, approvalLevel: 'MANAGER', status: 'PENDING' }
    //    If HIGH: 2 steps  → { sequenceNo: 1, approvalLevel: 'MANAGER' }, { sequenceNo: 2, approvalLevel: 'FINANCE' }
    const stepsData: Array<{
      sequenceNo: number;
      approvalLevel: ApprovalLevel;
      approverUserId: string;
      status: ApprovalStepStatus;
    }> = [
      {
        sequenceNo: 1,
        approvalLevel: ApprovalLevel.MANAGER,
        approverUserId: managerApproverId,
        status: ApprovalStepStatus.PENDING,
      },
    ];


    if (riskLevel === 'HIGH') {
      stepsData.push({
        sequenceNo: 2,
        approvalLevel: ApprovalLevel.FINANCE,
        approverUserId: financeApproverId,
        status: ApprovalStepStatus.PENDING,
      });
    }

    // Clean up any existing request for the same version (e.g. re-submission after return)
    const existing = await tx.approvalRequest.findUnique({
      where: {
        quotationId_quotationVersion: {
          quotationId,
          quotationVersion: quotation.currentVersion,
        },
      },
    });

    if (existing) {
      await tx.approvalStep.deleteMany({
        where: { approvalRequestId: existing.id },
      });
      await tx.approvalRequest.delete({
        where: { id: existing.id },
      });
    }

    // 3. Create ApprovalRequest via Prisma with steps
    const approvalRequest = await tx.approvalRequest.create({
      data: {
        quotationId: quotation.id,
        quotationVersion: quotation.currentVersion,
        status: ApprovalRequestStatus.PENDING,
        riskScore,
        riskLevel,
        requiredApprovalCount: stepsData.length,
        termsSnapshot,
        submittedAt: new Date(),
        createdBy: quotation.salesRepId,
        steps: {
          create: stepsData,
        },
      },
      include: {
        steps: {
          orderBy: { sequenceNo: 'asc' },
        },
      },
    });

    // 5. Update quotation.status = PENDING_APPROVAL
    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        status: QuotationStatus.PENDING_APPROVAL,
      },
    });

    // 6. Audit: QUOTATION_SUBMITTED
    await tx.auditLog.create({
      data: {
        actorUserId: quotation.salesRepId,
        action: AuditAction.QUOTATION_SUBMITTED,
        entityType: 'quotation',
        entityId: quotation.id,
        quotationId: quotation.id,
        metadata: {
          quotationVersion: quotation.currentVersion,
          approvalRequestId: approvalRequest.id,
          riskLevel,
          riskScore,
        },
      },
    });

    // 7. Return the approval request with steps
    return approvalRequest;
  });
}

/**
 * Decision on an approval step per §6.16–6.18.
 * For now, implements 'APPROVE' branch (REJECT and RETURN to follow).
 */
export async function decideStep(
  stepId: string,
  approverId: string,
  decision: 'APPROVE' | 'REJECT' | 'RETURN',
  comment: string,
) {
  return prisma.$transaction(async (tx) => {
    // 1. Load the approval step with its approval_request and the related quotation
    const step = await tx.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        approvalRequest: {
          include: {
            quotation: true,
            steps: {
              orderBy: { sequenceNo: 'asc' },
            },
          },
        },
      },
    });

    if (!step) {
      throw new Error('Approval step not found');
    }

    // 2. Validate:
    // - step.status must be PENDING
    if (step.status !== ApprovalStepStatus.PENDING) {
      throw new Error(`Approval step is not in PENDING status (current: ${step.status})`);
    }

    // - approver's role must match step.approver_role
    const approver = await tx.user.findUnique({
      where: { id: approverId },
    });
    if (!approver) {
      throw new Error('Approver user not found');
    }

    const expectedRole =
      step.approvalLevel === ApprovalLevel.MANAGER ? UserRole.MANAGER : UserRole.FINANCE_OPS;
    if (approver.role !== expectedRole && approver.role !== UserRole.ADMIN) {
      throw new Error(
        `Approver role '${approver.role}' does not match required step role '${expectedRole}'`,
      );
    }

    // - approval_request.quotation_version must equal quotation.current_version (stale approval check!)
    if (step.approvalRequest.quotationVersion !== step.approvalRequest.quotation.currentVersion) {
      throw new Error(
        `Stale approval: request was created for quotation version ${step.approvalRequest.quotationVersion}, but quotation is now version ${step.approvalRequest.quotation.currentVersion}`,
      );
    }

    // - If step_sequence > 1, previous steps must be APPROVED
    if (step.sequenceNo > 1) {
      const priorIncomplete = step.approvalRequest.steps.find(
        (s) => s.sequenceNo < step.sequenceNo && s.status !== ApprovalStepStatus.APPROVED,
      );
      if (priorIncomplete) {
        throw new Error(
          `Previous approval step (sequence ${priorIncomplete.sequenceNo}) must be APPROVED before this step can be decided`,
        );
      }
    }

    if (decision === 'APPROVE') {
      // 3. Update step: status = APPROVED, approver_id = approverId, acted_at = now(), comment
      await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          status: ApprovalStepStatus.APPROVED,
          approverUserId: approverId,
          actedAt: new Date(),
          decisionReason: comment,
        },
      });

      // 4. Check: are there more steps after this one?
      const remainingSteps = step.approvalRequest.steps.filter(
        (s) => s.sequenceNo > step.sequenceNo && s.status !== ApprovalStepStatus.APPROVED,
      );

      if (remainingSteps.length === 0) {
        // If no more steps: mark approval_request.status = APPROVED, quotation.status = APPROVED
        await tx.approvalRequest.update({
          where: { id: step.approvalRequestId },
          data: {
            status: ApprovalRequestStatus.APPROVED,
            completedAt: new Date(),
          },
        });

        await tx.quotation.update({
          where: { id: step.approvalRequest.quotationId },
          data: {
            status: QuotationStatus.APPROVED,
            customerVisibleAt: new Date(),
          },
        });
      }

      // 5. Audit: APPROVAL_APPROVED
      await tx.auditLog.create({
        data: {
          actorUserId: approverId,
          action: AuditAction.APPROVAL_APPROVED,
          entityType: 'approval_step',
          entityId: step.id,
          quotationId: step.approvalRequest.quotationId,
          reason: comment,
          metadata: {
            stepSequence: step.sequenceNo,
            approvalLevel: step.approvalLevel,
            quotationVersion: step.approvalRequest.quotationVersion,
            allStepsCompleted: remainingSteps.length === 0,
          },
        },
      });
    } else if (decision === 'REJECT') {
      // 1. Mark step.status = REJECTED, acted_at, comment
      await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          status: ApprovalStepStatus.REJECTED,
          approverUserId: approverId,
          actedAt: new Date(),
          decisionReason: comment,
        },
      });

      // 2. Mark approval_request.status = REJECTED
      await tx.approvalRequest.update({
        where: { id: step.approvalRequestId },
        data: {
          status: ApprovalRequestStatus.REJECTED,
          completedAt: new Date(),
        },
      });

      // 3. Mark quotation.status = REJECTED
      await tx.quotation.update({
        where: { id: step.approvalRequest.quotationId },
        data: {
          status: QuotationStatus.REJECTED,
        },
      });

      // 4. Audit: APPROVAL_REJECTED
      await tx.auditLog.create({
        data: {
          actorUserId: approverId,
          action: AuditAction.APPROVAL_REJECTED,
          entityType: 'approval_step',
          entityId: step.id,
          quotationId: step.approvalRequest.quotationId,
          reason: comment,
          metadata: {
            stepSequence: step.sequenceNo,
            approvalLevel: step.approvalLevel,
            quotationVersion: step.approvalRequest.quotationVersion,
          },
        },
      });
    } else if (decision === 'RETURN') {
      // 1. Mark step.status = RETURNED, acted_at, comment
      await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          status: ApprovalStepStatus.RETURNED,
          approverUserId: approverId,
          actedAt: new Date(),
          decisionReason: comment,
        },
      });

      // 2. Mark approval_request.status = RETURNED
      await tx.approvalRequest.update({
        where: { id: step.approvalRequestId },
        data: {
          status: ApprovalRequestStatus.RETURNED,
          completedAt: new Date(),
        },
      });

      // 3. Mark quotation.status = DRAFT (goes back to rep for editing)
      await tx.quotation.update({
        where: { id: step.approvalRequest.quotationId },
        data: {
          status: QuotationStatus.DRAFT,
        },
      });

      // 4. Audit: APPROVAL_RETURNED
      await tx.auditLog.create({
        data: {
          actorUserId: approverId,
          action: AuditAction.APPROVAL_RETURNED,
          entityType: 'approval_step',
          entityId: step.id,
          quotationId: step.approvalRequest.quotationId,
          reason: comment,
          metadata: {
            stepSequence: step.sequenceNo,
            approvalLevel: step.approvalLevel,
            quotationVersion: step.approvalRequest.quotationVersion,
          },
        },
      });
    }


    // Return updated step with hierarchy
    return tx.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        approvalRequest: {
          include: {
            quotation: true,
            steps: { orderBy: { sequenceNo: 'asc' } },
          },
        },
      },
    });
  });
}

/**
 * A4.9 — Approval validity guard (§6.18):
 * Compares latest approval request's version against current quotation version.
 * Returns false if stale (material edit occurred after approval request was created).
 */
export async function isApprovalValid(quotationId: string): Promise<boolean> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: { currentVersion: true },
  });

  if (!quotation) return false;

  const latestApproval = await prisma.approvalRequest.findFirst({
    where: { quotationId },
    orderBy: { createdAt: 'desc' },
    select: { quotationVersion: true, status: true },
  });

  if (!latestApproval) return false;

  return latestApproval.quotationVersion === quotation.currentVersion;
}


