import { Router } from 'express';
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { requireSession } from '../middleware/session.middleware';
import { requireStepUpAuthorization, consumeStepUpAuthorization } from '../middleware/stepup.middleware';
import { amountPaise } from '../services/agent.service';
import deviceRoutes from './devices.routes';
import { db } from '../db/index';

const router = Router();

router.post('/cookie-replay', requireSession, async (req, res) => {
  const app = express(); app.use(cookieParser()); app.use('/api/devices', deviceRoutes);
  const server = http.createServer(app);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const result = await fetch(`http://127.0.0.1:${port}/api/devices/list`, { headers: { Cookie: `session_id=${req.session!.id}` }, signal: AbortSignal.timeout(5000) });
    const body = await result.json();
    const outcome = { status: result.status, code: body.code ?? 'NO_DEVICE_PROOF_ENFORCEMENT', timestamp: new Date().toISOString() };
    db.prepare('INSERT INTO audit_events (id, type, user_id, detail, timestamp) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), 'COOKIE_REPLAY_DEMONSTRATION', req.user!.id, JSON.stringify(outcome), outcome.timestamp);
    return res.json(outcome);
  } catch { return res.status(503).json({ error: 'REPLAY_CHECK_UNAVAILABLE' }); }
  finally { if (server.listening) server.close(); }
});

router.post('/transfer', requireSession, (req, res, next) => {
  try { amountPaise(req.body.amount); } catch { return res.status(400).json({ error: 'INVALID_SANDBOX_AMOUNT' }); }
  if (typeof req.body.recipient !== 'string' || !req.body.recipient.trim() || req.body.recipient.length > 100) return res.status(400).json({ error: 'INVALID_RECIPIENT' });
  const amount = req.body.amount;
  if (amount >= 10000) {
    return requireStepUpAuthorization({ alwaysEnforce: true })(req, res, next);
  }
  return next();
}, (req, res) => {
  const amount = req.body.amount;
  const recipient = req.body.recipient.trim();
  const txId = `TXN-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const stepUpUsed = amount >= 10000;

  try { db.transaction(() => {
    const spent = (db.prepare('SELECT COALESCE(SUM(amount_paise),0) AS total FROM sandbox_payments WHERE user_id = ?').get(req.user!.id) as { total: number }).total;
    if (spent + amountPaise(amount) > 12_500_000) throw new Error('SANDBOX_INSUFFICIENT_BALANCE');
    consumeStepUpAuthorization(req);
    db.prepare("INSERT INTO sandbox_payments (id,user_id,recipient,amount_paise,source,created_at) VALUES (?,?,?,?,'BANK',?)").run(txId, req.user!.id, recipient, amountPaise(amount), timestamp);
    db.prepare('INSERT INTO audit_events (id, type, user_id, detail, timestamp) VALUES (?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'BANK_TRANSFER_COMPLETED',
    req.user!.id,
    JSON.stringify({
      txId,
      amount,
      recipient,
      stepUpUsed,
      currency: 'INR',
      method: 'Sovereign Digital Rupee / IMPS',
      timestamp,
    }),
    timestamp
    );
  }).immediate(); } catch { return res.status(409).json({ error: 'SANDBOX_TRANSFER_REJECTED' }); }

  return res.json({
    success: true,
    txId,
    amount,
    recipient,
    stepUpUsed,
    timestamp,
    message: stepUpUsed
      ? `Passkey step-up verified. Sandbox INR ${amount.toLocaleString('en-IN')} recorded for ${recipient}. No real funds moved.`
      : `Sandbox INR ${amount.toLocaleString('en-IN')} recorded for ${recipient}. No real funds moved.`,
  });
});

export default router;
