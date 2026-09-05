import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.controller.js';

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
// Additional routes registered here as each feature is built (F4 → Lane A/B/C)
// e.g. app.use('/api/v1/internal/quotations', quotationRouter);
// e.g. app.use('/api/v1/portal', portalRouter);

// ── 404 fallback ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] DealFlow360 API running on http://localhost:${PORT}`);
});

export default app;
