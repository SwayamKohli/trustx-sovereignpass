// Risk Scoring Anomaly Engine & Step-Up Interception Middleware
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import { Request, Response, NextFunction } from 'express';
import { RiskService, RiskAssessment } from '../services/risk.service';

// Extend Express Request interface for TrustX session and risk context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: 'USER' | 'ADMIN';
      };
      sessionRecord?: {
        id: string;
        userId: string;
        ipAddress: string;
        userAgent: string;
        isKiosk: boolean;
      };
      riskAssessment?: RiskAssessment;
      intentHash?: string;
    }
  }
}

/**
 * Middleware factory for risk evaluation and step-up enforcement.
 * Enforces action-bound step-up authentication when risk score is HIGH
 * or when accessing sensitive endpoints.
 */
export function requireRiskEvaluation(forceStepUp: boolean = false) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const currentIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const currentUserAgent = req.headers['user-agent'] || 'unknown';

    const risk = RiskService.evaluateRisk({
      currentIp,
      sessionIp: req.sessionRecord?.ipAddress,
      currentUserAgent,
      sessionUserAgent: req.sessionRecord?.userAgent,
      method: req.method,
      route: req.baseUrl + req.path,
      isKiosk: req.sessionRecord?.isKiosk,
    });

    if (forceStepUp) {
      risk.stepUpRequired = true;
      risk.level = 'HIGH';
      risk.score = Math.max(risk.score, 85);
      if (!risk.reasons.includes('Enforced mandatory step-up authentication policy')) {
        risk.reasons.push('Enforced mandatory step-up authentication policy');
      }
    }

    req.riskAssessment = risk;
    const intentHash = RiskService.computeIntentHash(req.method, req.baseUrl + req.path, req.body);
    req.intentHash = intentHash;

    if (!risk.stepUpRequired) {
      return next();
    }

    // High risk detected — step-up token required
    const stepUpToken = req.headers['x-step-up-token'] as string | undefined;

    if (!stepUpToken) {
      res.status(403).json({
        error: 'STEP_UP_REQUIRED',
        message: 'Action-bound biometric step-up re-authentication required.',
        risk: {
          score: risk.score,
          level: risk.level,
          reasons: risk.reasons,
        },
        intentHash,
        stepUpChallengeRoute: '/api/auth/step-up-challenge',
        stepUpVerifyRoute: '/api/auth/step-up-verify',
      });
      return;
    }

    // Attach step-up token to request for verification by route handler / db transaction
    // Route handler atomically verifies intentHash, consumes token, and executes action.
    next();
  };
}
