// Local attacker comparison service. Only published dummy fixtures are accepted.
import express from 'express';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import cors from 'cors';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createViteReverseProxy, demoOrigins, loadSslCertificates } from './config/server.config';
import { db } from './db/index';

const app = express();
const port = Number(process.env.PHISH_PORT || 3001);
app.use(cors({ origin: demoOrigins().bankOrigin }));
app.use(express.json({ limit: '4kb' }));
app.use((_req, res, next) => { res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
app.get('/api/phish/health', (_req, res) => res.json({ status: 'READY', ...demoOrigins() }));
app.get('/api/demo/config', (_req, res) => res.json(demoOrigins()));
function log(type: string, detail: unknown) {
  const timestamp = new Date().toISOString();
  db.prepare('INSERT INTO audit_events (id, type, user_id, detail, timestamp) VALUES (?, ?, NULL, ?, ?)').run(crypto.randomUUID(), type, JSON.stringify(detail), timestamp);
  return timestamp;
}
app.post('/api/phish/harvest', (req, res) => {
  const username = String(req.body.username || 'alice').trim().slice(0, 50);
  const password = String(req.body.password || 'BankPass123!').trim().slice(0, 100);
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required for interception test.' });
  const timestamp = log('CREDENTIAL_HARVESTED', {
    username,
    capturedPassword: password.replace(/./g, '*'),
    rawLength: password.length,
    vector: 'Phishing Form Interception (Plaintext Shared Secret Leakage)',
    attackerDomain: demoOrigins().attackerOrigin,
  });
  return res.json({ success: true, username, password, timestamp });
});
app.post('/api/phish/legacy-session-replay', (_req, res) => {
  const timestamp = log('LEGACY_SESSION_REPLAY_ACCEPTED', {
    notice: 'Vulnerable bearer-only endpoint accepted token without DPoP device proof.',
    attackerDomain: demoOrigins().attackerOrigin,
    risk: 'CRITICAL - Session hijack successful via stolen cookie/bearer token.',
  });
  return res.json({ status: 'ACCEPTED', timestamp, notice: 'Vulnerable bearer token accepted. Attacker impersonation successful.' });
});
app.post('/api/phish/origin-probe', async (_req, res) => {
  const config = demoOrigins();
  const challenge = crypto.randomBytes(32).toString('base64url');
  const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: config.attackerOrigin, crossOrigin: false })).toString('base64url');
  try {
    await verifyAuthenticationResponse({
      response: { id: 'crafted-probe', rawId: 'crafted-probe', type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON, authenticatorData: 'AAAAAA', signature: 'AAAAAA' } },
      expectedChallenge: challenge, expectedOrigin: config.bankOrigin, expectedRPID: config.rpId,
      credential: { id: 'crafted-probe', publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
    });
    return res.status(500).json({ error: 'Origin rejection was not observed' });
  } catch (error) {
    if (!(error instanceof Error) || !/origin/i.test(error.message)) return res.status(500).json({ error: 'Probe failed before confirming origin rejection' });
    const timestamp = log('PHISHING_ORIGIN_REJECTED', {
      source: 'FIDO2 Origin Verification Gate',
      actualOrigin: config.attackerOrigin,
      expectedOrigin: config.bankOrigin,
      enforcement: 'SimpleWebAuthn / W3C WebAuthn Spec Layer 2 Rejection',
    });
    return res.status(401).json({
      code: 'ORIGIN_MISMATCH',
      actualOrigin: config.attackerOrigin,
      expectedOrigin: config.bankOrigin,
      timestamp,
      scope: 'Actual SimpleWebAuthn origin validation: relayed assertion from phishing origin was cryptographically rejected.',
    });
  }
});
app.get('/api/phish/feed', (_req, res) => {
  const rows = db.prepare("SELECT id, type, detail, timestamp FROM audit_events WHERE type IN ('CREDENTIAL_HARVESTED', 'DUMMY_CREDENTIAL_CAPTURED', 'LEGACY_SESSION_REPLAY_ACCEPTED', 'LEGACY_DEMO_SESSION_ACCEPTED', 'COOKIE_REPLAY_DEMONSTRATION', 'PHISHING_ORIGIN_REJECTED') ORDER BY rowid DESC LIMIT 20").all() as { id: string; type: string; detail: string; timestamp: string }[];
  return res.json({ events: rows.map(row => ({ id: row.id, type: row.type, timestamp: row.timestamp, detail: JSON.parse(row.detail) })) });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown attacker-lab endpoint' }));
app.get('/', (_req, res) => res.redirect('/phishing'));
app.use(createViteReverseProxy());
const certificates = loadSslCertificates();
const server = certificates ? https.createServer(certificates, app) : http.createServer(app);
server.listen(port, '127.0.0.1', () => console.log(`Attacker lab ready: ${demoOrigins().attackerOrigin}/phishing`));
export default app;
