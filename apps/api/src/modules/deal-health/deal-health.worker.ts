/**
 * Deal Health Worker — Periodic background monitor
 *
 * Spec refs: §6.41–§6.43, §8.46 (Rule 20: background worker must invoke the
 *            exact same domain service as the API endpoint)
 */

import { evaluate } from './deal-health.service.js';

let intervalId: NodeJS.Timeout | null = null;

export function startDealHealthWorker(intervalMs: number = 15 * 60 * 1000): void {
  if (intervalId) return;

  console.log(`[deal-health-worker] Started Deal Health background monitor (every ${intervalMs / 1000}s)`);

  // Initial evaluation after 5 seconds
  setTimeout(async () => {
    try {
      const res = await evaluate();
      console.log(`[deal-health-worker] Initial evaluation complete: ${res.total} new flags generated`);
    } catch (err) {
      console.error('[deal-health-worker] Evaluation failed:', err);
    }
  }, 5000);

  // Periodic interval
  intervalId = setInterval(async () => {
    try {
      const res = await evaluate();
      if (res.total > 0) {
        console.log(`[deal-health-worker] Periodic evaluation found ${res.total} new flags`);
      }
    } catch (err) {
      console.error('[deal-health-worker] Periodic evaluation failed:', err);
    }
  }, intervalMs);
}

export function stopDealHealthWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[deal-health-worker] Stopped Deal Health background monitor');
  }
}
