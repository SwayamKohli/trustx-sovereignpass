import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { persistencePolicy } from '../middleware/persistence.middleware';
import { modelStatus, planPersistenceAttack, validateLocalModel, localModel } from '../services/persistence-agent';
import { runPersistenceChallenge, type ChallengeReport, type ChallengeEvent } from '../services/persistence-challenge';
const router=Router();
type Job={id:string;owner:string;model:string;mode:string;inputHash:string;createdAt:number;state:'PLANNING'|'EXECUTING'|'COMPLETE'|'ERROR';events:ChallengeEvent[];plan?:Awaited<ReturnType<typeof planPersistenceAttack>>;report?:ChallengeReport;error?:string};
// shortcut: demo jobs live in one process for 15 minutes; use durable jobs before multi-instance deployment.
const jobs=new Map<string,Job>();
let running=false;
router.get('/status',requireAdmin,async(_req,res)=>res.json({policy:persistencePolicy,model:await modelStatus(),running}));
router.post('/jobs/status',requireAdmin,(req,res)=>{
  const job=typeof req.body.id==='string'?jobs.get(req.body.id):undefined;
  if(!job||job.owner!==req.user!.id||Date.now()-job.createdAt>15*60_000)return res.status(404).json({error:'CHALLENGE_NOT_FOUND_OR_EXPIRED'});
  const {owner,...publicJob}=job;return res.json(publicJob);
});
router.post('/jobs',requireAdmin,(req,res)=>{
  if(req.body.mode!=='redteam'&&req.body.mode!=='injection')return res.status(400).json({error:'INVALID_CHALLENGE_MODE'});
  if(typeof req.body.instruction!=='string'||req.body.instruction.length<10||req.body.instruction.length>2000)return res.status(400).json({error:'INSTRUCTION_MUST_BE_10_TO_2000_CHARACTERS'});
  let model:string;try{model=validateLocalModel(req.body.model??localModel());}catch{return res.status(400).json({error:'MODEL_NOT_ALLOWLISTED'});}
  if(running)return res.status(409).json({error:'CHALLENGE_ALREADY_RUNNING'});
  for(const [id,job] of jobs)if(Date.now()-job.createdAt>15*60_000)jobs.delete(id);
  if(jobs.size>=8)jobs.delete(jobs.keys().next().value!);
  const job:Job={id:crypto.randomUUID(),owner:req.user!.id,model,mode:req.body.mode,inputHash:crypto.createHash('sha256').update(req.body.instruction).digest('hex'),createdAt:Date.now(),state:'PLANNING',events:[]};jobs.set(job.id,job);running=true;
  res.status(202).json({id:job.id});
  void(async()=>{
    try {
      job.plan=await planPersistenceAttack(req.body.mode,req.body.instruction,fetch,model);
      db.prepare('INSERT INTO audit_events(id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(crypto.randomUUID(),'PERSISTENCE_AGENT_PLAN',job.owner,JSON.stringify({jobId:job.id,mode:req.body.mode,...job.plan}),new Date().toISOString());
      // The planner receives only text; it cannot choose targets, URLs, secrets or code.
      job.state='EXECUTING';job.report=await runPersistenceChallenge(job.plan,e=>job.events.push(e));job.state='COMPLETE';
    }catch(error){job.state='ERROR';job.error=error instanceof Error?error.message:'CHALLENGE_FAILED';}
    finally{running=false;}
  })();
});
export default router;
