import assert from 'assert/strict';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';

async function main() {
  process.env.DB_PATH = ':memory:';
  const { db } = await import('../src/db/index');
  const { default: kioskRoutes } = await import('../src/routes/kiosk.routes');
  const { default: authRoutes } = await import('../src/routes/auth.routes');
  const now = new Date().toISOString(), credentialId = crypto.randomUUID();
  db.prepare("INSERT INTO users(id,username,role,created_at) VALUES ('owner','owner','USER',?)").run(now);
  db.prepare("INSERT INTO credentials(id,user_id,public_key,device_name,status,created_at) VALUES (?,'owner',?,'Fixture','ACTIVE',?)").run(credentialId,Buffer.from('unused-fixture-public-key'),now);
  const key = crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'jwk'});
  const app = express();app.use(express.json(),cookieParser());app.use('/api/kiosk',kioskRoutes);app.use('/api/auth',authRoutes);
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
    async function post(route: string, body: unknown) {
      const response = await fetch(`${base}/api/kiosk/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
    }
    assert.equal((await post('qr-challenge',{})).status,400);
    const challenge = (await post('qr-challenge',{dpopPublicKey:key})).data;
    const body = {kioskSessionId:challenge.kioskSessionId,kioskClientSecret:challenge.kioskClientSecret};
    assert.equal((await post('qr-poll',{...body,kioskClientSecret:'wrong'})).status,403);
    // Seed an already-approved fixture; actual passkey approval is covered by the browser integration test.
    db.prepare("UPDATE kiosk_authorizations SET status = 'AUTHORIZED', user_id = 'owner', credential_id = ? WHERE kiosk_session_id = ?").run(credentialId,body.kioskSessionId);
    db.prepare("UPDATE credentials SET status = 'REVOKED' WHERE id = ?").run(credentialId);
    const revoked = await post('qr-poll',body);
    assert.equal(revoked.status,403);assert.equal(revoked.data.error,'KIOSK_APPROVAL_REVOKED');assert.equal(revoked.cookie,null);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as {n:number}).n,0);
    db.prepare("UPDATE credentials SET status = 'ACTIVE' WHERE id = ?").run(credentialId);
    const claim = await post('qr-poll',body);
    assert.equal(claim.data.status,'AUTHORIZED');assert.ok(claim.cookie);
    const session = db.prepare('SELECT credential_id,is_kiosk,dpop_public_key FROM sessions').get() as any;
    assert.equal(session.credential_id,credentialId);assert.equal(session.is_kiosk,1);assert.ok(session.dpop_public_key);
    const replay = await post('qr-poll',body);
    assert.equal(replay.data.status,'CLAIMED');assert.equal(replay.cookie,null);
    db.prepare("UPDATE credentials SET status = 'REVOKED' WHERE id = ?").run(credentialId);
    const denied = await fetch(`${base}/api/auth/session`,{headers:{Cookie:claim.cookie!.split(';')[0]}});
    assert.equal(denied.status,401);assert.match((await denied.json()).error,/credential has been revoked/);
    console.log('[PASS] Kiosk mandatory key, private polling secret, revoked approval denial, single claim and approving-credential session revocation.');
  } finally {await new Promise<void>(resolve => server.close(() => resolve()));}
}
main().catch(error => {console.error(error);process.exitCode=1;});
