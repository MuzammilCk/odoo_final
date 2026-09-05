/**
 * ProductService — Category, Product, Variant, and PriceList CRUD
 *
 * Spec refs: §5.7 (categories), §5.8 (products), §5.9 (variants), §5.12 (price list entries)
 *
 * All mutations are ADMIN-only (enforced in controller via requireRole).
 * Reads are available to all internal roles.
 */

import { prisma } from '../../lib/prisma.js';

// ── Categories ─────────────────────────────────────────────────────────────────

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategory(name: string, description?: string) {
  return prisma.category.create({ data: { name, description } });
}

export async function updateCategory(id: string, data: { name?: string; description?: string; isActive?: boolean }) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw Object.assign(new Error('Category not found'), { status: 404 });
  return prisma.category.update({ where: { id }, data });
}

// ── Products ───────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  sku: string;
  name: string;
  categoryId: string;
  description?: string;
  unit: string;
  basePrice: number;
  taxRate?: number;
  isSubscription?: boolean;
  recurringInterval?: string;
}

export async function listProducts(filters?: { categoryId?: string; search?: string; activeOnly?: boolean }) {
  return prisma.product.findMany({
    where: {
      ...(filters?.categoryId && { categoryId: filters.categoryId }),
      ...(filters?.search && { name: { contains: filters.search, mode: 'insensitive' } }),
      ...(filters?.activeOnly !== false && { isActive: true }),
    },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { variants: true, priceListEntries: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: { where: { isActive: true } },
      priceListEntries: { include: { discountTier: { select: { id: true, name: true } } } },
    },
  });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  return product;
}

export async function createProduct(data: CreateProductInput) {
  return prisma.product.create({ data });
}

export async function updateProduct(id: string, data: Partial<CreateProductInput> & { isActive?: boolean }) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  return prisma.product.update({ where: { id }, data });
}

/** Soft delete — sets isActive = false (preserves FK integrity on quotation_lines). */
export async function softDeleteProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

// ── Variants ───────────────────────────────────────────────────────────────────

export async function createVariant(
  productId: string,
  data: { attributeName: string; attributeValue: string; extraPrice?: number },
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  return prisma.productVariant.create({ data: { productId, ...data } });
}

export async function updateVariant(variantId: string, data: { extraPrice?: number; isActive?: boolean }) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw Object.assign(new Error('Variant not found'), { status: 404 });
  return prisma.productVariant.update({ where: { id: variantId }, data });
}

export async function deleteVariant(variantId: string) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw Object.assign(new Error('Variant not found'), { status: 404 });
  return prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
}

// ── Price List Entries ─────────────────────────────────────────────────────────

export async function listPriceListEntries(filters?: { productId?: string; discountTierId?: string }) {
  return prisma.priceListEntry.findMany({
    where: {
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.discountTierId && { discountTierId: filters.discountTierId }),
    },
    include: {
      product:      { select: { id: true, name: true, sku: true } },
      discountTier: { select: { id: true, name: true } },
    },
    orderBy: { product: { name: 'asc' } },
  });
}

export async function createPriceListEntry(data: {
  productId: string;
  discountTierId: string;
  currencyCode: string;
  price: number;
}) {
  return prisma.priceListEntry.create({ data });
}

export async function updatePriceListEntry(id: string, data: { price?: number }) {
  const entry = await prisma.priceListEntry.findUnique({ where: { id } });
  if (!entry) throw Object.assign(new Error('Price list entry not found'), { status: 404 });
  return prisma.priceListEntry.update({ where: { id }, data });
}

export async function deletePriceListEntry(id: string) {
  const entry = await prisma.priceListEntry.findUnique({ where: { id } });
  if (!entry) throw Object.assign(new Error('Price list entry not found'), { status: 404 });
  return prisma.priceListEntry.delete({ where: { id } });
}
