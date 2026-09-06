/**
 * Governance & Discount Configuration Controller
 *
 * Spec refs: §5.10 (discount tiers), §5.11 (category ceilings),
 *            §6.9–6.16 (risk thresholds & governance rules), §7.4
 *
 * Routes registered under:
 * - /api/v1/internal/discount-tiers
 * - /api/v1/internal/discount-rules
 * - /api/v1/internal/approval-config
 * - /api/v1/internal/categories
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { UserRole, AuditAction } from '@prisma/client';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import { prisma } from '../../lib/prisma.js';

export const configRouter = Router();

configRouter.use(authenticateToken);

// ── In-memory Approval Risk Configuration (§6.14) ───────────────────────────

export interface ApprovalRiskConfig {
  lowMaxScore: number;
  mediumMaxScore: number;
  mediumApproverRoles: string[];
  highApproverRoles: string[];
}

let currentApprovalConfig: ApprovalRiskConfig = {
  lowMaxScore: 0,
  mediumMaxScore: 5,
  mediumApproverRoles: ['MANAGER'],
  highApproverRoles: ['MANAGER', 'FINANCE_OPS'],
};

// ── Schemas ──────────────────────────────────────────────────────────────────

const createTierSchema = z.object({
  name: z.string().min(1).max(80),
  defaultDiscountCeiling: z.number().min(0).max(100),
});

const updateTierSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  defaultDiscountCeiling: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

const createCeilingSchema = z.object({
  categoryId: z.string().uuid(),
  maxDiscount: z.number().min(0).max(100),
});

const updateCeilingSchema = z.object({
  maxDiscount: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

const updateApprovalConfigSchema = z.object({
  lowMaxScore: z.number().min(0).optional(),
  mediumMaxScore: z.number().min(1).optional(),
  mediumApproverRoles: z.array(z.string()).optional(),
  highApproverRoles: z.array(z.string()).optional(),
});

const updateCustomerTierSchema = z.object({
  discountTierId: z.string().uuid('discountTierId must be a valid UUID'),
});

const createCustomerSchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  discountTierId: z.string().uuid().optional(),
  contactEmail: z.string().email('Valid contact email is required'),
  contactFirstName: z.string().optional(),
  contactLastName: z.string().optional(),
  password: z.string().min(6).optional(),
});

// ── Discount Tiers Endpoints ────────────────────────────────────────────────

// GET /discount-tiers — List discount tiers
configRouter.get(
  '/discount-tiers',
  requireRole('ADMIN', 'MANAGER', 'FINANCE_OPS', 'SALES_REP'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const tiers = await prisma.discountTier.findMany({
        include: {
          _count: {
            select: { customers: true },
          },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ tiers });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// POST /discount-tiers — Create discount tier
configRouter.post(
  '/discount-tiers',
  requireRole('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createTierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const tier = await prisma.discountTier.create({
        data: {
          name: parsed.data.name,
          defaultDiscountCeiling: parsed.data.defaultDiscountCeiling,
        },
      });
      res.status(201).json({ tier });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(400).json({ error: e.message });
    }
  },
);

// PATCH /discount-tiers/:id — Update discount tier
configRouter.patch(
  '/discount-tiers/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = updateTierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const tier = await prisma.discountTier.update({
        where: { id: req.params.id as string },
        data: parsed.data,
      });
      res.json({ tier });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(400).json({ error: e.message });
    }
  },
);

// ── Category Discount Ceilings (Discount Rules) Endpoints ───────────────────

// GET /discount-rules — List category discount ceilings
configRouter.get(
  '/discount-rules',
  requireRole('ADMIN', 'MANAGER', 'FINANCE_OPS', 'SALES_REP'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const ceilings = await prisma.categoryDiscountCeiling.findMany({
        include: {
          category: { select: { id: true, name: true, description: true } },
        },
        orderBy: { category: { name: 'asc' } },
      });
      res.json({ rules: ceilings });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// POST /discount-rules — Create/upsert category discount ceiling
configRouter.post(
  '/discount-rules',
  requireRole('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createCeilingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const ceiling = await prisma.categoryDiscountCeiling.upsert({
        where: { categoryId: parsed.data.categoryId },
        create: {
          categoryId: parsed.data.categoryId,
          maxDiscount: parsed.data.maxDiscount,
        },
        update: {
          maxDiscount: parsed.data.maxDiscount,
          isActive: true,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });
      res.status(201).json({ rule: ceiling });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(400).json({ error: e.message });
    }
  },
);

// PATCH /discount-rules/:id — Update category discount ceiling
configRouter.patch(
  '/discount-rules/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = updateCeilingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const ceiling = await prisma.categoryDiscountCeiling.update({
        where: { id: req.params.id as string },
        data: parsed.data,
        include: {
          category: { select: { id: true, name: true } },
        },
      });
      res.json({ rule: ceiling });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(400).json({ error: e.message });
    }
  },
);

// ── Categories Helper Endpoint ──────────────────────────────────────────────

configRouter.get(
  '/categories',
  requireRole('ADMIN', 'MANAGER', 'FINANCE_OPS', 'SALES_REP'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        include: { categoryDiscountCeiling: true },
        orderBy: { name: 'asc' },
      });
      res.json({ categories });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// ── Approval Risk Config Endpoints (§6.14) ──────────────────────────────────

configRouter.get(
  '/approval-config',
  requireRole('ADMIN', 'MANAGER', 'FINANCE_OPS'),
  async (_req: Request, res: Response): Promise<void> => {
    res.json({ config: currentApprovalConfig });
  },
);

configRouter.put(
  '/approval-config',
  requireRole('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = updateApprovalConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    currentApprovalConfig = {
      ...currentApprovalConfig,
      ...parsed.data,
    };

    res.json({ config: currentApprovalConfig, message: 'Approval configuration updated' });
  },
);

// ── Customer Tier Management & Registration ──────────────────────────────────

// GET /customers — List all customers with current discount tier
configRouter.get(
  '/customers',
  requireRole('ADMIN', 'SALES_REP', 'MANAGER', 'FINANCE_OPS'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const customers = await prisma.customer.findMany({
        include: {
          discountTier: {
            select: { id: true, name: true, defaultDiscountCeiling: true },
          },
          users: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
          },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ customers });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// POST /customers — Register a new customer organization & portal login account
// Allowed roles: ADMIN, SALES_REP, MANAGER
configRouter.post(
  '/customers',
  requireRole('ADMIN', 'SALES_REP', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { name, discountTierId, contactEmail, contactFirstName, contactLastName, password } = parsed.data;

    try {
      // 1. Check duplicate company name
      const existingCustomer = await prisma.customer.findFirst({
        where: { name: { equals: name.trim(), mode: 'insensitive' } },
      });
      if (existingCustomer) {
        res.status(409).json({ error: `A customer organization named "${name.trim()}" already exists` });
        return;
      }

      // 2. Check duplicate user email
      const existingUser = await prisma.user.findUnique({
        where: { email: contactEmail.trim().toLowerCase() },
      });
      if (existingUser) {
        res.status(409).json({ error: `A user account with email "${contactEmail.trim().toLowerCase()}" already exists` });
        return;
      }

      // 3. Resolve discount tier
      let finalTierId = discountTierId;
      if (!finalTierId) {
        const defaultTier =
          (await prisma.discountTier.findFirst({ where: { name: 'Bronze' } })) ??
          (await prisma.discountTier.findFirst({ orderBy: { defaultDiscountCeiling: 'asc' } }));
        if (!defaultTier) {
          res.status(500).json({ error: 'No active discount tier available to assign to customer' });
          return;
        }
        finalTierId = defaultTier.id;
      }

      // 4. Create customer organization & portal user account
      const customer = await prisma.customer.create({
        data: {
          name: name.trim(),
          discountTierId: finalTierId,
          isActive: true,
        },
        include: {
          discountTier: {
            select: { id: true, name: true, defaultDiscountCeiling: true },
          },
        },
      });

      const passwordHash = await bcrypt.hash(password || 'demo123', 12);
      const user = await prisma.user.create({
        data: {
          email: contactEmail.trim().toLowerCase(),
          passwordHash,
          role: UserRole.CUSTOMER,
          firstName: contactFirstName?.trim() || name.trim(),
          lastName: contactLastName?.trim() || 'Account',
          customerId: customer.id,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          customerId: true,
          isActive: true,
        },
      });

      // 5. Audit log
      if (req.user?.userId) {
        await prisma.auditLog.create({
          data: {
            actorUserId: req.user.userId,
            action: AuditAction.USER_CREATED,
            entityType: 'customer',
            entityId: customer.id,
            metadata: {
              customerName: customer.name,
              contactEmail: user.email,
              registeredByRole: req.user.role,
            },
          },
        });
      }

      res.status(201).json({ customer, user, message: 'Customer registered and portal account created successfully' });
    } catch (err: unknown) {
      const e = err as { message: string };
      res.status(500).json({ error: e.message });
    }
  },
);

// PATCH /customers/:id — Reassign a customer's discount tier
configRouter.patch(
  '/customers/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = updateCustomerTierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const customer = await prisma.customer.update({
        where: { id: req.params.id as string },
        data: { discountTierId: parsed.data.discountTierId },
        include: {
          discountTier: {
            select: { id: true, name: true, defaultDiscountCeiling: true },
          },
        },
      });
      res.json({ customer });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'P2025') {
        res.status(404).json({ error: 'Customer not found' });
      } else {
        res.status(400).json({ error: e.message });
      }
    }
  },
);
