const net = require('node:net');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function occupied(port) {
  return new Promise(resolve => {
    const socket = net.connect({host:'127.0.0.1',port});
    const finish = value => {socket.destroy();resolve(value);};
    socket.setTimeout(700,()=>finish(false));socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));
  });
}
function decision(ports,bankHealthy,attackerHealthy) {
  if(ports.every(p=>!p.busy))return 'start';
  if(ports.every(p=>p.busy)&&bankHealthy&&attackerHealthy)return 'reuse';
  return 'conflict';
}
async function health(url,expected) {
  try {const response=await fetch(url,{signal:AbortSignal.timeout(1000)});return response.ok&&(await response.json()).status===expected;}catch{return false;}
}
async function main() {
  const phone=process.argv.includes('--phone');
  const environmentFile=path.resolve(__dirname,phone?'../.env.phone':'../.env');
  if(phone&&!fs.existsSync(environmentFile))throw new Error('Create .env.phone from .env.phone.example and follow docs/iphone-rehearsal.md before starting phone mode.');
  if(fs.existsSync(environmentFile))process.loadEnvFile(environmentFile);
  const bank=Number(process.env.PORT||3000),frontend=Number(process.env.VITE_PORT||5173),attacker=Number(process.env.PHISH_PORT||3001);
  if([bank,frontend,attacker].some(p=>!Number.isInteger(p)||p<1||p>65535)||new Set([bank,frontend,attacker]).size!==3)throw new Error('Choose three different valid PORT, VITE_PORT and PHISH_PORT values.');
  const ports=await Promise.all([{name:'bank',port:bank},{name:'frontend',port:frontend},{name:'attacker',port:attacker}].map(async p=>({...p,busy:await occupied(p.port)})));
  const secure=process.env.LOCAL_HTTP!=='1'&&fs.existsSync(path.resolve(__dirname,'..',process.env.TRUSTX_CERT_FILE||'certs/cert.pem'))&&fs.existsSync(path.resolve(__dirname,'..',process.env.TRUSTX_KEY_FILE||'certs/key.pem'));
  if(phone&&!secure)throw new Error('Phone mode requires its configured HTTPS certificate and private key; HTTP fallback is not permitted.');
  const bankUrl=secure?(process.env.EXPECTED_ORIGIN||`https://bank.local:${bank}`):`http://localhost:${bank}`;
  const attackerUrl=secure?(process.env.FAKE_PHISHING_ORIGIN||`https://b4nk-secure.local:${attacker}`):`http://127.0.0.1:${attacker}`;
  const state=decision(ports,await health(`${bankUrl}/api/health`,'HEALTHY'),await health(`${attackerUrl}/api/phish/health`,'READY'));
  if(state==='reuse'){console.log(`The TrustX demo is already running. No second copy was started.\nBank: ${bankUrl}\nDemo controls: ${bankUrl}/demo\nAttacker: ${attackerUrl}/phishing\nKeep the existing server terminal open.`);return;}
  if(state==='conflict'){console.error(`Cannot start a second stack. Occupied demo ports: ${ports.filter(p=>p.busy).map(p=>`${p.name} (${p.port})`).join(', ')}.\nStop the existing project server with Ctrl+C in its original terminal, then retry. No processes were killed.\nFor trusted HTTPS, Node also needs the local CA trust configuration to verify an existing stack.`);process.exitCode=1;return;}
  const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev:stack'],{stdio:'inherit',cwd:path.resolve(__dirname,'..')});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});
  child.on('exit',(code,signal)=>{process.exitCode=code??(signal?130:0);});
  process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
}
module.exports={occupied,decision};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
