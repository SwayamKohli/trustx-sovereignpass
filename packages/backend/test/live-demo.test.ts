import assert from 'assert/strict';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';

process.env.DB_PATH = ':memory:';
async function main() {
  const { runLiveProbes } = await import('../src/services/live-probes');
  const { db } = await import('../src/db/index');
  const { buildAuditLedger } = await import('../src/scripts/export-audit-log');
  for (let i = 0; i < 2; i++) {
    const report = await runLiveProbes();
    assert.equal(report.probes.length, 10);
    assert.deepEqual(report.probes.filter(probe => probe.status !== 'PASS'), []);
  }
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM credentials').get() as { n: number }).n, 0);
  assert.equal(buildAuditLedger().isTamperFree, true);
  const row = db.prepare('SELECT id, detail FROM audit_events LIMIT 1').get() as { id: string; detail: string };
  db.prepare('UPDATE audit_events SET detail = ? WHERE id = ?').run('tampered', row.id);
  assert.equal(buildAuditLedger().isTamperFree, false);
  db.prepare('UPDATE audit_events SET detail = ? WHERE id = ?').run(row.detail, row.id);
  assert.equal(buildAuditLedger().isTamperFree, true);

  const { default: adminRoutes } = await import('../src/routes/admin.routes');
  const { default: cryptoRoutes } = await import('../src/routes/crypto.routes');
  const app = express(); app.use(express.json(), cookieParser()); app.use('/api/admin', adminRoutes);
  app.use('/api/crypto', cryptoRoutes);
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const benchmarkResponse = await fetch(`${address}/api/crypto/pqc-benchmark`);
    assert.equal(benchmarkResponse.status, 200);
    const benchmark = await benchmarkResponse.json() as any;
    const { ml_dsa44 } = await import('@noble/post-quantum/ml-dsa.js');
    const sampleKeys = ml_dsa44.keygen();
    const sampleSignature = ml_dsa44.sign(new Uint8Array([1]), sampleKeys.secretKey);
    assert.equal(benchmark.postQuantum.publicKeyBytes, sampleKeys.publicKey.length);
    assert.equal(benchmark.postQuantum.privateKeyBytes, sampleKeys.secretKey.length);
    assert.equal(benchmark.postQuantum.signatureBytes, sampleSignature.length);
    const ratio = (sampleSignature.length / benchmark.classical.signatureBytes).toFixed(1);
    assert.equal(benchmark.analysis.signatureRatio, Number(ratio));
    assert.ok(benchmark.analysis.verdict.includes(`${ratio}x`));
    assert.equal(benchmark.iterations, 20);
    const capabilities = await (await fetch(`${address}/api/crypto/fido2-capabilities`)).json() as any;
    assert.equal(capabilities.userVerificationRequirement, 'required');
    assert.match(capabilities.scope, /not detection/);
    assert.match(capabilities.dpopProofSpecification, /not full RFC 9449/);
    assert.match(capabilities.pqcRoadmap, /no hybrid FIDO2 integration/);
    const id = crypto.randomUUID(); const session = crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare("INSERT INTO users (id, username, role, created_at) VALUES (?, ?, 'USER', ?)").run(id, id, now);
    const keys = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = keys.publicKey.export({ format: 'jwk' });
    db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, is_kiosk, ip_address, user_agent, last_active_at, dpop_public_key) VALUES (?, ?, ?, ?, 0, '127.0.0.1', 'test', ?, ?)").run(session, id, now, Date.now() + 60_000, Date.now(), JSON.stringify(jwk));
    function proof() {
      const header = Buffer.from(JSON.stringify({ typ: 'dpop+jwt', alg: 'ES256', jwk })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ htm: 'GET', htu: '/api/admin/credentials', iat: Math.floor(Date.now() / 1000), jti: crypto.randomUUID() })).toString('base64url');
      const input = `${header}.${payload}`;
      return `${input}.${crypto.sign('sha256', Buffer.from(input), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    }
    assert.equal((await fetch(`${address}/api/admin/credentials`, { headers: { 'x-admin-demo-key': 'cybercup-soc-key' } })).status, 401);
    assert.equal((await fetch(`${address}/api/admin/credentials`, { headers: { Cookie: `session_id=${session}`, DPoP: proof(), 'x-admin-demo-key': 'cybercup-soc-key' } })).status, 403);
    db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(id);
    assert.equal((await fetch(`${address}/api/admin/credentials`, { headers: { Cookie: `session_id=${session}` } })).status, 401);
    assert.equal((await fetch(`${address}/api/admin/credentials`, { headers: { Cookie: `session_id=${session}`, DPoP: proof() } })).status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  db.prepare('DELETE FROM audit_events WHERE id = ?').run(row.id);
  assert.equal(buildAuditLedger().isTamperFree, false);
  console.log('[PASS] Live route probes are repeatable; stored audit anchors detect edits/deletion; admin bypass and cookie-only access are denied.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
