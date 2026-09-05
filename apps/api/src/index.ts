import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.controller.js';
import { portalRouter } from './modules/portal/portal.controller.js';
import { negotiationRouter } from './modules/negotiations/negotiation.controller.js';
import { fulfillmentRouter } from './modules/fulfillment/fulfillment.controller.js';
import { backorderRouter } from './modules/backorders/backorder.controller.js';
import { inventoryRouter } from './modules/inventory/inventory.controller.js';

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
app.use('/api/v1/internal/quotations', negotiationRouter);
app.use('/api/v1/internal/fulfillment', fulfillmentRouter);
app.use('/api/v1/internal/backorders', backorderRouter);
app.use('/api/v1/internal', inventoryRouter);
// Additional routes registered here as each feature is built (F4 → Lane A/B/C)
// e.g. app.use('/api/v1/internal/quotations', quotationRouter);

// ── 404 fallback ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] DealFlow360 API running on http://localhost:${PORT}`);
});

export default app;
