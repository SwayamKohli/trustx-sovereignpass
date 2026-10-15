import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
export type FlowEvent={id:string;stage:string;label:string;status:string;timestamp:string;path?:string;httpStatus?:number;reason?:string};
export function PersistenceFlow({events,state,model}:{events:FlowEvent[];state:string;model:string}) {
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(query.matches);query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>{if(reduced)setPlaying(false);},[reduced]);
  const complete=state==='COMPLETE'||state==='ERROR';
  useEffect(()=>{setPlaying(false);setIndex(0);},[events[0]?.id]);
  useEffect(()=>{
    if(!playing||!complete)return;
    if(index>=events.length-1){setPlaying(false);return;}
    const timer=setTimeout(()=>setIndex(n=>n+1),1400);return()=>clearTimeout(timer);
  },[playing,index,events.length,complete]);
  const current=complete?events[index]:events[events.length-1];
  const baseline=current?.stage==='baseline',owner=['owner','victim','containment'].includes(current?.stage||'');
  const blocked=current?.status==='BLOCKED',error=current?.status==='ERROR';
  const color=error?'#9b2525':baseline?'#9b5728':'#164d45';
  const start={x:owner?385:105,y:owner?240:90},middle={x:385,y:90};
  const end=baseline?{x:675,y:240}:owner?{x:675,y:90}:blocked?{x:385,y:90}:{x:675,y:90};
  const packet=current?{cx:[start.x,middle.x,end.x],cy:[start.y,middle.y,end.y],opacity:[0,1,1]}:{cx:105,cy:90,opacity:0};
  return <section className="guard-map panel-container" aria-label="Measured request flow visualization">
    <div className="section-heading"><div><p className="eyebrow">Credential lifecycle · enforcement map</p><h2>{complete?'Recorded evidence replay':'Live execution'}</h2></div><span className="badge">{state}</span></div>
    <p className="hint">{complete?'Replay is slowed down for explanation. Original timestamps and HTTP results are preserved; replay sends no new requests.':'Only received events are shown. No outcome is predicted while the model is thinking.'}</p>
    <div className="guard-map-svg"><svg viewBox="0 0 790 310" role="img" aria-label="Model proposals travel to PersistenceGuard; denied requests stop at the gate. Owner approvals and the isolated weak baseline use separate paths.">
      <path d="M195 90 H300 M470 90 H590 M195 110 C240 240 500 240 590 240 M385 200 V145" fill="none" stroke="#b4c9bf" strokeWidth="2" strokeDasharray="6 6"/>
      <g><rect x="15" y="40" width="180" height="100" rx="14" fill="#f3f7f5" stroke="#9cb6ac"/><text x="105" y="72" textAnchor="middle" className="map-title">LOCAL MODEL</text><text x="105" y="98" textAnchor="middle">{model}</text><text x="105" y="121" textAnchor="middle" className="map-small">{state==='PLANNING'?'Inference in progress…':'Actual structured proposal'}</text></g>
      <g><motion.rect x="300" y="35" width="170" height="110" rx="14" fill="#e5f1eb" stroke="#164d45" strokeWidth="2" animate={{opacity:state==='EXECUTING'&&!reduced?[1,.6,1]:1}} transition={{duration:1.2,repeat:state==='EXECUTING'&&!reduced?Infinity:0}}/><text x="385" y="69" textAnchor="middle" className="map-title">PERSISTENCEGUARD</text><text x="385" y="96" textAnchor="middle">Fresh authority?</text><text x="385" y="120" textAnchor="middle" className="map-small">Session ≠ permission to bind</text></g>
      <g><rect x="590" y="35" width="185" height="110" rx="14" fill="#f3f7f5" stroke="#9cb6ac"/><text x="682" y="70" textAnchor="middle" className="map-title">ACCOUNT CONTROL</text><text x="682" y="97" textAnchor="middle">Passkeys · recovery</text><text x="682" y="121" textAnchor="middle" className="map-small">Inspect measured state below</text></g>
      <g><rect x="300" y="200" width="170" height="80" rx="14" fill="#f3f7f5" stroke="#9cb6ac"/><text x="385" y="229" textAnchor="middle" className="map-title">LEGITIMATE OWNER</text><text x="385" y="253" textAnchor="middle" className="map-small">Fresh passkey positive controls</text></g>
      <g><rect x="590" y="200" width="185" height="80" rx="14" fill="#fff6ef" stroke="#c5a78f"/><text x="682" y="229" textAnchor="middle" className="map-title">WEAK BASELINE</text><text x="682" y="253" textAnchor="middle" className="map-small">Isolated comparison only</text></g>
      {current&&<motion.circle key={current.id} r="7" fill={color} initial={false} animate={reduced?{cx:end.x,cy:end.y,opacity:1}:packet} transition={{duration:reduced?0:1.05,times:[0,.6,1],ease:'easeInOut'}}/>}
      {blocked&&!baseline&&<motion.g key={`deny-${current?.id}`} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:reduced?0:.65}}><circle cx="385" cy="90" r="17" fill="#164d45"/><path d="M377 90 L383 96 L394 84" fill="none" stroke="white" strokeWidth="3"/></motion.g>}
    </svg></div>
    {complete&&events.length>0&&<div className="actions replay-controls"><button className="secondary" onClick={()=>{setIndex(0);setPlaying(!reduced);}}><RotateCcw aria-hidden="true"/>Replay measured trace</button><button className="secondary" disabled={!!reduced} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause aria-hidden="true"/>:<Play aria-hidden="true"/>}{playing?'Pause replay':'Play replay'}</button><button className="secondary" onClick={()=>{setPlaying(false);setIndex(n=>Math.min(n+1,events.length-1));}} disabled={index>=events.length-1}><SkipForward aria-hidden="true"/>Next recorded event</button><span>Event {index+1} / {events.length}</span></div>}
    <AnimatePresence mode="wait"><motion.div key={current?.id||state} className="guard-current-event" initial={{opacity:reduced?1:0}} animate={{opacity:1}} exit={{opacity:reduced?1:0}} transition={{duration:.12}}>
      {current?<><strong>{current.stage.toUpperCase()} · {current.label}</strong><p>{current.httpStatus!==undefined?`HTTP ${current.httpStatus} · `:''}{current.reason||current.status}</p>{current.path&&<code>{current.path}</code>}<small>{current.timestamp}</small></>:<p>{state==='PLANNING'?'Waiting for the real model response…':'Run an experiment to populate this map with measured evidence.'}</p>}
    </motion.div></AnimatePresence>
    {reduced&&<p className="hint">Reduced motion enabled: use Next recorded event for a static walkthrough.</p>}
  </section>;
}
