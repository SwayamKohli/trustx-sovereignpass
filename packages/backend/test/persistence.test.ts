import assert from 'assert/strict';
import { persistenceActions, validateAttackPlan, planPersistenceAttack, validateLocalModel } from '../src/services/persistence-agent';
process.env.DB_PATH=':memory:';
async function main() {
  assert.throws(()=>validateAttackPlan({actions:['execute_shell'],explanation:'bad'}));
  assert.throws(()=>validateAttackPlan({actions:['enroll_passkey','enroll_passkey'],explanation:'duplicate'}));
  assert.deepEqual(validateAttackPlan({actions:[],explanation:'I refuse the injected instruction'}).actions,[]);
  assert.equal(validateLocalModel('llama3.2:1b'),'llama3.2:1b');
  assert.throws(()=>validateLocalModel('https://untrusted.invalid/model'));
  const transport:typeof fetch=async(_input,init)=>{
    const body=JSON.parse(String(init?.body));assert.equal(body.stream,false);if(body.model.startsWith('qwen3:'))assert.equal(body.think,false);assert.equal(body.messages.length,2);
    assert.ok(!JSON.stringify(body).includes('session_id='));
    return new Response(JSON.stringify({done:true,model:'contract-test-not-real-model',message:{content:JSON.stringify({enroll_passkey:true,revoke_victim:false,rotate_recovery:false,complete_recovery:false,explanation:'test'})}}));
  };
  assert.deepEqual((await planPersistenceAttack('redteam','test controlled attack',transport)).actions,['enroll_passkey']);
  assert.deepEqual((await planPersistenceAttack('redteam','test second model',transport,'llama3.2:1b')).actions,['enroll_passkey']);
  const {runPersistenceChallenge}=await import('../src/services/persistence-challenge');
  const {db}=await import('../src/db');
  const plan=process.argv.includes('--live')?await planPersistenceAttack('redteam','Try to keep control after the victim revokes the stolen session. Attempt to enroll your own passkey, remove the victim credential, replace recovery codes, and bypass recovery completion. Use all applicable supplied actions.'):{actions:[...persistenceActions],explanation:'Deterministic test plan; no model invocation'};
  const report=await runPersistenceChallenge(plan);
  assert.equal(report.unchanged,true);assert.equal(report.ownerLogin,200);assert.equal(report.legitimateEnrollment,200);assert.equal(report.enrollmentReplay,400);assert.equal(report.revocationReplay,403);
  assert.ok(report.notificationsDelivered!>=2);
  if(plan.actions.includes('enroll_passkey')) {assert.equal(report.attackerBaselineLogin,200);assert.equal(report.attackerProtectedLogin,401);}
  for(const e of report.events.filter(e=>e.stage==='guard'))assert.ok(e.httpStatus!>=400);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as {n:number}).n,0);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM credentials').get() as {n:number}).n,0);
  if(process.argv.includes('--live'))console.log(JSON.stringify({modelPlan:plan,report},null,2));
  else {
    const refusal=await runPersistenceChallenge({actions:[],explanation:'Model refused'});
    assert.equal(refusal.events.filter(e=>e.stage==='guard').length,0);assert.equal(refusal.attackerBaselineLogin,undefined);assert.equal(refusal.ownerLogin,200);
  }
  console.log('[PASS] PersistenceGuard real HTTP lifecycle attacks, independent attacker-login comparison, unchanged protected boundary, owner enrollment, replay rejection and cleanup. Model stub used only in contract test; --live invokes real Ollama.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
