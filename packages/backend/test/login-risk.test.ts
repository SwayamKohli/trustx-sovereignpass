import assert from 'assert/strict';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import { isoCBOR } from '@simplewebauthn/server/helpers';

async function main() {
  process.env.DB_PATH=':memory:';
  const {db}=await import('../src/db/index');
  const {default:authRoutes}=await import('../src/routes/auth.routes');
  const {default:adminRoutes}=await import('../src/routes/admin.routes');
  const {default:recoveryRoutes}=await import('../src/routes/recovery.routes');
  const userId=crypto.randomUUID(),credentialId=crypto.randomBytes(32).toString('base64url');
  const authenticator=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),device=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const key=authenticator.publicKey.export({format:'jwk'}),deviceKey=device.publicKey.export({format:'jwk'});
  const cose=isoCBOR.encode(new Map<number,number|Uint8Array>([[1,2],[3,-7],[-1,1],[-2,Buffer.from(key.x!,'base64url')],[-3,Buffer.from(key.y!,'base64url')]]));
  db.prepare("INSERT INTO users(id,username,role,created_at) VALUES (?,'risk-user','USER',?)").run(userId,new Date().toISOString());
  db.prepare("INSERT INTO credentials(id,user_id,public_key,device_name,status,created_at) VALUES (?,?,?,'Fixture','ACTIVE',?)").run(credentialId,userId,Buffer.from(cose),new Date().toISOString());
  const app=express();app.use(express.json(),cookieParser());app.use('/api/auth',authRoutes);app.use('/api/admin',adminRoutes);app.use('/api/recovery',recoveryRoutes);
  const server=http.createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  let counter=0,cookie='';
  function assertion(challenge:string){
    const client=Buffer.from(JSON.stringify({type:'webauthn.get',challenge,origin:base,crossOrigin:false}));
    const data=Buffer.alloc(37);crypto.createHash('sha256').update('127.0.0.1').digest().copy(data);data[32]=5;data.writeUInt32BE(++counter,33);
    return {id:credentialId,rawId:credentialId,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:client.toString('base64url'),authenticatorData:data.toString('base64url'),signature:crypto.sign('sha256',Buffer.concat([data,crypto.createHash('sha256').update(client).digest()]),authenticator.privateKey).toString('base64url'),userHandle:null}};
  }
  async function call(route:string,body:unknown,ua='Known browser',authenticated=false,extra:Record<string,string>={}){
    const headers:Record<string,string>={'Content-Type':'application/json','User-Agent':ua,...extra};
    if(authenticated){
      headers.Cookie=cookie;
      const header=Buffer.from(JSON.stringify({typ:'dpop+jwt',alg:'ES256',jwk:deviceKey})).toString('base64url');
      const payload=Buffer.from(JSON.stringify({htm:'POST',htu:route,iat:Math.floor(Date.now()/1000),jti:crypto.randomUUID()})).toString('base64url');
      const input=`${header}.${payload}`;headers.DPoP=`${input}.${crypto.sign('sha256',Buffer.from(input),{key:device.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
    }
    const response=await fetch(base+route,{method:'POST',headers,body:JSON.stringify(body)});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
  }
  async function login(ua='Known browser'){
    const challenge=await call('/api/auth/login-challenge',{username:'risk-user'},ua);
    return call('/api/auth/login-verify',{username:'risk-user',assertionResponse:assertion(challenge.data.challenge),dpopPublicKey:deviceKey},ua);
  }
  const sessions=()=>(db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as {n:number}).n;
  try{
    const keyOptions=await call('/api/auth/register-challenge',{username:'key-candidate',authenticator:'security-key'});
    assert.equal(keyOptions.data.authenticatorSelection.authenticatorAttachment,'cross-platform');
    assert.equal(keyOptions.data.authenticatorSelection.userVerification,'required');assert.deepEqual(keyOptions.data.hints,['security-key']);
    const normal=await login();assert.equal(normal.status,200);assert.equal(normal.data.loginRisk.extraCheckRequired,false);cookie=normal.cookie!.split(';')[0];assert.equal(sessions(),1);
    const changed=await login('Changed browser');assert.equal(changed.status,403);assert.equal(changed.data.error,'LOGIN_EXTRA_CHECK_REQUIRED');assert.deepEqual(changed.data.risk.reasons,['BROWSER_CONTEXT_CHANGED']);assert.equal(changed.cookie,null);assert.equal(sessions(),1);
    const wrongContext=await call('/api/auth/login-extra-verify',{pendingId:changed.data.pendingId,assertionResponse:assertion(changed.data.authenticationOptions.challenge)},'Different browser');assert.equal(wrongContext.status,403);assert.equal(wrongContext.cookie,null);
    const pending=await login('Changed browser');
    const approvedBody={pendingId:pending.data.pendingId,assertionResponse:assertion(pending.data.authenticationOptions.challenge)};
    const approved=await call('/api/auth/login-extra-verify',approvedBody,'Changed browser');assert.equal(approved.status,200);assert.equal(approved.data.loginRisk.extraCheckCompleted,true);assert.equal(sessions(),2);
    assert.equal((await call('/api/auth/login-extra-verify',approvedBody,'Changed browser')).status,401);
    assert.equal((await login('Changed browser')).status,200);
    const forged=await login('Unrecognized browser');
    const invalid=assertion(forged.data.authenticationOptions.challenge);invalid.response.signature='AAAA';
    assert.equal((await call('/api/auth/login-extra-verify',{pendingId:forged.data.pendingId,assertionResponse:invalid},'Unrecognized browser')).status,401);
    const expiring=await login('Unrecognized browser'),originalNow=Date.now;
    try{Date.now=()=>originalNow()+61000;assert.equal((await call('/api/auth/login-extra-verify',{pendingId:expiring.data.pendingId,assertionResponse:assertion(expiring.data.authenticationOptions.challenge)},'Unrecognized browser')).status,401);}finally{Date.now=originalNow;}
    db.prepare("UPDATE known_login_contexts SET ip_address='198.51.100.44' WHERE user_id=?").run(userId);
    const network=await login('Changed browser');assert.equal(network.status,403);assert.ok(network.data.risk.reasons.includes('NETWORK_ADDRESS_CHANGED'));assert.equal(network.cookie,null);
    db.prepare("UPDATE credentials SET status='REVOKED' WHERE id=?").run(credentialId);
    assert.equal((await call('/api/auth/login-extra-verify',{pendingId:network.data.pendingId,assertionResponse:assertion(network.data.authenticationOptions.challenge)},'Changed browser')).status,401);
    db.prepare("UPDATE credentials SET status='ACTIVE' WHERE id=?").run(credentialId);
    assert.equal((await call('/api/admin/login-history',{},'Known browser',true)).status,403);
    db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(userId);
    const history=await call('/api/admin/login-history',{username:'risk-user',page:0},'Known browser',true);
    assert.equal(history.status,200);assert.ok(history.data.entries.some((e:any)=>e.outcome==='EXTRA_CHECK_REQUIRED'));assert.ok(history.data.entries.some((e:any)=>e.risk?.extraCheckCompleted));
    assert.equal((await call('/api/admin/login-history',{username:'not-this-account',page:0},'Known browser',true)).data.total,0);
    assert.equal((await call('/api/admin/login-history',{page:-1},'Known browser',true)).status,400);
    assert.equal((await call('/api/admin/login-history',{})).status,401);
    // Issue a real request-bound approval for rotation, rather than bypassing its middleware.
    const missing=await call('/api/recovery/rotate-codes',{},'Known browser',true);assert.equal(missing.data.error,'STEP_UP_REQUIRED');
    const step=await call('/api/auth/step-up-challenge',{method:'POST',route:'/api/recovery/rotate-codes',body:{}},'Known browser',true);
    const verified=await call('/api/auth/step-up-verify',{intentId:step.data.intentId,assertionResponse:assertion(step.data.stepUpOptions.challenge)},'Known browser',true);
    assert.equal(verified.status,200);
    const rotated=await call('/api/recovery/rotate-codes',{},'Known browser',true,{'X-Step-Up-Token':verified.data.stepUpToken});
    assert.equal(rotated.status,200);assert.equal(rotated.data.recoveryCodes.length,8);
    assert.equal((await call('/api/recovery/rotate-codes',{},'Known browser',true,{'X-Step-Up-Token':verified.data.stepUpToken})).status,403);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id=? AND used=0').get(userId) as {n:number}).n,8);
    const ticket=await call('/api/recovery/verify-code',{username:'risk-user',recoveryCode:rotated.data.recoveryCodes[0]});assert.equal(ticket.status,200);
    console.log('[PASS] Hardware-key options, actual changed-browser/network login enforcement, no premature cookie, fresh approval/replay/expiry/revocation, filtered admin history and passkey-approved recovery-code rotation.');
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
