import assert from 'assert/strict';
import crypto from 'crypto';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

async function main() {
  process.env.DB_PATH = ':memory:';
  const { db } = await import('../src/db/index');
  const { AgentService, PAYMENT_ACTION, amountPaise } = await import('../src/services/agent.service');
  const { serializeDevicePublicKey } = await import('../src/middleware/dpop.middleware');
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id,username,role,created_at) VALUES ('owner','owner','USER',?)").run(now);
  for (const id of ['session-a', 'session-b']) db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at,ip_address,user_agent,last_active_at) VALUES (?,'owner',?,?,'127.0.0.1','Test',?)").run(id,now,Date.now()+60_000,Date.now());
  const actor = { userId: 'owner', sessionId: 'session-a', action: PAYMENT_ACTION };
  const create = () => AgentService.createDelegationIntent({ ...actor, recipient: 'Verified vendor', maxAmount: 5000 });
  const payment = { recipient: 'Verified vendor', amount: 5000 };
  const count = () => (db.prepare('SELECT COUNT(*) AS n FROM sandbox_payments').get() as { n: number }).n;
  const intent = create(), token = AgentService.mintCapabilityToken(intent);
  assert.throws(() => AgentService.mintCapabilityToken(intent), /INVALID_INTENT/);
  assert.throws(() => AgentService.verifyCapabilityToken(token.slice(0,-1)+'!'), /INVALID_CAPABILITY_TOKEN/);
  assert.throws(() => AgentService.executeConstrainedAction(token,payment,{ ...actor, userId: 'someone-else' }), /OWNER_MISMATCH/);
  assert.throws(() => AgentService.executeConstrainedAction(token,payment,{ ...actor, sessionId: 'session-b' }), /SESSION_MISMATCH/);
  assert.throws(() => AgentService.executeConstrainedAction(token,payment,{ ...actor, action: 'DELETE /api/agent/execute-payment' }), /ACTION_MISMATCH/);
  assert.throws(() => AgentService.executeConstrainedAction(token,{ ...payment, amount:4999 },actor), /VIOLATION_AMOUNT/);
  assert.throws(() => AgentService.executeConstrainedAction(token,{ ...payment, recipient:'Attacker' },actor), /VIOLATION_RECIPIENT/);
  assert.equal(count(),0);
  assert.equal(AgentService.getIntent(intent.intentId)!.status,'AUTHORIZED');
  // Force a real database failure after consumption: the transaction must restore the permission too.
  db.exec("CREATE TRIGGER fail_test_payment BEFORE INSERT ON sandbox_payments BEGIN SELECT RAISE(ABORT,'forced ledger failure'); END");
  assert.throws(() => AgentService.executeConstrainedAction(token,payment,actor), /forced ledger failure/);
  assert.equal(AgentService.getIntent(intent.intentId)!.status,'AUTHORIZED');
  assert.equal(count(),0);
  db.exec('DROP TRIGGER fail_test_payment');
  assert.equal(AgentService.executeConstrainedAction(token,payment,actor).success,true);
  assert.equal(count(),1);
  assert.throws(() => AgentService.executeConstrainedAction(token,payment,actor), /TOKEN_REPLAY/);
  const expired = create(), expiredToken = AgentService.mintCapabilityToken(expired);
  db.prepare('UPDATE delegation_intents SET expires_at = ? WHERE intent_id = ?').run(Date.now()-1,expired.intentId);
  assert.throws(() => AgentService.executeConstrainedAction(expiredToken,payment,actor), /TOKEN_EXPIRED/);
  const revokedToken = AgentService.mintCapabilityToken(create());
  db.prepare("DELETE FROM sessions WHERE id = 'session-a'").run();
  assert.throws(() => AgentService.executeConstrainedAction(revokedToken,payment,actor), /SESSION_MISMATCH/);
  for (const value of [0,-1,NaN,Infinity,0.001,'5000',1_000_000_001]) assert.throws(() => amountPaise(value));
  assert.equal(amountPaise(12.34),1234);
  assert.equal(amountPaise(999999999.99),99999999999);
  assert.throws(() => amountPaise(999999999.991));
  for (const value of [null,{}, { kty:'EC',crv:'P-256',d:'private' }]) assert.throws(() => serializeDevicePublicKey(value));

  const directory = mkdtempSync(path.join(tmpdir(),'trustx-persistence-'));
  try {
    const keys = crypto.generateKeyPairSync('ec',{ namedCurve:'prime256v1' });
    const jwk = JSON.stringify(keys.publicKey.export({ format:'jwk' }));
    const header = Buffer.from(JSON.stringify({ typ:'dpop+jwt',alg:'ES256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ htm:'GET',htu:'/api/devices/list',iat:Math.floor(Date.now()/1000),jti:crypto.randomUUID() })).toString('base64url');
    const input = `${header}.${payload}`;
    const proof = `${input}.${crypto.sign('sha256',Buffer.from(input),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
    const script = `
      const {db}=require('./src/db/index.ts');
      const {AgentService,PAYMENT_ACTION}=require('./src/services/agent.service.ts');
      const {verifyDPoPProof}=require('./src/middleware/dpop.middleware.ts');
      const actor={userId:'restart-owner',sessionId:'restart-session',action:PAYMENT_ACTION};
      if(process.env.TEST_PHASE==='create'){
        const now=new Date().toISOString();
        db.prepare("INSERT INTO users(id,username,role,created_at) VALUES ('restart-owner','restart-owner','USER',?)").run(now);
        db.prepare("INSERT INTO sessions(id,user_id,created_at,expires_at,ip_address,user_agent,last_active_at) VALUES ('restart-session','restart-owner',?,?,'127.0.0.1','Test',?)").run(now,Date.now()+60000,Date.now());
        const token=AgentService.mintCapabilityToken(AgentService.createDelegationIntent({...actor,recipient:'Vendor',maxAmount:10}));
        console.log(JSON.stringify({token,proof:verifyDPoPProof(process.env.TEST_PROOF,process.env.TEST_JWK,'GET','/api/devices/list')}));
      }else{
        console.log(JSON.stringify({payment:AgentService.executeConstrainedAction(process.env.TEST_TOKEN,{recipient:'Vendor',amount:10},actor),proof:verifyDPoPProof(process.env.TEST_PROOF,process.env.TEST_JWK,'GET','/api/devices/list')}));
      }
      db.close();`;
    const child = (phase: string, token = '') => {
      const result = spawnSync(process.execPath,['--require','tsx/cjs','-e',script],{ cwd:path.resolve(__dirname,'..'), encoding:'utf8',env:{...process.env,DB_PATH:path.join(directory,'test.sqlite'),TEST_PHASE:phase,TEST_TOKEN:token,TEST_PROOF:proof,TEST_JWK:jwk} });
      assert.equal(result.status,0,result.stderr);
      return JSON.parse(result.stdout);
    };
    const first = child('create'); assert.equal(first.proof.valid,true);
    const restarted = child('execute',first.token);
    assert.equal(restarted.payment.success,true);
    assert.equal(restarted.proof.valid,false); assert.match(restarted.proof.error,/replay/);
  } finally { rmSync(directory,{recursive:true,force:true}); }
  console.log('[PASS] IntentLock exact binding, owner/session/action isolation, expiry, replay, failure rollback, persistence across restart; persistent device-proof replay rejection.');
}
main().catch(error => { console.error(error); process.exitCode=1; });
