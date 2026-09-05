/**
 * Auth Middleware — JWT extraction and verification
 *
 * Spec refs: §8.19 (JWT tokens), §8.20 (server-side authorization),
 *            §8.21 (portal isolation)
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, type JwtPayload } from './auth.service.js';

// Extend Express Request to carry the decoded user (§8.20)
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Extract Bearer token from Authorization header, verify it, and attach
 * req.user = { userId, role, email, customerId }.
 * Returns 401 if missing or invalid — never 403 (that's RBAC's job).
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
