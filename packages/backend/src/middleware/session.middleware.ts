// Server-Side SQLite Session Verification Middleware
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db/index';
import type { Session } from '../db/schema';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: Session;
    }
  }
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.session_id || 
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!sessionId) {
    return res.status(401).json({ error: 'Unauthorized: invalid or terminated session' });
  }

  const now = Date.now();
  const sessionRow = db.prepare(`
    SELECT s.*, u.username, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, now) as (Session & { username: string; role: 'USER' | 'ADMIN' }) | undefined;

  if (!sessionRow) {
    return res.status(401).json({ error: 'Unauthorized: invalid or terminated session' });
  }

  // Check if credential is still ACTIVE (if credential_id is set)
  if (sessionRow.credential_id) {
    const cred = db.prepare(`SELECT status FROM credentials WHERE id = ?`).get(sessionRow.credential_id) as { status: string } | undefined;
    if (cred && cred.status === 'REVOKED') {
      // Purge invalid session immediately
      db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'REVOKED_CREDENTIAL_ACCESS_DENIED', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        sessionRow.user_id,
        JSON.stringify({ credentialId: sessionRow.credential_id, reason: 'Session used revoked credential' }),
        new Date().toISOString()
      );
      return res.status(401).json({ error: 'Unauthorized: credential has been revoked' });
    }
  }

  // Update last_active_at
  db.prepare(`UPDATE sessions SET last_active_at = ? WHERE id = ?`).run(now, sessionId);

  req.user = {
    id: sessionRow.user_id,
    username: sessionRow.username,
    role: sessionRow.role,
  };
  req.session = sessionRow;

  next();
}
