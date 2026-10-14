// IP & Device Novelty Anomaly Scoring Engine
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import crypto from 'crypto';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskAssessment {
  score: number; // 0 to 100
  level: RiskLevel;
  reasons: string[];
  stepUpRequired: boolean;
}

export interface StepUpAuthorization {
  token: string;
  userId: string;
  sessionId: string;
  httpMethod: string;
  route: string;
  intentHash: string;
  expiresAt: number; // Unix timestamp ms
  consumed: boolean;
}

export class RiskService {
  private static sensitiveRoutes = new Set([
    'POST:/api/devices/revoke',
    'POST:/api/admin/sessions/terminate',
    'POST:/api/agent/execute-payment',
    'POST:/api/auth/step-up-verify',
  ]);

  /**
   * Computes SHA-256 hash of structured request intent (Method + Route + Body).
   * Guarantees exact binding so an approved token cannot be swapped for a different action.
   */
  public static computeIntentHash(method: string, route: string, body: unknown): string {
    const canonicalPayload = JSON.stringify(body || {});
    return crypto
      .createHash('sha256')
      .update(`${method.toUpperCase()}:${route.toLowerCase()}:${canonicalPayload}`)
      .digest('hex');
  }

  /**
   * Evaluates contextual risk based on IP divergence, User-Agent alteration,
   * and action sensitivity.
   */
  public static evaluateRisk(params: {
    currentIp: string;
    sessionIp?: string;
    currentUserAgent: string;
    sessionUserAgent?: string;
    method: string;
    route: string;
    isKiosk?: boolean;
  }): RiskAssessment {
    let score = 10; // Baseline normal risk
    const reasons: string[] = [];

    // 1. IP Divergence Check
    if (params.sessionIp && params.currentIp !== params.sessionIp) {
      score += 45;
      reasons.push(`IP divergence detected (Session IP: ${params.sessionIp}, Request IP: ${params.currentIp})`);
    }

    // 2. User-Agent Mismatch Check
    if (params.sessionUserAgent && params.currentUserAgent !== params.sessionUserAgent) {
      score += 35;
      reasons.push('Client User-Agent altered within active session');
    }

    // 3. Sensitive Action Check
    const actionKey = `${params.method.toUpperCase()}:${params.route.toLowerCase()}`;
    if (this.sensitiveRoutes.has(actionKey)) {
      score += 40;
      reasons.push(`High-privilege sensitive route accessed: ${actionKey}`);
    }

    // 4. Kiosk Shared Machine Context
    if (params.isKiosk) {
      score += 20;
      reasons.push('Shared workstation session context');
    }

    score = Math.min(100, score);

    let level: RiskLevel = 'LOW';
    if (score >= 70) {
      level = 'HIGH';
    } else if (score >= 40) {
      level = 'MEDIUM';
    }

    return {
      score,
      level,
      reasons,
      stepUpRequired: level === 'HIGH',
    };
  }

  /**
   * Generates a high-entropy cryptographically random step-up token.
   */
  public static generateStepUpToken(): string {
    return `sup_${crypto.randomBytes(32).toString('hex')}`;
  }
}
