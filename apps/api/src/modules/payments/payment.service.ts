/**
 * Payment Service — record payments, auto-update invoice status
 *
 * Spec refs: §6.39 (payment balance mechanics), §5.25 (payments table)
 *
 * Invoice has no stored amountPaid/balanceDue columns — we compute
 * balance by summing all RECORDED payments in the service layer.
 *
 * Status auto-update rules:
 *   totalPaid >= invoice.totalAmount → PAID
 *   totalPaid > 0                   → PARTIALLY_PAID
 *   totalPaid = 0                   → UNPAID
 */

import { prisma } from '../../lib/prisma.js';

async function computeInvoiceBalance(invoiceId: string): Promise<{ totalPaid: number; balance: number; totalAmount: number }> {
  const [invoice, payments] = await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoiceId }, select: { totalAmount: true } }),
    prisma.payment.findMany({
      where: { invoiceId, status: 'RECORDED' },
      select: { amount: true },
    }),
  ]);
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  const totalAmount = Number(invoice.totalAmount);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  return { totalAmount, totalPaid, balance: totalAmount - totalPaid };
}

/**
 * Record a payment against an invoice.
 * Validates amount > 0 and amount <= remaining balance.
 * Auto-updates invoice status.
 */
export async function recordPayment(
  invoiceId: string,
  amount: number,
  currencyCode: string,
  paymentReference: string,
  actorUserId: string,
) {
  if (amount <= 0) throw Object.assign(new Error('Payment amount must be positive'), { status: 422 });

  const { balance, totalAmount, totalPaid } = await computeInvoiceBalance(invoiceId);

  if (amount > balance + 0.001) {  // 0.001 tolerance for floating point
    throw Object.assign(
      new Error(`Payment amount $${amount} exceeds balance due $${balance.toFixed(2)}`),
      { status: 422 },
    );
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true, quotationId: true } });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (invoice.status === 'VOID') throw Object.assign(new Error('Cannot pay a voided invoice'), { status: 422 });

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      currencyCode,
      status:           'RECORDED',
      paymentReference,
      paidAt:           new Date(),
      createdBy:        actorUserId,
    },
  });

  // Recompute and update invoice status
  const newTotalPaid = totalPaid + amount;
  const newStatus = newTotalPaid >= totalAmount - 0.001 ? 'PAID' : 'PARTIALLY_PAID';

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action:     'PAYMENT_RECORDED',
      entityType: 'payments',
      entityId:   payment.id,
      quotationId: invoice.quotationId,
      metadata:   { amount, currencyCode, paymentReference, newStatus },
    },
  });

  return { payment, newStatus, balance: Math.max(0, totalAmount - newTotalPaid) };
}

/** Reverse a previously recorded payment and revert invoice status. */
export async function reversePayment(paymentId: string, actorUserId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { select: { id: true, quotationId: true, totalAmount: true } } },
  });
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });
  if (payment.status === 'REVERSED') throw Object.assign(new Error('Payment already reversed'), { status: 422 });

  await prisma.payment.update({ where: { id: paymentId }, data: { status: 'REVERSED' } });

  const { balance } = await computeInvoiceBalance(payment.invoiceId);
  const totalAmount = Number(payment.invoice.totalAmount);
  const newStatus = balance >= totalAmount - 0.001 ? 'UNPAID' : 'PARTIALLY_PAID';

  await prisma.invoice.update({ where: { id: payment.invoiceId }, data: { status: newStatus } });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action:     'PAYMENT_REVERSED',
      entityType: 'payments',
      entityId:   paymentId,
      quotationId: payment.invoice.quotationId,
      metadata:   { reversedAmount: Number(payment.amount), newStatus },
    },
  });

  return { newStatus };
}
