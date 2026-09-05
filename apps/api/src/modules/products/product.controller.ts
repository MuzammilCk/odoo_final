/**
 * Product Controller — REST endpoints for Categories, Products, Variants, Price Lists
 *
 * Spec refs: §5.7, §5.8, §5.9, §5.12, §8.20 (RBAC)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import * as ProductService from './product.service.js';

export const productRouter = Router();

// ── Categories ─────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

productRouter.get('/categories', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await ProductService.listCategories();
    res.json({ categories });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.post('/categories', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const category = await ProductService.createCategory(parsed.data.name, parsed.data.description);
    res.status(201).json({ category });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.patch('/categories/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = categorySchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const category = await ProductService.updateCategory(req.params.id as string, parsed.data);
    res.json({ category });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── Products ───────────────────────────────────────────────────────────────────

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().uuid(),
  description: z.string().optional(),
  unit: z.string().min(1),
  basePrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative().optional(),
  isSubscription: z.boolean().optional(),
  recurringInterval: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
});

productRouter.get('/products', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, search, activeOnly } = req.query;
    const products = await ProductService.listProducts({
      categoryId: categoryId as string | undefined,
      search: search as string | undefined,
      activeOnly: activeOnly === 'false' ? false : true,
    });
    res.json({ products });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.get('/products/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await ProductService.getProduct(req.params.id as string);
    res.json({ product });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.post('/products', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const product = await ProductService.createProduct(parsed.data);
    res.status(201).json({ product });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.patch('/products/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createProductSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const product = await ProductService.updateProduct(req.params.id as string, parsed.data);
    res.json({ product });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.delete('/products/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await ProductService.softDeleteProduct(req.params.id as string);
    res.json({ message: 'Product deactivated', product });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── Product Variants ───────────────────────────────────────────────────────────

const variantSchema = z.object({
  attributeName: z.string().min(1),
  attributeValue: z.string().min(1),
  extraPrice: z.number().optional(),
});

productRouter.post('/products/:id/variants', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = variantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const variant = await ProductService.createVariant(req.params.id as string, parsed.data);
    res.status(201).json({ variant });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.patch('/products/:id/variants/:vid', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ extraPrice: z.number().optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const variant = await ProductService.updateVariant(req.params.vid as string, parsed.data);
    res.json({ variant });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.delete('/products/:id/variants/:vid', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const variant = await ProductService.deleteVariant(req.params.vid as string);
    res.json({ message: 'Variant deactivated', variant });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── Price Lists ────────────────────────────────────────────────────────────────

const priceListSchema = z.object({
  productId: z.string().uuid(),
  discountTierId: z.string().uuid(),
  currencyCode: z.string().length(3),
  price: z.number().positive(),
});

productRouter.get('/price-lists', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, discountTierId } = req.query;
    const entries = await ProductService.listPriceListEntries({
      productId: productId as string | undefined,
      discountTierId: discountTierId as string | undefined,
    });
    res.json({ entries });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.post('/price-lists', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = priceListSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const entry = await ProductService.createPriceListEntry(parsed.data);
    res.status(201).json({ entry });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.patch('/price-lists/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ price: z.number().positive() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const entry = await ProductService.updatePriceListEntry(req.params.id as string, parsed.data);
    res.json({ entry });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

productRouter.delete('/price-lists/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    await ProductService.deletePriceListEntry(req.params.id as string);
    res.json({ message: 'Price list entry removed' });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});
