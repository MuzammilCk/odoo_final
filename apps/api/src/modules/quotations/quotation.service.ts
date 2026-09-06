import { QuotationStatus, AuditAction, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma.js';
import { recalculateQuotation } from './services/quotation-calculator.service.js';
import { resolvePrice } from '../products/services/price-list.service.js';

export async function createQuotation(salesRepId: string, customerId: string, currencyCode: string) {
  const rep = await prisma.user.findUnique({ where: { id: salesRepId } });
  if (!rep || rep.role !== UserRole.SALES_REP) {
    throw new Error('Only sales representatives can create quotations');
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.isActive) {
    throw new Error('Customer not found or inactive');
  }

  const quoteNumber = `Q-${Date.now()}`;

  const quotation = await prisma.quotation.create({
    data: {
      quoteNumber,
      customerId,
      salesRepId,
      status: QuotationStatus.DRAFT,
      currencyCode: currencyCode.toUpperCase(),
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      marginAmount: 0,
      marginPercent: 0,
      currentVersion: 1,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: salesRepId,
      action: AuditAction.QUOTATION_CREATED,
      entityType: 'quotation',
      entityId: quotation.id,
      quotationId: quotation.id,
    },
  });

  return quotation;
}

// ── Add a line to a quotation ──────────────────────────────────────────────────

interface AddLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
  discountPercent: number;
}

export async function addLine(quotationId: string, input: AddLineInput) {
  // 1. Verify quotation exists and is editable
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { customer: true },
  });
  if (!quotation) throw new Error('Quotation not found');
  if (quotation.status !== QuotationStatus.DRAFT) {
    throw new Error('Quotation is not editable — status must be DRAFT');
  }

  // 2. Verify product exists and is active
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.isActive) throw new Error('Product not found or inactive');

  // 3. Resolve price — Contract 2: PriceListService.resolvePrice
  let unitPrice: Decimal;
  if (quotation.customer?.discountTierId) {
    const resolved = await resolvePrice(
      input.productId,
      quotation.customer.discountTierId,
      quotation.currencyCode,
    );
    unitPrice = new Decimal(resolved.unitPrice);
  } else {
    unitPrice = new Decimal(product.basePrice);
  }

  if (input.variantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: input.variantId } });
    if (!variant || !variant.isActive) throw new Error('Variant not found or inactive');
    if (variant.productId !== input.productId) throw new Error('Variant does not belong to product');
    unitPrice = unitPrice.add(new Decimal(variant.extraPrice));
  }

  // 4. Get tax_rate from product; estimated cost = 60% of unit price
  const estimatedUnitCost = unitPrice.mul(new Decimal(0.6));

  // 5. Create quotation line — initial financial values; recalculate will overwrite them
  await prisma.quotationLine.create({
    data: {
      quotationId,
      productId: input.productId,
      productVariantId: input.variantId ?? null,
      descriptionSnapshot: product.name + (product.description ? ` — ${product.description}` : ''),
      skuSnapshot: product.sku,
      quantity: input.quantity,
      unitPrice,
      discountPercent: input.discountPercent,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: 0, // recalculate will compute
      estimatedUnitCost,
      estimatedMarginAmount: 0,
      estimatedMarginPercent: 0,
      allowedDiscountPercent: 0, // will be set by discount-risk engine (Step A3)
      discountOveragePercent: 0,
    },
  });

  // 6. Recalculate all totals atomically
  await recalculateQuotation(quotationId);

  // 7. Return updated quotation with all lines
  return prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: {
      customer: { select: { id: true, name: true } },
      lines: {
        include: { product: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

// ── Update a quotation line ──────────────────────────────────────────────────

interface UpdateLineInput {
  quantity?: number;
  discountPercent?: number;
  unitPrice?: number;
}

export async function updateLine(quotationId: string, lineId: string, input: UpdateLineInput) {
  // 1. Verify quotation exists and is editable (DRAFT status)
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) throw new Error('Quotation not found');
  if (quotation.status !== QuotationStatus.DRAFT) {
    throw new Error('Quotation is not editable — status must be DRAFT');
  }

  // 2. Verify line exists and belongs to this quotation
  const line = await prisma.quotationLine.findUnique({ where: { id: lineId } });
  if (!line || line.quotationId !== quotationId) {
    throw new Error('Quotation line not found');
  }

  // 3. Update the line fields
  const data: { quantity?: Decimal; discountPercent?: Decimal; unitPrice?: Decimal } = {};
  if (input.quantity !== undefined) {
    data.quantity = new Decimal(input.quantity);
  }
  if (input.discountPercent !== undefined) {
    data.discountPercent = new Decimal(input.discountPercent);
  }
  if (input.unitPrice !== undefined) {
    data.unitPrice = new Decimal(input.unitPrice);
  }

  // Determine if a material field changed per §6.4 (quantity, discount_percent, or unit_price)
  const isMaterialChange =
    (input.quantity !== undefined && !new Decimal(line.quantity).equals(data.quantity!)) ||
    (input.discountPercent !== undefined && !new Decimal(line.discountPercent).equals(data.discountPercent!)) ||
    (input.unitPrice !== undefined && !new Decimal(line.unitPrice).equals(data.unitPrice!));

  await prisma.quotationLine.update({
    where: { id: lineId },
    data,
  });

  // 4. Material edit version increment per §6.4 / §6.5:
  // When a material field changes, increment current_version and update updated_at
  if (isMaterialChange) {
    await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        currentVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  // 5. Recalculate quotation totals
  await recalculateQuotation(quotationId);

  // 6. Return updated quotation with lines
  return prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: {
      customer: { select: { id: true, name: true } },
      lines: {
        include: { product: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

// ── Delete a quotation line ──────────────────────────────────────────────────

export async function deleteLine(quotationId: string, lineId: string) {
  // 1. Verify quotation exists and is editable (DRAFT status)
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) throw new Error('Quotation not found');
  if (quotation.status !== QuotationStatus.DRAFT) {
    throw new Error('Quotation is not editable — status must be DRAFT');
  }

  // 2. Verify line exists and belongs to this quotation
  const line = await prisma.quotationLine.findUnique({ where: { id: lineId } });
  if (!line || line.quotationId !== quotationId) {
    throw new Error('Quotation line not found');
  }

  // 3. Delete the line
  await prisma.quotationLine.delete({
    where: { id: lineId },
  });

  // 4. Recalculate quotation totals
  await recalculateQuotation(quotationId);

  // 5. Return updated quotation
  return prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: {
      customer: { select: { id: true, name: true } },
      lines: {
        include: { product: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

