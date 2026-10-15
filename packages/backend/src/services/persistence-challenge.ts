import crypto from 'crypto';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import argon2 from 'argon2';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { db } from '../db';
import authRoutes from '../routes/auth.routes';
import deviceRoutes from '../routes/devices.routes';
import recoveryRoutes from '../routes/recovery.routes';
import type { PersistenceAction, AttackPlan } from './persistence-agent';

export type ChallengeEvent = {id:string;stage:string;label:string;status:'INFO'|'ALLOWED'|'BLOCKED'|'ERROR';timestamp:string;path?:string;httpStatus?:number;reason?:string;elapsedMs?:number};
export type ChallengeReport = {runId:string;scope:string;events:ChallengeEvent[];before?:unknown;afterAttack?:unknown;unchanged?:boolean;attackerBaselineLogin?:number;attackerProtectedLogin?:number;ownerLogin?:number;legitimateEnrollment?:number;enrollmentReplay?:number;revocationReplay?:number;notificationsDelivered?:number};
function authenticator() {
  const key = crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}), jwk=key.publicKey.export({format:'jwk'});
  const cose=Buffer.from(isoCBOR.encode(new Map<number,number|Uint8Array>([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x!,'base64url')],[-3,Buffer.from(jwk.y!,'base64url')]])));
  return {id:crypto.randomBytes(32).toString('base64url'),key,cose,counter:0};
}

