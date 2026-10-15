// Request-Bound Step-Up Authorization Middleware
// Owner: Swayam (Role 4 — Systems Integration, DPoP & Risk Engine Lead)
// Enforces cryptographic binding between Step-Up Token, User, Session, HTTP Method, Route & Request Body

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index';
import { RiskService } from '../services/risk.service';
import type { StepUpAuthorization } from '../db/schema';

export interface StepUpOptions {
  alwaysEnforce?: boolean;
}
const approvedTokens = new WeakMap<Request, string>();
// Call inside the same transaction as the protected mutation, never across an await.
export function consumeStepUpAuthorization(req: Request) {
  const token = approvedTokens.get(req);
  if (!token) return;
  const result = db.prepare('UPDATE step_up_authorizations SET consumed = 1 WHERE token = ? AND consumed = 0 AND expires_at > ?').run(token, Date.now());
  if (result.changes !== 1) throw new Error('Step-up expired or concurrently consumed');
}

/**
 * Express middleware that evaluates deterministic risk signals and enforces request-bound single-use step-up tokens.
 */
export function requireStepUpAuthorization(options: StepUpOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.userId) {
      return res.status(401).json({ error: 'Session required before evaluating step-up authorization' });
    }

    const currentIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const currentUserAgent = req.headers['user-agent'] || 'unknown';

    const risk = RiskService.evaluateRisk({
      currentIp,
      sessionIp: req.session.ip_address,
      currentUserAgent,
      sessionUserAgent: req.session.user_agent,
      method: req.method,
      route: req.originalUrl || req.path,
    });

    const isStepUpDemanded = options.alwaysEnforce || risk.stepUpRequired;
    const intentHash = RiskService.computeIntentHash(req.method, req.originalUrl || req.path, req.body || {});

    if (isStepUpDemanded) {
      const stepUpToken = req.headers['x-step-up-token'] as string | undefined;

      if (!stepUpToken) {
        return res.status(403).json({
          error: 'STEP_UP_REQUIRED',
          stepUpRequired: true,
          riskLevel: risk.level,
          riskScore: risk.score,
          intentHash,
          reason: risk.reasons.join(', '),
        });
      }

      // Verify token in database
      const record = db.prepare(`
        SELECT token, user_id, session_id, http_method, route, intent_hash, expires_at, consumed
        FROM step_up_authorizations
        WHERE token = ?
      `).get(stepUpToken) as StepUpAuthorization | undefined;

      if (!record) {
        return res.status(403).json({ error: 'Invalid step-up authorization token' });
      }

      const now = Date.now();
      if (record.consumed === 1) {
        return res.status(403).json({ error: 'Step-up token has already been consumed (Replay blocked)' });
      }
      if (record.expires_at < now) {
        return res.status(403).json({ error: 'Step-up token has expired' });
      }
      if (record.user_id !== req.userId) {
        return res.status(403).json({ error: 'Step-up token bound to different user' });
      }
      if (record.session_id !== req.session.id) {
        return res.status(403).json({ error: 'Step-up token bound to different session' });
      }
      if (record.http_method !== req.method.toUpperCase()) {
        return res.status(403).json({ error: 'Step-up token bound to different HTTP method' });
      }

      // Check route normalization
      const expectedRoute = (req.originalUrl || req.path).split('?')[0].replace(/\/+$/, '');
      const recordRoute = record.route.split('?')[0].replace(/\/+$/, '');
      if (recordRoute !== expectedRoute) {
        return res.status(403).json({ error: 'Step-up token bound to different route' });
      }

      if (record.intent_hash !== intentHash) {
        return res.status(403).json({ error: 'Step-up token intent hash mismatch: request payload altered' });
      }

      approvedTokens.set(req, stepUpToken);
    }

    next();
  };
}
