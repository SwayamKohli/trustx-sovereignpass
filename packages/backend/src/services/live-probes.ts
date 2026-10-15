import assert from 'assert/strict';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import argon2 from 'argon2';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { db } from '../db/index';
import authRoutes from '../routes/auth.routes';
import deviceRoutes from '../routes/devices.routes';
import recoveryRoutes from '../routes/recovery.routes';
import agentRoutes from '../routes/agent.routes';

export type LiveReport = { runId: string; timestamp: string; scope: string; probes: { id: string; name: string; status: 'PASS' | 'FAIL' | 'SKIPPED'; detail: string; observations?: { path: string; httpStatus: number; reason: string; timestamp: string }[] }[] };

// Exercise the production routers over HTTP with isolated fixture accounts, never a citizen's credentials.
export async function runLiveProbes(selectedId?: string): Promise<LiveReport> {
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/api/auth', authRoutes); app.use('/api/devices', deviceRoutes);
  app.use('/api/recovery', recoveryRoutes); app.use('/api/agent', agentRoutes);
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const userId = `probe_${crypto.randomUUID()}`;
  const credentialId = crypto.randomBytes(32).toString('base64url');
  const backupId = crypto.randomBytes(32).toString('base64url');
  const now = new Date().toISOString();
  const device = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const authenticator = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = authenticator.publicKey.export({ format: 'jwk' });
  const cose = isoCBOR.encode(new Map<number, number | Uint8Array>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, 'base64url')], [-3, Buffer.from(jwk.y!, 'base64url')]]));
  const publicDeviceKey = device.publicKey.export({ format: 'jwk' });
  let counter = 0;
  let cookie = '';
  let observations: NonNullable<LiveReport['probes'][number]['observations']> = [];
  const report: LiveReport = { runId: crypto.randomUUID(), timestamp: now, scope: 'Live HTTP checks of production routers using isolated software-authenticator fixtures; not a physical-key or reverse-proxy test.', probes: [] };
  function assertion(challenge: string, origin = base) {
    const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
    const authData = Buffer.alloc(37);
    crypto.createHash('sha256').update('127.0.0.1').digest().copy(authData);
    authData[32] = 5; authData.writeUInt32BE(++counter, 33);
    const signature = crypto.sign('sha256', Buffer.concat([authData, crypto.createHash('sha256').update(client).digest()]), authenticator.privateKey);
    return { id: credentialId, rawId: credentialId, type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: client.toString('base64url'), authenticatorData: authData.toString('base64url'), signature: signature.toString('base64url'), userHandle: null } };
  }
  function proof(method: string, path: string) {
    const header = Buffer.from(JSON.stringify({ typ: 'dpop+jwt', alg: 'ES256', jwk: publicDeviceKey })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ htm: method, htu: path, iat: Math.floor(Date.now() / 1000), jti: crypto.randomUUID() })).toString('base64url');
    const input = `${header}.${payload}`;
    return `${input}.${crypto.sign('sha256', Buffer.from(input), { key: device.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  }
  async function call(path: string, body?: unknown, authenticated = false, extra: Record<string, string> = {}) {
    const method = body === undefined ? 'GET' : 'POST';
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
    if (authenticated) { headers.Cookie = cookie; headers.DPoP = proof(method, path); }
    const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    const data = await response.json();
    observations.push({ path, httpStatus: response.status, reason: data.reason || data.code || data.error || (response.ok ? 'REQUEST_ACCEPTED' : 'REQUEST_REJECTED'), timestamp: new Date().toISOString() });
    return { response, data, status: response.status };
  }
  async function check(id: string, name: string, run: () => Promise<string>) {
    if (selectedId && selectedId !== id && id !== '2') return;
    observations = [];
    let result: LiveReport['probes'][number];
    try { result = { id, name, status: 'PASS', detail: await run(), observations }; }
    catch (error) { result = { id, name, status: 'FAIL', detail: error instanceof Error ? error.message : 'Probe failed', observations }; }
    if (!selectedId || selectedId === id) {
      report.probes.push(result);
      db.prepare('INSERT INTO audit_events (id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), 'ATTACK_PROBE_COMPLETED', userId, JSON.stringify({ runId: report.runId, ...result }), new Date().toISOString());
    }
  }
  try {
    db.prepare("INSERT INTO users (id, username, role, created_at) VALUES (?, ?, 'USER', ?)").run(userId, userId, now);
    for (const id of [credentialId, backupId]) db.prepare("INSERT INTO credentials (id, user_id, public_key, counter, device_name, status, created_at, last_used_at) VALUES (?, ?, ?, 0, 'Isolated probe credential', 'ACTIVE', ?, ?)").run(id, userId, Buffer.from(cose), now, now);
    await check('1', 'Look-alike origin rejection', async () => {
      const { data } = await call('/api/auth/login-challenge', { username: userId });
      const result = await call('/api/auth/login-verify', { username: userId, assertionResponse: assertion(data.challenge, 'https://b4nk-secure.local:3001'), dpopPublicKey: publicDeviceKey });
      assert.equal(result.status, 401); assert.equal(result.response.headers.get('set-cookie'), null);
      assert.ok(db.prepare("SELECT id FROM audit_events WHERE user_id = ? AND type = 'PHISHING_ORIGIN_REJECTED'").get(userId));
      return 'HTTP 401; no session cookie; origin-rejection audit event confirmed.';
    });
    await check('2', 'Authentication challenge replay', async () => {
      const { data } = await call('/api/auth/login-challenge', { username: userId });
      const body = { username: userId, assertionResponse: assertion(data.challenge), dpopPublicKey: publicDeviceKey };
      const first = await call('/api/auth/login-verify', body);
      assert.equal(first.status, 200); cookie = first.response.headers.get('set-cookie')!.split(';')[0];
      const second = await call('/api/auth/login-verify', body);
      assert.equal(second.status, 401); assert.equal(second.response.headers.get('set-cookie'), null);
      return 'Positive control: login HTTP 200. Replayed assertion: HTTP 401, no new cookie.';
    });
    await check('3', 'Consumed recovery code rejection', async () => {
      const code = crypto.randomBytes(12).toString('hex').toUpperCase();
      db.prepare('INSERT INTO recovery_codes (id, user_id, code_hash, used, created_at) VALUES (?, ?, ?, 1, ?)').run(crypto.randomUUID(), userId, await argon2.hash(code), now);
      const result = await call('/api/recovery/verify-code', { username: userId, recoveryCode: code });
      assert.equal(result.status, 400);
      return 'A seeded, already-consumed code was submitted to the actual recovery endpoint: HTTP 400.';
    });
    await check('4', 'Revoked credential rejection', async () => {
      db.prepare("UPDATE credentials SET status = 'REVOKED' WHERE id = ?").run(credentialId);
      try {
        const { data } = await call('/api/auth/login-challenge', { username: userId });
        const result = await call('/api/auth/login-verify', { username: userId, assertionResponse: assertion(data.challenge), dpopPublicKey: publicDeviceKey });
        assert.equal(result.status, 401);
        return 'A fresh assertion using a revoked fixture credential was rejected: HTTP 401.';
      } finally { db.prepare("UPDATE credentials SET status = 'ACTIVE' WHERE id = ?").run(credentialId); }
    });
    await check('5', 'Terminated session rejection', async () => {
      const id = `probe_terminated_${crypto.randomUUID()}`;
      db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, is_kiosk, ip_address, user_agent, last_active_at) VALUES (?, ?, ?, ?, 0, '127.0.0.1', 'Probe', ?)").run(id, userId, now, Date.now() + 60_000, Date.now());
      db.prepare('UPDATE sessions SET dpop_public_key = ? WHERE id = ?').run(JSON.stringify(publicDeviceKey), id);
      assert.equal((await call('/api/auth/session', undefined, false, { Cookie: `session_id=${id}`, DPoP: proof('GET', '/api/auth/session') })).status, 200);
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      assert.equal((await call('/api/auth/session', undefined, false, { Cookie: `session_id=${id}` })).status, 401);
      return 'Session positive control: HTTP 200. Same cookie after server-side deletion: HTTP 401.';
    });
    await check('6', 'Capability parameter tampering', async () => {
      const intent = await call('/api/agent/delegate-challenge', { action: 'POST /api/agent/execute-payment', recipient: 'Probe Utility', maxAmount: 10 }, true);
      assert.equal(intent.status, 200);
      const verified = await call('/api/agent/delegate-verify', { intentId: intent.data.intentId, assertionResponse: assertion(intent.data.authenticationOptions.challenge) }, true);
      assert.equal(verified.status, 200);
      const capabilityToken = verified.data.capabilityToken;
      assert.equal((await call('/api/agent/execute-payment', { capabilityToken, paymentDetails: { recipient: 'Probe Attacker', amount: 20 } }, true)).status, 403);
      const count = () => (db.prepare('SELECT COUNT(*) AS n FROM sandbox_payments WHERE user_id = ?').get(userId) as { n: number }).n;
      assert.equal(count(), 0);
      assert.equal((await call('/api/agent/execute-payment', { capabilityToken, paymentDetails: { recipient: 'Probe Utility', amount: 5 } }, true)).status, 403);
      assert.equal(count(), 0);
      const body = { capabilityToken, paymentDetails: { recipient: 'Probe Utility', amount: 10 } };
      const results = await Promise.all([call('/api/agent/execute-payment', body, true), call('/api/agent/execute-payment', body, true)]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 403]);
      assert.equal(count(), 1);
      return 'Altered recipient and altered amount: HTTP 403, unchanged ledger. Concurrent exact requests: one HTTP 200, one HTTP 403; exactly one persisted payment.';
    });
    await check('7', 'Stolen cookie and DPoP replay', async () => {
      const missing = await call('/api/devices/list', undefined, false, { Cookie: cookie });
      assert.equal(missing.status, 401); assert.equal(missing.data.code, 'DPOP_PROOF_REQUIRED');
      const headers = { Cookie: cookie, DPoP: proof('GET', '/api/devices/list') };
      assert.equal((await call('/api/devices/list', undefined, false, headers)).status, 200);
      assert.equal((await call('/api/devices/list', undefined, false, headers)).status, 401);
      return 'Cookie-only request: HTTP 401 DPOP_PROOF_REQUIRED. Fresh proof: HTTP 200. Replayed proof: HTTP 401.';
    });
    await check('8', 'Step-up enforcement and token replay', async () => {
      const body = { credentialId: backupId };
      const denied = await call('/api/devices/revoke', body, true);
      assert.equal(denied.status, 403); assert.equal(denied.data.error, 'STEP_UP_REQUIRED');
      const challenge = await call('/api/auth/step-up-challenge', { method: 'POST', route: '/api/devices/revoke', body }, true);
      assert.equal(challenge.status, 200);
      const verified = await call('/api/auth/step-up-verify', { intentId: challenge.data.intentId, assertionResponse: assertion(challenge.data.stepUpOptions.challenge) }, true);
      assert.equal(verified.status, 200);
      const headers = { 'X-Step-Up-Token': verified.data.stepUpToken };
      assert.equal((await call('/api/devices/revoke', { credentialId }, true, headers)).status, 403);
      assert.equal((await call('/api/devices/revoke', body, true, headers)).status, 200);
      assert.equal((await call('/api/devices/revoke', body, true, headers)).status, 403);
      return 'No step-up: HTTP 403. Altered body: HTTP 403. Valid single-use token: HTTP 200. Reuse: HTTP 403.';
    });
    await check('9', 'Unauthorized device enrollment', async () => {
      const result = await call('/api/devices/register-challenge', {}, true);
      assert.equal(result.status, 403); assert.equal(result.data.error, 'STEP_UP_REQUIRED');
      const fabricated = await call('/api/devices/register-verify', { attestationResponse: { id: 'fabricated' }, deviceName: 'Unauthorized' }, true);
      assert.equal(fabricated.status, 400);
      assert.equal((db.prepare('SELECT COUNT(*) AS n FROM credentials WHERE user_id = ?').get(userId) as { n: number }).n, 2);
      return 'Authenticated session without fresh approval: HTTP 403. Fabricated enrollment: HTTP 400; no new credential persisted.';
    });
    await check('10', 'Expired session rejection', async () => {
      const id = `probe_expired_${crypto.randomUUID()}`;
      db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at,is_kiosk,ip_address,user_agent,last_active_at) VALUES (?,?,?,?,0,'127.0.0.1','Probe',?)").run(id,userId,now,Date.now()-1,Date.now());
      const result = await call('/api/auth/session', undefined, false, { Cookie: `session_id=${id}` });
      assert.equal(result.status, 401);
      return 'Actually expired session submitted to production session route: HTTP 401.';
    });
  } finally {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM pending_recoveries WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM credentials WHERE user_id = ?').run(userId);
    // Retain the fixture user referenced by immutable audit evidence; no active credentials or sessions remain.
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  report.timestamp = new Date().toISOString();
  return report;
}
