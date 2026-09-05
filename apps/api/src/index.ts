import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.controller.js';
import { quotationRouter } from './modules/quotations/quotation.controller.js';
import { approvalRouter } from './modules/approvals/approval.controller.js';
import { dashboardRouter } from './modules/dashboard/dashboard.controller.js';
import { configRouter } from './modules/discount-config/config.controller.js';
import { portalRouter } from './modules/portal/portal.controller.js';
import { negotiationRouter } from './modules/negotiations/negotiation.controller.js';
import { fulfillmentRouter } from './modules/fulfillment/fulfillment.controller.js';
import { backorderRouter } from './modules/backorders/backorder.controller.js';
import { inventoryRouter } from './modules/inventory/inventory.controller.js';
import { productRouter } from './modules/products/product.controller.js';
import { subscriptionRouter } from './modules/subscriptions/subscription.controller.js';
import { billingRouter } from './modules/billing/billing.controller.js';
import { paymentRouter } from './modules/payments/payment.controller.js';
import { dealHealthRouter } from './modules/deal-health/deal-health.controller.js';
import { reportingRouter } from './modules/reporting/reporting.controller.js';
import { startDealHealthWorker } from './modules/deal-health/deal-health.worker.js';

const app = express();
const PORT = process.env.API_PORT ?? 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.APP_BASE_URL ?? 'http://localhost:5173' }));
app.use(express.json());

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Route modules ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/portal', portalRouter);

// Lane A (Commercial Core)
app.use('/api/v1/internal/quotations', quotationRouter);
app.use('/api/v1/internal/approvals', approvalRouter);
app.use('/api/v1/internal/dashboard', dashboardRouter);
app.use('/api/v1/internal', configRouter);

// Lane B (Fulfillment & Negotiations)
app.use('/api/v1/internal/quotations', negotiationRouter);
app.use('/api/v1/internal/fulfillment', fulfillmentRouter);
app.use('/api/v1/internal/backorders', backorderRouter);
app.use('/api/v1/internal', inventoryRouter);

// Lane C (Money & Monitoring)
app.use('/api/v1/internal', productRouter);
app.use('/api/v1/internal/subscriptions', subscriptionRouter);
app.use('/api/v1/internal', billingRouter);
app.use('/api/v1/internal', paymentRouter);
app.use('/api/v1/internal/deal-health', dealHealthRouter);
app.use('/api/v1/internal/reports', reportingRouter);

// ── 404 fallback ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] DealFlow360 API running on http://localhost:${PORT}`);
  // Start Deal Health background monitoring worker
  if (process.env.NODE_ENV !== 'test') {
    startDealHealthWorker();
  }
});

export default app;
