import { db } from '../db/index';
export type LoginRisk = { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH'; reasons: string[]; extraCheckRequired: boolean; extraCheckCompleted?: boolean };

export function assessLoginContext(userId: string, credentialId: string, ip: string, userAgent: string): LoginRisk {
  const known = db.prepare('SELECT ip_address, user_agent FROM known_login_contexts WHERE user_id = ? AND credential_id = ?').get(userId, credentialId) as { ip_address: string; user_agent: string } | undefined;
  const reasons: string[] = [];
  let score = 10;
  if (known) {
    if (known.ip_address !== ip) { score += 45; reasons.push('NETWORK_ADDRESS_CHANGED'); }
    if (known.user_agent !== userAgent) { score += 35; reasons.push('BROWSER_CONTEXT_CHANGED'); }
  } else if (db.prepare('SELECT user_id FROM known_login_contexts WHERE user_id = ? LIMIT 1').get(userId)) {
    score += 60; reasons.push('NEW_AUTHENTICATOR_CONTEXT');
  }
  return { score, level: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW', reasons, extraCheckRequired: reasons.length > 0 };
}
