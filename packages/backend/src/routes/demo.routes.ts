import { Router } from 'express';
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { requireSession } from '../middleware/session.middleware';
import { requireStepUpAuthorization } from '../middleware/stepup.middleware';
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
  const amount = Number(req.body.amount || 0);
  if (amount >= 10000) {
    return requireStepUpAuthorization({ alwaysEnforce: true })(req, res, next);
  }
  return next();
}, (req, res) => {
  const amount = Number(req.body.amount || 0);
  const recipient = String(req.body.recipient || 'Tata Power / Electricity Board').trim();
  const txId = `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const stepUpUsed = amount >= 10000;

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

  return res.json({
    success: true,
    txId,
    amount,
    recipient,
    stepUpUsed,
    timestamp,
    message: stepUpUsed
      ? `Biometric step-up re-authentication verified. ₹${amount.toLocaleString('en-IN')} transferred to ${recipient}.`
      : `₹${amount.toLocaleString('en-IN')} transferred to ${recipient}. Low Risk evaluated; no step-up required.`,
  });
});

export default router;
