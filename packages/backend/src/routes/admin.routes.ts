// Admin SOC & Incident Monitoring Routes
// Owner: Swayam (Role 4 — Systems Integration, DPoP & Risk Engine Lead)

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/index';
import { buildAuditLedger } from '../scripts/export-audit-log';
import type { Session } from '../db/schema';
import { requireAdmin } from '../middleware/auth.middleware';
import { runLiveProbes, type LiveReport } from '../services/live-probes';

const router = Router();

/**
 * Middleware ensuring caller has active session with ADMIN role
 */
const requireAdminRole = requireAdmin;

/**
 * GET /api/admin/credentials
 * Returns registered credentials across all citizens
 */
router.get('/credentials', requireAdminRole, (req: Request, res: Response) => {
  try {
    const rawCredentials = db.prepare(`
      SELECT 
        c.id, u.username, c.device_name as deviceName, c.status,
        c.created_at as createdAt, c.last_used_at as lastUsedAt
      FROM credentials c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `).all() as any[];

    const credentials = rawCredentials.map(c => ({
      id: c.id,
      username: c.username,
      deviceName: c.deviceName,
      status: c.status,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt || c.createdAt,
    }));

    return res.json({ credentials });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to query credentials' });
  }
});

/**
 * GET /api/admin/sessions
 * Returns all active sessions across all users with device binding status
 */
router.get('/sessions', requireAdminRole, (req: Request, res: Response) => {
  try {
    const rawSessions = db.prepare(`
      SELECT 
        s.id, s.user_id, u.username, s.credential_id, s.created_at, s.expires_at,
        s.is_kiosk, s.ip_address, s.user_agent, s.last_active_at,
        CASE WHEN s.dpop_public_key IS NOT NULL THEN 1 ELSE 0 END as is_device_bound
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > ?
      ORDER BY s.last_active_at DESC
    `).all(Date.now()) as any[];

    const sessions = rawSessions.map(s => ({
      sessionId: s.id,
      id: s.id,
      username: s.username,
      isKiosk: Boolean(s.is_kiosk),
      is_kiosk: s.is_kiosk,
      ipAddress: s.ip_address,
      ip_address: s.ip_address,
      userAgent: s.user_agent,
      user_agent: s.user_agent,
      createdAt: s.created_at,
      created_at: s.created_at,
      expiresAt: s.expires_at,
      expires_at: s.expires_at,
      isDeviceBound: Boolean(s.is_device_bound),
      isCurrent: s.id === req.session?.id,
      is_device_bound: s.is_device_bound,
    }));

    return res.json({ sessions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to query active sessions' });
  }
});

/**
 * POST /api/admin/sessions/terminate
 * Instantly revokes an active session in SQLite (server-side invalidation)
 */
router.post('/sessions/terminate', requireAdminRole, (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = db.prepare('SELECT id, user_id FROM sessions WHERE id = ?').get(sessionId) as Session | undefined;
    if (!session) {
      return res.status(404).json({ error: 'Session not found or already terminated' });
    }

    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_events (id, type, user_id, detail, timestamp)
      VALUES (?, 'ADMIN_SESSION_TERMINATED', ?, ?, ?)
    `).run(
      `aud_term_${Date.now()}`,
      session.user_id,
      JSON.stringify({ terminatedSessionId: sessionId }),
      new Date().toISOString()
    );

    return res.json({ success: true, terminatedSessionId: sessionId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to terminate session' });
  }
});

/**
 * GET /api/admin/audit-logs
 * Returns structured audit events with cryptographic SHA-256 tamper-evident verification
 */
router.get('/audit-logs', requireAdminRole, (req: Request, res: Response) => {
  try {
    const rawEvents = db.prepare(`
      SELECT id, type, user_id, detail, timestamp
      FROM audit_events
      ORDER BY timestamp DESC
      LIMIT 100
    `).all() as any[];

    const logs = rawEvents.map(e => {
      let detailsObj: any = {};
      try {
        detailsObj = typeof e.detail === 'string' ? JSON.parse(e.detail) : (e.detail || {});
      } catch {
        detailsObj = { raw: e.detail };
      }
      return {
        id: e.id,
        eventType: e.type,
        timestamp: e.timestamp,
        userId: e.user_id,
        details: detailsObj,
      };
    });

    return res.json({ logs, totalEvents: (db.prepare('SELECT COUNT(*) AS count FROM audit_events').get() as { count: number }).count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to query audit ledger' });
  }
});

/**
 * POST /api/admin/audit-chain/verify
 * Cryptographically re-verifies the SHA-256 hash-chain integrity across all ledger blocks
 */
router.post('/audit-chain/verify', requireAdminRole, (req: Request, res: Response) => {
  try {
    const { ledger, isTamperFree } = buildAuditLedger();
    return res.json({
      intact: isTamperFree,
      checkedEvents: ledger.length,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to verify audit chain' });
  }
});

let latestReport: LiveReport | undefined;
router.post('/login-history', requireAdminRole, (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim().slice(0,100) : '';
  const page = req.body.page ?? 0;
  if (!Number.isInteger(page) || page < 0 || page > 100_000) return res.status(400).json({ error: 'INVALID_HISTORY_PAGE' });
  const types = ['AUTH_LOGIN_SUCCESS','AUTH_VERIFY_FAILED','PHISHING_ORIGIN_REJECTED','LOGIN_EXTRA_CHECK_REQUIRED','LOGIN_EXTRA_CHECK_REJECTED'];
  const where = `a.type IN (${types.map(() => '?').join(',')}) AND (? = '' OR u.username = ?)`;
  const parameters = [...types, username, username];
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_events a LEFT JOIN users u ON u.id = a.user_id WHERE ${where}`).get(...parameters) as {n:number}).n;
  const rows = db.prepare(`SELECT a.id,a.type,a.timestamp,a.detail,u.username FROM audit_events a LEFT JOIN users u ON u.id = a.user_id WHERE ${where} ORDER BY a.timestamp DESC, a.rowid DESC LIMIT 25 OFFSET ?`).all(...parameters,page*25) as {id:string;type:string;timestamp:string;detail:string;username:string|null}[];
  return res.json({ total, page, pageSize:25, entries:rows.map(row => {
    let detail: Record<string, unknown> = {};
    try { detail = JSON.parse(row.detail || '{}'); } catch { /* Legacy malformed details are not trusted. */ }
    return { id:row.id, username:row.username, eventType:row.type, timestamp:row.timestamp, ipAddress:detail.ipAddress || detail.ip || null, userAgent:detail.userAgent || null, risk:detail.risk || null, outcome:row.type === 'AUTH_LOGIN_SUCCESS' ? 'SIGNED_IN' : row.type === 'LOGIN_EXTRA_CHECK_REQUIRED' ? 'EXTRA_CHECK_REQUIRED' : 'REJECTED' };
  }) });
});
let running = false;
router.get('/attack-results', requireAdminRole, (_req, res) => latestReport ? res.json(latestReport) : res.status(404).json({ error: 'NO_PROBE_RUN_YET' }));
router.post('/attacks/run', requireAdminRole, async (req, res) => {
  const probeId = req.body.probeId;
  if (probeId !== undefined && !/^(?:[1-9]|10)$/.test(String(probeId))) return res.status(400).json({ error: 'INVALID_PROBE_ID' });
  if (running) return res.status(409).json({ error: 'A probe run is already in progress' });
  running = true;
  try { latestReport = await runLiveProbes(probeId === undefined ? undefined : String(probeId)); return res.json(latestReport); }
  catch { return res.status(500).json({ error: 'PROBE_RUN_FAILED' }); }
  finally { running = false; }
});
export default router;
