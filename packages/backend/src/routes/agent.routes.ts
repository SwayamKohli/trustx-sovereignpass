import { Router } from 'express';
import crypto from 'crypto';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { AgentService, amountPaise } from '../services/agent.service';
import { requireSession } from '../middleware/session.middleware';
import { db } from '../db/index';
import { getEffectiveOrigin, getEffectiveRpID } from './auth.routes';
import type { Credential } from '../db/schema';

const router = Router();
function audit(type: string, userId: string, detail: unknown) {
  db.prepare('INSERT INTO audit_events (id, type, user_id, detail, timestamp) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), type, userId, JSON.stringify(detail), new Date().toISOString());
}

router.post('/delegate-challenge', requireSession, async (req, res) => {
  const { action, recipient, maxAmount } = req.body;
  if (action !== 'POST /api/agent/execute-payment' || typeof recipient !== 'string' || !recipient.trim() || recipient.length > 100 || !Number.isFinite(maxAmount) || maxAmount <= 0) return res.status(400).json({ error: 'INVALID_INTENT_PARAMETERS' });
  try {
    const credentials = db.prepare("SELECT * FROM credentials WHERE user_id = ? AND status = 'ACTIVE'").all(req.user!.id) as Credential[];
    if (!credentials.length) return res.status(400).json({ error: 'NO_ACTIVE_PASSKEY' });
    amountPaise(maxAmount);
    const intent = AgentService.createDelegationIntent({ userId: req.user!.id, sessionId: req.session!.id, action, recipient: recipient.trim(), maxAmount });
    const authenticationOptions = await generateAuthenticationOptions({
      rpID: getEffectiveRpID(req), challenge: Buffer.from(intent.challenge, 'base64url'), userVerification: 'required',
      allowCredentials: credentials.map(credential => ({ id: credential.id, transports: credential.transports ? JSON.parse(credential.transports) : undefined })),
    });
    return res.json({ success: true, intentId: intent.intentId, authenticationOptions, binding: { recipient: intent.recipient, maxAmount, intentHash: intent.intentHash, action, expiresAt: intent.expiresAt } });
  } catch { return res.status(400).json({ error: 'DELEGATION_CHALLENGE_FAILED' }); }
});

router.post('/delegate-verify', requireSession, async (req, res) => {
  const { intentId, assertionResponse } = req.body;
  if (typeof intentId !== 'string' || !assertionResponse) return res.status(400).json({ error: 'PASSKEY_ASSERTION_REQUIRED' });
  const intent = AgentService.getIntent(intentId);
  if (!intent || intent.userId !== req.user!.id || intent.sessionId !== req.session!.id || intent.expiresAt <= Date.now() || intent.status !== 'PENDING') return res.status(403).json({ error: 'INVALID_INTENT' });
  const credential = db.prepare("SELECT * FROM credentials WHERE id = ? AND user_id = ? AND status = 'ACTIVE'").get(assertionResponse.id, req.user!.id) as Credential | undefined;
  if (!credential) return res.status(401).json({ error: 'INVALID_CREDENTIAL' });
  try {
    const verification = await verifyAuthenticationResponse({
      response: assertionResponse, expectedChallenge: intent.challenge, expectedOrigin: getEffectiveOrigin(req), expectedRPID: getEffectiveRpID(req),
      credential: { id: credential.id, publicKey: new Uint8Array(credential.public_key), counter: credential.counter, transports: credential.transports ? JSON.parse(credential.transports) : undefined },
      requireUserVerification: true,
    });
    if (!verification.verified) return res.status(401).json({ error: 'PASSKEY_NOT_VERIFIED' });
    const capabilityToken = db.transaction(() => {
      if (!db.prepare("SELECT id FROM credentials WHERE id = ? AND status = 'ACTIVE'").get(credential.id) || !db.prepare('SELECT id FROM sessions WHERE id = ? AND expires_at > ?').get(req.session!.id, Date.now())) throw new Error('AUTHORIZATION_REVOKED');
      db.prepare('UPDATE credentials SET counter = ? WHERE id = ?').run(verification.authenticationInfo.newCounter, credential.id);
      const token = AgentService.mintCapabilityToken(intent);
      audit('AGENT_INTENT_AUTHORIZED', req.user!.id, { intentId, intentHash: intent.intentHash, recipient: intent.recipient, amount: intent.maxAmount });
      return token;
    }).immediate();
    return res.json({ success: true, capabilityToken, expiresAt: intent.expiresAt });
  } catch { return res.status(401).json({ error: 'DELEGATION_VERIFICATION_FAILED' }); }
});

router.post('/execute-payment', requireSession, (req, res) => {
  const token = req.body.capabilityToken || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
  const { recipient, amount } = req.body.paymentDetails || req.body;
  if (typeof token !== 'string') return res.status(401).json({ error: 'MISSING_CAPABILITY_TOKEN' });
  try {
    const result = AgentService.executeConstrainedAction(token, { recipient, amount }, { userId: req.user!.id, sessionId: req.session!.id, action: 'POST /api/agent/execute-payment' });
    return res.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split(':')[0] : 'CAPABILITY_REJECTED';
    const eventId = crypto.randomUUID(), timestamp = new Date().toISOString();
    const intent = db.prepare('SELECT intent_id FROM delegation_intents WHERE token_hash = ? AND user_id = ?').get(crypto.createHash('sha256').update(token).digest('hex'), req.user!.id) as { intent_id: string } | undefined;
    db.prepare('INSERT INTO audit_events (id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(eventId, 'AGENT_ACTION_BLOCKED', req.user!.id, JSON.stringify({ recipient, amount, reason, intentId: intent?.intent_id }), timestamp);
    return res.status(403).json({ error: 'CAPABILITY_CONSTRAINT_VIOLATION', reason, blocked: true, intentId: intent?.intent_id, eventId, timestamp });
  }
});

router.get('/state', requireSession, (req, res) => {
  const payments = db.prepare('SELECT id, intent_id AS intentId, recipient, amount_paise AS amountPaise, source, created_at AS timestamp FROM sandbox_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user!.id);
  const total = (db.prepare('SELECT COALESCE(SUM(amount_paise),0) AS total FROM sandbox_payments WHERE user_id = ?').get(req.user!.id) as { total: number }).total;
  const events = db.prepare("SELECT id, type, detail, timestamp FROM audit_events WHERE user_id = ? AND type IN ('AGENT_ACTION_EXECUTED','AGENT_ACTION_BLOCKED','AGENT_INTENT_AUTHORIZED') ORDER BY timestamp DESC LIMIT 20").all(req.user!.id);
  return res.json({ initialBalancePaise: 12_500_000, balancePaise: 12_500_000 - total, payments, events, notice: 'Synthetic sandbox INR. No connection to a bank or payment network.' });
});

router.post('/vulnerable-legacy-payment', (req, res) => {
  const { recipient, amount } = req.body;
  if (typeof recipient !== 'string' || !recipient.trim() || recipient.length > 100 || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'INVALID_DEMO_PAYMENT' });
  return res.json({ status: 'UNCONSTRAINED_DEMO_ACCEPTED', recipient, amount, timestamp: new Date().toISOString(), notice: 'Deliberately insecure comparison endpoint. No funds are transferred.' });
});
export default router;
