import assert from 'assert/strict';
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';

async function main() {
  process.env.DB_PATH = ':memory:';
  const { db } = await import('../src/db/index');
  const { default: demoRoutes } = await import('../src/routes/demo.routes');
  const { default: agentRoutes } = await import('../src/routes/agent.routes');
  const { RiskService } = await import('../src/services/risk.service');
  const { serializeDevicePublicKey } = await import('../src/middleware/dpop.middleware');
  const now = new Date().toISOString(), sessionId = crypto.randomUUID();
  const keys = crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const jwk = keys.publicKey.export({format:'jwk'});
  db.prepare("INSERT INTO users(id,username,role,created_at) VALUES ('owner','owner','USER',?)").run(now);
  db.prepare("INSERT INTO sessions(id,user_id,created_at,expires_at,ip_address,user_agent,last_active_at,dpop_public_key) VALUES (?,'owner',?,?,'127.0.0.1','Test',?,?)").run(sessionId,now,Date.now()+60_000,Date.now(),serializeDevicePublicKey(jwk));
  const app = express(); app.use(express.json(),cookieParser()); app.use('/api/demo',demoRoutes); app.use('/api/agent',agentRoutes);
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
    async function call(body?: unknown, token?: string) {
      const route = body === undefined ? '/api/agent/state' : '/api/demo/transfer';
      const method = body === undefined ? 'GET' : 'POST';
      const header = Buffer.from(JSON.stringify({typ:'dpop+jwt',alg:'ES256',jwk})).toString('base64url');
      const payload = Buffer.from(JSON.stringify({htm:method,htu:route,iat:Math.floor(Date.now()/1000),jti:crypto.randomUUID()})).toString('base64url');
      const input = `${header}.${payload}`, proof = `${input}.${crypto.sign('sha256',Buffer.from(input),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
      const response = await fetch(`${base}${route}`,{method,headers:{Cookie:`session_id=${sessionId}`,DPoP:proof,'Content-Type':'application/json',...(token?{'X-Step-Up-Token':token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      return {status:response.status,data:await response.json()};
    }
    const count = () => (db.prepare('SELECT COUNT(*) AS n FROM sandbox_payments').get() as {n:number}).n;
    for (const amount of [0,-10,null,'50000',0.001,1_000_000_001]) assert.equal((await call({recipient:'Vendor',amount})).status,400);
    assert.equal((await call({recipient:'',amount:450})).status,400);
    assert.equal(count(),0);
    assert.equal((await call({recipient:'Vendor',amount:450})).status,200);
    assert.equal((await call()).data.balancePaise,12_455_000);
    const body = {recipient:'Vendor',amount:50000};
    assert.equal((await call(body)).data.error,'STEP_UP_REQUIRED');
    function tokenFor(payload: unknown) {
      const token = crypto.randomUUID();
      db.prepare("INSERT INTO step_up_authorizations(token,user_id,session_id,http_method,route,intent_hash,expires_at,consumed) VALUES (?,'owner',?,'POST','/api/demo/transfer',?,?,0)").run(token,sessionId,RiskService.computeIntentHash('POST','/api/demo/transfer',payload),Date.now()+60_000);
      return token;
    }
    const tooMuch = {recipient:'Vendor',amount:130000}, failedToken = tokenFor(tooMuch);
    assert.equal((await call(tooMuch,failedToken)).status,409);
    assert.equal((db.prepare('SELECT consumed FROM step_up_authorizations WHERE token = ?').get(failedToken) as {consumed:number}).consumed,0);
    assert.equal(count(),1);
    const token = tokenFor(body);
    assert.equal((await call({...body,recipient:'Changed'},token)).status,403);
    assert.equal((await call(body,token)).status,200);
    assert.equal((await call(body,token)).status,403);
    assert.equal(count(),2);
    assert.equal((await call()).data.balancePaise,7_455_000);
    db.prepare('UPDATE sessions SET dpop_public_key = NULL WHERE id = ?').run(sessionId);
    assert.equal((await call()).data.code,'DEVICE_BINDING_REQUIRED');
    console.log('[PASS] Bank input validation, persisted balance, exact step-up binding, insufficient-funds rollback, replay and unbound-session downgrade rejection.');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
main().catch(error => {console.error(error);process.exitCode=1;});
