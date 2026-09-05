/**
 * CreditNoteService — create and issue credit notes
 *
 * Spec refs: §5.26 (credit_notes table), §6.35 (subscription proration)
 *
 * Credit notes are created by:
 *   1. Subscription cancellation mid-period (auto — from subscription.service.ts)
 *   2. Subscription modification downgrade (auto — from subscription.service.ts)
 *   3. Manual FINANCE_OPS action (via API endpoint)
 *
 * CreditNote.invoiceId is NOT NULL — an invoice must exist before a credit note
 * can be created. Status lifecycle: DRAFT → ISSUED (→ CANCELLED)
 */

import { prisma } from '../../lib/prisma.js';

export async function createCreditNote(data: {
  invoiceId: string;
  subscriptionInstanceId?: string;
  amount: number;
  currencyCode: string;
  reason: string;
  actorUserId: string;
}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId }, select: { id: true } });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });

  const creditNoteNumber = `CN-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const creditNote = await prisma.creditNote.create({
    data: {
      creditNoteNumber,
      invoiceId:             data.invoiceId,
      subscriptionInstanceId: data.subscriptionInstanceId,
      amount:                data.amount,
      currencyCode:          data.currencyCode,
      reason:                data.reason,
      status:                'DRAFT',
      createdBy:             data.actorUserId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: data.actorUserId,
      action:     'CREDIT_NOTE_CREATED',
      entityType: 'credit_notes',
      entityId:   creditNote.id,
      metadata:   { creditNoteNumber, amount: data.amount, reason: data.reason },
    },
  });

  return creditNote;
}

export async function listCreditNotes(filters?: { invoiceId?: string; subscriptionInstanceId?: string }) {
  return prisma.creditNote.findMany({
    where: {
      ...(filters?.invoiceId && { invoiceId: filters.invoiceId }),
      ...(filters?.subscriptionInstanceId && { subscriptionInstanceId: filters.subscriptionInstanceId }),
    },
    include: {
      invoice: { select: { invoiceNumber: true, quotationId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Issue a credit note: DRAFT → ISSUED, sets issuedAt. */
export async function issueCreditNote(creditNoteId: string, actorUserId: string) {
  const cn = await prisma.creditNote.findUnique({ where: { id: creditNoteId } });
  if (!cn) throw Object.assign(new Error('Credit note not found'), { status: 404 });
  if (cn.status !== 'DRAFT') throw Object.assign(new Error(`Cannot issue a ${cn.status} credit note`), { status: 422 });

  return prisma.creditNote.update({
    where: { id: creditNoteId },
    data:  { status: 'ISSUED', issuedAt: new Date() },
  });
}
