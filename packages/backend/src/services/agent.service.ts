import crypto from 'crypto';
import { db } from '../db/index';

export const PAYMENT_ACTION = 'POST /api/agent/execute-payment';
export interface DelegationIntent {
  intentId: string; userId: string; sessionId: string; action: string;
  recipient: string; maxAmount: number; nonce: string; challenge: string;
  intentHash: string; expiresAt: number;
  status: 'PENDING' | 'AUTHORIZED' | 'CONSUMED' | 'EXPIRED';
}
export type CapabilityPayload = DelegationIntent;
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export function amountPaise(amount: unknown): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > Math.max(1e-8, Number.EPSILON * amount * 200)) throw new Error('CAPABILITY_VIOLATION_AMOUNT');
  return Math.round(amount * 100);
}
function read(row: any): DelegationIntent | null {
  return row ? { intentId: row.intent_id, userId: row.user_id, sessionId: row.session_id, action: row.action, recipient: row.recipient, maxAmount: row.max_amount, nonce: row.nonce, challenge: row.challenge, intentHash: row.intent_hash, expiresAt: row.expires_at, status: row.status } : null;
}
export class AgentService {
  static createDelegationIntent(params: { userId: string; sessionId: string; action: string; recipient: string; maxAmount: number }): DelegationIntent {
    amountPaise(params.maxAmount);
    if (params.action !== PAYMENT_ACTION || !params.recipient?.trim() || params.recipient.length > 100) throw new Error('INVALID_INTENT_PARAMETERS');
    const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?').get(params.sessionId, params.userId, Date.now());
    if (!session) throw new Error('CAPABILITY_SESSION_MISMATCH');
    const intentId = `intent_${crypto.randomUUID()}`, nonce = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 5 * 60_000, recipient = params.recipient.trim();
    const intentHash = digest(JSON.stringify({ action: params.action, recipient, amountPaise: amountPaise(params.maxAmount), userId: params.userId, sessionId: params.sessionId, expiresAt, nonce }));
    const challenge = crypto.createHash('sha256').update(`${intentId}:${intentHash}:${nonce}`).digest('base64url');
    db.prepare(`INSERT INTO delegation_intents (intent_id,user_id,session_id,action,recipient,max_amount,nonce,challenge,intent_hash,expires_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'PENDING',?)`).run(intentId, params.userId, params.sessionId, params.action, recipient, params.maxAmount, nonce, challenge, intentHash, expiresAt, new Date().toISOString());
    return this.getIntent(intentId)!;
  }
  static getIntent(id: string): DelegationIntent | null {
    return read(db.prepare('SELECT * FROM delegation_intents WHERE intent_id = ?').get(id));
  }
  static mintCapabilityToken(intent: DelegationIntent): string {
    // Only a hash of this opaque 256-bit capability is stored; no restart-sensitive signing key.
    const token = crypto.randomBytes(32).toString('base64url');
    const result = db.prepare("UPDATE delegation_intents SET status = 'AUTHORIZED', token_hash = ? WHERE intent_id = ? AND status = 'PENDING' AND expires_at > ?").run(digest(token), intent.intentId, Date.now());
    if (!result.changes) throw new Error('INVALID_INTENT');
    return token;
  }
  static verifyCapabilityToken(token: string): DelegationIntent {
    if (typeof token !== 'string' || token.length !== 43) throw new Error('INVALID_CAPABILITY_TOKEN');
    const intent = read(db.prepare('SELECT * FROM delegation_intents WHERE token_hash = ?').get(digest(token)));
    if (!intent) throw new Error('INVALID_CAPABILITY_TOKEN');
    if (intent.expiresAt <= Date.now()) throw new Error('TOKEN_EXPIRED');
    if (intent.status === 'CONSUMED') throw new Error('TOKEN_REPLAY');
    if (intent.status !== 'AUTHORIZED') throw new Error('INVALID_INTENT');
    return intent;
  }
  static executeConstrainedAction(token: string, execution: { recipient: string; amount: number }, actor: { userId: string; sessionId: string; action: string }) {
    return db.transaction(() => {
      const intent = this.verifyCapabilityToken(token);
      if (actor.userId !== intent.userId) throw new Error('CAPABILITY_OWNER_MISMATCH');
      if (actor.sessionId !== intent.sessionId || !db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?').get(actor.sessionId, actor.userId, Date.now())) throw new Error('CAPABILITY_SESSION_MISMATCH');
      if (actor.action !== intent.action) throw new Error('CAPABILITY_ACTION_MISMATCH');
      if (execution.recipient !== intent.recipient) throw new Error('CAPABILITY_VIOLATION_RECIPIENT');
      if (amountPaise(execution.amount) !== amountPaise(intent.maxAmount)) throw new Error('CAPABILITY_VIOLATION_AMOUNT');
      const balance = 12_500_000 - (db.prepare('SELECT COALESCE(SUM(amount_paise),0) AS total FROM sandbox_payments WHERE user_id = ?').get(actor.userId) as { total: number }).total;
      if (amountPaise(execution.amount) > balance) throw new Error('SANDBOX_INSUFFICIENT_BALANCE');
      const consumed = db.prepare("UPDATE delegation_intents SET status = 'CONSUMED' WHERE intent_id = ? AND status = 'AUTHORIZED' AND expires_at > ?").run(intent.intentId, Date.now());
      if (consumed.changes !== 1) throw new Error('TOKEN_REPLAY');
      const txId = `tx_${crypto.randomUUID()}`, timestamp = new Date().toISOString();
      db.prepare("INSERT INTO sandbox_payments (id,user_id,intent_id,recipient,amount_paise,source,created_at) VALUES (?,?,?,?,?,'INTENTLOCK',?)").run(txId, actor.userId, intent.intentId, intent.recipient, amountPaise(execution.amount), timestamp);
      db.prepare('INSERT INTO audit_events (id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), 'AGENT_ACTION_EXECUTED', actor.userId, JSON.stringify({ intentId: intent.intentId, intentHash: intent.intentHash, txId, recipient: execution.recipient, amount: execution.amount }), timestamp);
      return { success: true as const, txId, intentId: intent.intentId, executedAmount: execution.amount, recipient: execution.recipient, timestamp };
    }).immediate();
  }
}
