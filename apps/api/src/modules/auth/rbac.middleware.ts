/**
 * RBAC Middleware — Role-Based Access Control
 *
 * Spec refs: §8.20 (role + operation + resource ownership + state),
 *            §2 (actor roles), §8.21 (portal isolation)
 *
 * Usage: router.get('/path', authenticateToken, requireRole('ADMIN', 'MANAGER'), handler)
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';

/**
 * Middleware factory — checks req.user.role is in the allowed list.
 * Must be used AFTER authenticateToken (which populates req.user).
 * Returns 403 if the role is not allowed. Never 401 — token is already valid.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}` });
      return;
    }
    next();
  };
}
