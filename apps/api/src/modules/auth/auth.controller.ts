/**
 * Auth Controller — REST endpoints for signup, login, me
 *
 * Spec refs: §8.17 (Email+Password), §8.20 (RBAC), §7 (API surface)
 *
 * Routes registered in apps/api/src/index.ts under /api/v1/auth
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from './auth.middleware.js';
import * as AuthService from './auth.service.js';

export const authRouter = Router();

// ── Zod schemas ────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['ADMIN', 'SALES_REP', 'MANAGER', 'FINANCE_OPS', 'CUSTOMER']),
  customerId: z.string().uuid().optional(),
  companyName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── GET /api/v1/auth/customers — List active organizations for signup ───────────

authRouter.get('/customers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const customers = await AuthService.listPublicCustomers();
    res.json({ customers });
  } catch (err: unknown) {
    const e = err as { message: string };
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/v1/auth/signup ──────────────────────────────────────────────────

authRouter.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  // Public signup is restricted to internal Sales Representatives
  if (parsed.data.role === 'CUSTOMER') {
    res.status(403).json({
      error: 'Customer organization accounts cannot be created via public signup. Registration must be performed by an Administrator or Sales Representative.',
    });
    return;
  }

  try {
    const result = await AuthService.signup(
      parsed.data.email,
      parsed.data.password,
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.role,
      parsed.data.customerId,
      parsed.data.companyName,
    );
    res.status(201).json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await AuthService.login(parsed.data.email, parsed.data.password);
    res.json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────

authRouter.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await AuthService.getMe(req.user!.userId);
    res.json({ user });
  } catch (err: unknown) {
    const e = err as { status?: number; message: string };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});
