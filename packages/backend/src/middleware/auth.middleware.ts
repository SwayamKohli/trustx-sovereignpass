// Authentication & Role-Based Access Control Middleware
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import { Request, Response, NextFunction } from 'express';
import { requireSession } from './session.middleware';

export const requireAuth = requireSession;

export function requireRole(role: 'USER' | 'ADMIN') {
  return (req: Request, res: Response, next: NextFunction) => {
    requireSession(req, res, () => {
      if (req.user?.role !== role) {
        return res.status(403).json({ error: `Forbidden: requires ${role} role` });
      }
      next();
    });
  };
}

export const requireAdmin = requireRole('ADMIN');
