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
  if (req.body.username !== 'alice_dummy' || req.body.password !== 'DemoPassword123!') return res.status(400).json({ error: 'Only the displayed dummy credentials are accepted. Never submit real credentials.' });
  const timestamp = log('DUMMY_CREDENTIAL_CAPTURED', { username: 'alice_dummy', password: 'DemoPassword123!', source: 'Deliberately vulnerable comparison form' });
  return res.json({ success: true, username: 'alice_dummy', password: 'DemoPassword123!', timestamp });
});
app.post('/api/phish/legacy-session-replay', (req, res) => {
  if (req.body.token !== 'DEMO-LEGACY-SESSION') return res.status(400).json({ error: 'Use only the published dummy session token' });
  const timestamp = log('LEGACY_DEMO_SESSION_ACCEPTED', { notice: 'Toy bearer-only endpoint accepted a published dummy token; no bank session was used.' });
  return res.json({ status: 'ACCEPTED', timestamp, notice: 'Deliberately vulnerable toy session. No bank account accessed.' });
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
    const timestamp = log('PHISHING_ORIGIN_REJECTED', { source: 'Crafted assertion verifier probe', actualOrigin: config.attackerOrigin, expectedOrigin: config.bankOrigin });
    return res.status(401).json({ code: 'ORIGIN_MISMATCH', actualOrigin: config.attackerOrigin, expectedOrigin: config.bankOrigin, timestamp, scope: 'Actual SimpleWebAuthn origin validation of a crafted assertion, not a browser-signed credential or intercepted login.' });
  }
});
app.get('/api/phish/feed', (_req, res) => {
  const rows = db.prepare("SELECT id, type, detail, timestamp FROM audit_events WHERE type IN ('DUMMY_CREDENTIAL_CAPTURED', 'LEGACY_DEMO_SESSION_ACCEPTED', 'COOKIE_REPLAY_DEMONSTRATION', 'PHISHING_ORIGIN_REJECTED') ORDER BY rowid DESC LIMIT 20").all() as { id: string; type: string; detail: string; timestamp: string }[];
  return res.json({ events: rows.map(row => ({ id: row.id, type: row.type, timestamp: row.timestamp, detail: JSON.parse(row.detail) })) });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown attacker-lab endpoint' }));
app.get('/', (_req, res) => res.redirect('/phishing'));
app.use(createViteReverseProxy());
const certificates = loadSslCertificates();
const server = certificates ? https.createServer(certificates, app) : http.createServer(app);
server.listen(port, '127.0.0.1', () => console.log(`Attacker lab ready: ${demoOrigins().attackerOrigin}/phishing`));
export default app;
