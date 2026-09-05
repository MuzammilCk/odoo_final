/**
 * Quotation Calculator Service — server-authoritative financial calculations
 *
 * Spec refs: §6.7 (line pricing formulas), §6.8 (price resolution),
 *            §6.24 (margin calculation), §6.2 rule 7 (server owns totals)
 *
 * Formulas (from the plan / §6.7):
 *   discount_amount = unit_price × quantity × (discount_percent / 100)
 *   net_line_value  = (unit_price × quantity) - discount_amount
 *   tax_amount      = net_line_value × (tax_rate / 100)       ← tax_rate from Product
 *   line_total      = net_line_value + tax_amount
 *   margin_amount   = net_line_value - (estimated_unit_cost × quantity)
 */

import { prisma } from '../../../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

export async function recalculateQuotation(quotationId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Load all lines with their product's tax_rate
    const lines = await tx.quotationLine.findMany({
      where: { quotationId },
      include: { product: { select: { taxRate: true } } },
    });

    let sumNetLineValue = ZERO;
    let sumDiscountAmount = ZERO;
    let sumTaxAmount = ZERO;
    let sumMarginAmount = ZERO;

    // 2. Calculate each line's amounts
    for (const line of lines) {
      const unitPrice = new Decimal(line.unitPrice);
      const qty = new Decimal(line.quantity);
      const discountPct = new Decimal(line.discountPercent);
      const estUnitCost = new Decimal(line.estimatedUnitCost);
      const taxRate = new Decimal(line.product.taxRate);

      const grossValue = unitPrice.mul(qty);
      const discountAmount = grossValue.mul(discountPct).div(HUNDRED);
      const netLineValue = grossValue.sub(discountAmount);
      const taxAmount = netLineValue.mul(taxRate).div(HUNDRED);
      const lineTotal = netLineValue.add(taxAmount);
      const marginAmount = netLineValue.sub(estUnitCost.mul(qty));
      const marginPercent = netLineValue.gt(0)
        ? marginAmount.div(netLineValue).mul(HUNDRED)
        : ZERO;

      // 3. Update line in DB with calculated values
      await tx.quotationLine.update({
        where: { id: line.id },
        data: {
          discountAmount,
          taxAmount,
          lineTotal,
          estimatedMarginAmount: marginAmount,
          estimatedMarginPercent: marginPercent,
        },
      });

      sumNetLineValue = sumNetLineValue.add(netLineValue);
      sumDiscountAmount = sumDiscountAmount.add(discountAmount);
      sumTaxAmount = sumTaxAmount.add(taxAmount);
      sumMarginAmount = sumMarginAmount.add(marginAmount);
    }

    // 4–5. Quotation-level totals
    const grandTotal = sumNetLineValue.add(sumTaxAmount);

    // margin_percent guard: if grand_total is 0 (empty quote or fully
    // discounted), dividing would produce NaN/Infinity. Default to 0.
    const marginPercent = grandTotal.gt(0)
      ? sumMarginAmount.div(grandTotal).mul(HUNDRED)
      : ZERO;

    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        subtotal: sumNetLineValue,
        discountTotal: sumDiscountAmount,
        taxTotal: sumTaxAmount,
        grandTotal,
        marginAmount: sumMarginAmount,
        marginPercent,
      },
    });
  });
}
