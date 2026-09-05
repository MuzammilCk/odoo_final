/**
 * Reporting Controller — REST endpoints for aggregated analytics & exports
 *
 * Spec refs: §A7, UC-21–22, §8.20 (RBAC: ADMIN + MANAGER only)
 */

import { Router, type Request, type Response } from 'express';
import { authenticateToken } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.middleware.js';
import * as ReportingService from './reporting.service.js';

export const reportingRouter = Router();

function parseDateFilters(req: Request): ReportingService.ReportFilters {
  const { startDate, endDate, salesRepId, categoryId, status } = req.query;
  return {
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    salesRepId: salesRepId as string | undefined,
    categoryId: categoryId as string | undefined,
    status: status as string | undefined,
  };
}

// ── GET /api/v1/internal/reports/sales-performance ─────────────────────────────

reportingRouter.get(
  '/sales-performance',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = parseDateFilters(req);
      const data = await ReportingService.getSalesPerformance(filters);
      res.json(data);
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── GET /api/v1/internal/reports/product-performance ───────────────────────────

reportingRouter.get(
  '/product-performance',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = parseDateFilters(req);
      const data = await ReportingService.getProductPerformance(filters);
      res.json(data);
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── GET /api/v1/internal/reports/approval-summary ──────────────────────────────

reportingRouter.get(
  '/approval-summary',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = parseDateFilters(req);
      const data = await ReportingService.getApprovalSummary(filters);
      res.json(data);
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);

// ── GET /api/v1/internal/reports/export ────────────────────────────────────────

reportingRouter.get(
  '/export',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportType, format } = req.query;
      const filters = parseDateFilters(req);

      let data: unknown;
      if (reportType === 'product-performance') {
        data = await ReportingService.getProductPerformance(filters);
      } else if (reportType === 'approval-summary') {
        data = await ReportingService.getApprovalSummary(filters);
      } else {
        data = await ReportingService.getSalesPerformance(filters);
      }

      if (format === 'csv') {
        // Return CSV representation
        const jsonStr = JSON.stringify(data, null, 2);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType || 'sales'}-report.csv"`);
        res.send(jsonStr);
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType || 'sales'}-report.json"`);
      res.json(data);
    } catch (err: unknown) {
      const e = err as { status?: number; message: string };
      res.status(e.status ?? 500).json({ error: e.message });
    }
  },
);