// Baseline routes exist only on this ephemeral loopback server and only address their disposable fixture user.
export async function runPersistenceChallenge(plan:AttackPlan, emit:(event:ChallengeEvent)=>void = ()=>{}):Promise<ChallengeReport> {
  const runId=crypto.randomUUID(), timestamp=new Date().toISOString();
  const report:ChallengeReport={runId,scope:'Real production HTTP routers with disposable software-authenticator accounts. Deliberately weak baseline is isolated; no real user cookie is stolen.',events:[]};
  function event(value:Omit<ChallengeEvent,'id'|'timestamp'>) {const e={...value,id:crypto.randomUUID(),timestamp:new Date().toISOString()};report.events.push(e);emit(e);}
  const owner=authenticator(), baselineOwner=authenticator(), attacker=authenticator(), backup=authenticator();
  const protectedId=`guard_${crypto.randomUUID()}`, baselineId=`baseline_${crypto.randomUUID()}`;
  const device=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}), deviceKey=device.publicKey.export({format:'jwk'});
  const app=express();app.use(express.json(),cookieParser());app.use('/api/auth',authRoutes);app.use('/api/devices',deviceRoutes);app.use('/api/recovery',recoveryRoutes);
  let baselineCookie='', base='';
  app.post('/baseline/:action',async(req,res)=>{
    if (!baselineCookie || req.headers.cookie!==baselineCookie || !db.prepare('SELECT id FROM sessions WHERE id=? AND user_id=? AND expires_at>?').get(req.cookies.session_id,baselineId,Date.now())) return res.status(401).json({error:'BASELINE_SESSION_REQUIRED'});
    try {
      if(req.params.action==='enroll_passkey') {
        const options=await generateRegistrationOptions({rpName:'Isolated weak baseline',rpID:'127.0.0.1',userID:new Uint8Array(Buffer.from(baselineId)),userName:baselineId,attestationType:'none',authenticatorSelection:{userVerification:'required'}});
        const verification=await verifyRegistrationResponse({response:registration(options.challenge,attacker),expectedChallenge:options.challenge,expectedOrigin:base,expectedRPID:'127.0.0.1',requireUserVerification:true});
        if(!verification.verified||!verification.registrationInfo)throw new Error('INVALID_BASELINE_ATTESTATION');
        db.prepare("INSERT OR IGNORE INTO credentials(id,user_id,public_key,counter,device_name,status,created_at) VALUES (?,?,?,0,'Attacker fixture','ACTIVE',?)").run(attacker.id,baselineId,Buffer.from(verification.registrationInfo.credential.publicKey),timestamp);
      } else if(req.params.action==='revoke_victim') db.prepare("UPDATE credentials SET status='REVOKED' WHERE user_id=? AND id!=?").run(baselineId,attacker.id);
      else if(req.params.action==='rotate_recovery') db.prepare('UPDATE recovery_codes SET used=1 WHERE user_id=?').run(baselineId);
      else return res.status(400).json({error:'BASELINE_DOES_NOT_IMPLEMENT_RECOVERY_BYPASS'});
      return res.json({success:true});
    }catch{return res.status(400).json({error:'BASELINE_MUTATION_FAILED'});}
  });
  const server=http.createServer(app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  function assertion(challenge:string,auth=owner) {
    const client=Buffer.from(JSON.stringify({type:'webauthn.get',challenge,origin:base,crossOrigin:false}));
    const data=Buffer.alloc(37);crypto.createHash('sha256').update('127.0.0.1').digest().copy(data);data[32]=5;data.writeUInt32BE(++auth.counter,33);
    return {id:auth.id,rawId:auth.id,type:'public-key' as const,clientExtensionResults:{},response:{clientDataJSON:client.toString('base64url'),authenticatorData:data.toString('base64url'),signature:crypto.sign('sha256',Buffer.concat([data,crypto.createHash('sha256').update(client).digest()]),auth.key.privateKey).toString('base64url'),userHandle:null}};
  }
  function registration(challenge:string,auth:ReturnType<typeof authenticator>) {
    const client=Buffer.from(JSON.stringify({type:'webauthn.create',challenge,origin:base,crossOrigin:false}));
    const id=Buffer.from(auth.id,'base64url'),data=Buffer.alloc(55+id.length);crypto.createHash('sha256').update('127.0.0.1').digest().copy(data);data[32]=69;data.writeUInt16BE(id.length,53);id.copy(data,55);
    const attestation=isoCBOR.encode(new Map<string,string|Uint8Array|Map<string,never>>([['fmt','none'],['attStmt',new Map<string,never>()],['authData',Buffer.concat([data,auth.cose])]]));
    return {id:auth.id,rawId:auth.id,type:'public-key' as const,clientExtensionResults:{},response:{clientDataJSON:client.toString('base64url'),attestationObject:Buffer.from(attestation).toString('base64url'),transports:['internal' as const]}};
  }
  function proof(path:string,method='POST') {
    const header=Buffer.from(JSON.stringify({typ:'dpop+jwt',alg:'ES256',jwk:deviceKey})).toString('base64url');
    const payload=Buffer.from(JSON.stringify({htm:method,htu:path,iat:Math.floor(Date.now()/1000),jti:crypto.randomUUID()})).toString('base64url');
    const input=`${header}.${payload}`;return `${input}.${crypto.sign('sha256',Buffer.from(input),{key:device.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
  }
  async function call(path:string,body:unknown,cookie='',withProof=false,token?:string) {
    const started=Date.now();const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'PersistenceGuard controlled fixture',...(cookie?{Cookie:cookie}:{}),...(withProof?{DPoP:proof(path)}:{}),...(token?{'X-Step-Up-Token':token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]||'',elapsedMs:Date.now()-started};
  }
  async function login(username:string,auth=owner) {
    const options=await call('/api/auth/login-challenge',{username});
    let result=await call('/api/auth/login-verify',{username,assertionResponse:assertion(options.data.challenge,auth),dpopPublicKey:deviceKey});
    if(result.data.error==='LOGIN_EXTRA_CHECK_REQUIRED') result=await call('/api/auth/login-extra-verify',{pendingId:result.data.pendingId,assertionResponse:assertion(result.data.authenticationOptions.challenge,auth)});
    return result;
  }
  function state() {
    return {credentials:db.prepare('SELECT id,status FROM credentials WHERE user_id=? ORDER BY id').all(protectedId),codes:db.prepare('SELECT id,used FROM recovery_codes WHERE user_id=? ORDER BY id').all(protectedId),tickets:db.prepare('SELECT ticket_id,used FROM pending_recoveries WHERE user_id=? ORDER BY ticket_id').all(protectedId)};
  }
  function observed(stage:string,label:string,path:string,result:Awaited<ReturnType<typeof call>>) {
    event({stage,label,path,httpStatus:result.status,reason:result.data.error||result.data.code||'REQUEST_ACCEPTED',status:result.data.error==='BASELINE_DOES_NOT_IMPLEMENT_RECOVERY_BYPASS'?'INFO':result.status>=400?'BLOCKED':'ALLOWED',elapsedMs:result.elapsedMs});
  }
  let protectedCookie='';
  try {
    for(const id of [protectedId,baselineId]) {
      db.prepare("INSERT INTO users(id,username,role,created_at) VALUES (?,?,'USER',?)").run(id,id,timestamp);
      const cred=id===protectedId?owner:baselineOwner;
      db.prepare("INSERT INTO credentials(id,user_id,public_key,counter,device_name,status,created_at) VALUES (?,?,?,0,'Victim fixture','ACTIVE',?)").run(cred.id,id,cred.cose,timestamp);
      db.prepare('INSERT INTO recovery_codes(id,user_id,code_hash,used,created_at) VALUES (?,?,?,0,?)').run(crypto.randomUUID(),id,await argon2.hash(crypto.randomBytes(20).toString('hex')),timestamp);
    }
    const legitimate=await login(protectedId);if(legitimate.status!==200)throw new Error('VICTIM_POSITIVE_CONTROL_FAILED');protectedCookie=legitimate.cookie;
    const baselineVictim=await login(baselineId,baselineOwner);if(baselineVictim.status!==200)throw new Error('BASELINE_POSITIVE_CONTROL_FAILED');baselineCookie=baselineVictim.cookie;
    event({stage:'victim',label:'Victim passkey assertion verified; disposable bound session established',status:'ALLOWED',httpStatus:legitimate.status});
    report.before=state();
    for(const action of plan.actions) {
      const route=action==='enroll_passkey'?'/api/devices/register-challenge':action==='revoke_victim'?'/api/devices/revoke':action==='rotate_recovery'?'/api/recovery/rotate-codes':'/api/recovery/complete';
      const body=action==='revoke_victim'?{credentialId:owner.id}:action==='complete_recovery'?{username:protectedId,recoveryTicket:'forged-fixture-ticket',attestationResponse:{id:attacker.id},dpopPublicKey:deviceKey}:{};
      observed('baseline',action,`/baseline/${action}`,await call(`/baseline/${action}`,{},baselineCookie));
      observed('cookie',action,route,await call(route,body,protectedCookie));
      observed('guard',action+' · valid session proof, no fresh passkey',route,await call(route,body,protectedCookie,true));
    }
    report.afterAttack=state();report.unchanged=JSON.stringify(report.before)===JSON.stringify(report.afterAttack);
    event({stage:'state',label:report.unchanged?(plan.actions.length?'Authentication boundary unchanged after attacker requests':'No attacker mutations selected; authentication boundary unchanged'):'Authentication boundary CHANGED — investigate',status:report.unchanged?(plan.actions.length?'BLOCKED':'INFO'):'ERROR'});
    if(plan.actions.includes('enroll_passkey')) {
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(baselineId);
      event({stage:'containment',label:'Fixture controller terminated the baseline stolen session before independent attacker login',status:'INFO'});
      const baselineLogin=await login(baselineId,attacker);report.attackerBaselineLogin=baselineLogin.status;
      observed('baseline','Attacker attempts independent login with newly bound key','/api/auth/login-verify',baselineLogin);
      const protectedLogin=await login(protectedId,attacker);report.attackerProtectedLogin=protectedLogin.status;
      observed('guard','Attacker key cannot log in after failed enrollment','/api/auth/login-verify',protectedLogin);
    }
    async function approval(path:string,body:unknown) {
      const challenge=await call('/api/auth/step-up-challenge',{method:'POST',route:path,body},protectedCookie,true);
      if(challenge.status!==200)throw new Error('OWNER_STEP_UP_CHALLENGE_FAILED');
      const verified=await call('/api/auth/step-up-verify',{intentId:challenge.data.intentId,assertionResponse:assertion(challenge.data.stepUpOptions.challenge)},protectedCookie,true);
      if(verified.status!==200)throw new Error('OWNER_STEP_UP_VERIFICATION_FAILED');
      return verified.data.stepUpToken as string;
    }
    const options=await call('/api/devices/register-challenge',{},protectedCookie,true,await approval('/api/devices/register-challenge',{}));
    if(options.status!==200)throw new Error('OWNER_ENROLLMENT_CHALLENGE_FAILED');
    const attestation={attestationResponse:registration(options.data.challenge,backup),deviceName:'Owner-approved backup fixture'};
    const enrolled=await call('/api/devices/register-verify',attestation,protectedCookie,true);report.legitimateEnrollment=enrolled.status;observed('owner','Owner adds backup after fresh passkey approval','/api/devices/register-verify',enrolled);
    const replay=await call('/api/devices/register-verify',attestation,protectedCookie,true);report.enrollmentReplay=replay.status;observed('owner','Consumed enrollment ceremony replay','/api/devices/register-verify',replay);
    const revokeBody={credentialId:backup.id},token=await approval('/api/devices/revoke',revokeBody);
    observed('owner','Owner revokes backup with exact fresh approval','/api/devices/revoke',await call('/api/devices/revoke',revokeBody,protectedCookie,true,token));
    const revokedReplay=await call('/api/devices/revoke',revokeBody,protectedCookie,true,token);report.revocationReplay=revokedReplay.status;observed('owner','Consumed revocation approval replay','/api/devices/revoke',revokedReplay);
    observed('containment','Owner ends the original protected fixture session','/api/auth/logout',await call('/api/auth/logout',{},protectedCookie,true));
    const ownerLogin=await login(protectedId);report.ownerLogin=ownerLogin.status;observed('owner','Victim retains independent passkey login after original session ended','/api/auth/login-verify',ownerLogin);
    const notices=await fetch(base+'/api/devices/security-events',{headers:{Cookie:ownerLogin.cookie,DPoP:proof('/api/devices/security-events','GET')}});
    const feed=await notices.json() as {events?:Record<string,unknown>[]};
    if(notices.status!==200||!feed.events||feed.events.some(e=>'detail' in e||'recoveryTicket' in e))throw new Error('PRIVATE_NOTIFICATION_FEED_FAILED');
    report.notificationsDelivered=feed.events.length;
    event({stage:'owner',label:`Owner receives ${feed.events.length} in-app lifecycle notifications; recovery secrets omitted`,status:'ALLOWED',httpStatus:notices.status,path:'/api/devices/security-events'});
    db.prepare('INSERT INTO audit_events(id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(crypto.randomUUID(),'PERSISTENCE_CHALLENGE_COMPLETED',protectedId,JSON.stringify(report),new Date().toISOString());
    return report;
  } finally {
    for(const id of [protectedId,baselineId]) {
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);db.prepare('DELETE FROM pending_recoveries WHERE user_id=?').run(id);
      db.prepare('DELETE FROM recovery_codes WHERE user_id=?').run(id);db.prepare('DELETE FROM credentials WHERE user_id=?').run(id);
    }
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
}
