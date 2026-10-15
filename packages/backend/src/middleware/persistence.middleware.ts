import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { requireStepUpAuthorization } from './stepup.middleware';

export const persistencePolicy = {
  enrollment: 'Existing active passkey → request-bound approval → single-use session-bound registration ceremony',
  revocation: 'Existing active passkey → request-bound, single-use approval',
  recoveryCodes: 'Personal session + existing active passkey → atomic code replacement',
  recovery: 'Separate one-time recovery code → expiring ticket → verified replacement → revoke prior access',
  notifications: 'Authenticated in-app lifecycle event feed; no email/SMS delivery is configured',
  sessionPolicy: 'Enrollment retains existing sessions; revocation ends sessions bound to the revoked credential; completed recovery ends all prior sessions',
};

// Shared enforcement for authenticated changes; public recovery deliberately uses its separate one-time authority.
export function requirePersistenceAuthorization(operation: 'enrollment' | 'revocation' | 'recoveryCodes') {
  const fresh = requireStepUpAuthorization({ alwaysEnforce: true });
  return (req: Request, res: Response, next: NextFunction) => {
    res.once('finish', () => {
      if (res.statusCode < 400 || !req.userId) return;
      try { db.prepare('INSERT INTO audit_events(id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), 'PERSISTENCE_GUARD_DENIED', req.userId, JSON.stringify({ operation, path: req.path, httpStatus: res.statusCode }), new Date().toISOString()); }
      catch { console.error('PersistenceGuard denial audit could not be stored'); }
    });
    if (req.session?.is_kiosk) return res.status(403).json({ error: 'KIOSK_SECURITY_MUTATION_FORBIDDEN' });
    return fresh(req, res, next);
  };
}
