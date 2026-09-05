/**
 * Quotation Calculator Service
 *
 * Spec refs: §6.7–§6.8 (line pricing and tax), §6.24 (quotation totals)
 * Lane A module — imported and consumed by Lane B negotiation & confirmation workflows.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Recalculates line-level financials and rolls them up to quotation totals.
 */
export async function recalculateQuotation(quotationId: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      lines: {
        include: { product: true },
      },
    },
  });

  if (!quotation) {
    throw new Error(`Quotation ${quotationId} not found for recalculation`);
  }

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let marginAmount = 0;

  for (const line of quotation.lines) {
    const qty = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const discPct = Number(line.discountPercent);
    const taxRatePct = line.product ? Number(line.product.taxRate) : 0;
    const estCost = Number(line.estimatedUnitCost);

    const discAmt = unitPrice * qty * (discPct / 100);
    const net = unitPrice * qty - discAmt;
    const taxAmt = net * (taxRatePct / 100);
    const lineTotal = net + taxAmt;
    const lineMargin = net - estCost * qty;
    const marginPct = lineTotal > 0 ? (lineMargin / lineTotal) * 100 : 0;

    await prisma.quotationLine.update({
      where: { id: line.id },
      data: {
        discountAmount: discAmt,
        taxAmount: taxAmt,
        lineTotal,
        estimatedMarginAmount: lineMargin,
        estimatedMarginPercent: marginPct,
      },
    });

    subtotal += net;
    discountTotal += discAmt;
    taxTotal += taxAmt;
    marginAmount += lineMargin;
  }

  const grandTotal = subtotal + taxTotal;
  const marginPercent = grandTotal > 0 ? (marginAmount / grandTotal) * 100 : 0;

  return await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      marginAmount,
      marginPercent,
    },
  });
}

export const QuotationCalculatorService = {
  recalculateQuotation,
};
