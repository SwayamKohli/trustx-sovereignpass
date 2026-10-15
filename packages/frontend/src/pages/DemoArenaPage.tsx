import { useEffect, useState } from 'react';
import { ExternalLink, Monitor, ShieldCheck, ShieldX, RefreshCw } from 'lucide-react';
import { friendlyError, listDevices, mockMode, request } from '../services/api';
import type { Session } from '../services/types';
import { usePolling } from '../services/usePolling';
export type DemoConfig = { bankOrigin: string; attackerOrigin: string; rpId: string; mode: string };
const loadConfig = () => request<DemoConfig>('/demo/config', undefined, false);
export function DemoArenaPage({ session, onSignIn }: { session: Session | null; onSignIn: () => void }) {
  const config = usePolling(loadConfig, 10_000);
  const [labReady, setLabReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [baseline, setBaseline] = useState('');
  const [legacy, setLegacy] = useState('');
  const [protectedResult, setProtectedResult] = useState('');
  useEffect(() => {
    let active = true; setLabReady(false);
    if (config.data) void fetch(`${config.data.attackerOrigin}/api/phish/health`, { signal: AbortSignal.timeout(5000) }).then(response => { if (active) setLabReady(response.ok); }).catch(() => { if (active) setLabReady(false); });
    return () => { active = false; };
  }, [config.data?.attackerOrigin, revision]);
  async function compare() {
    if (!session || !config.data || busy) return;
    setBusy(true); setError(''); setBaseline(''); setLegacy(''); setProtectedResult('');
    try {
      const devices = await listDevices(); setBaseline(`HTTP 200: your signed request loaded ${devices.devices.length} device records.`);
      const response = await fetch(`${config.data.attackerOrigin}/api/phish/legacy-session-replay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'DEMO-LEGACY-SESSION' }), signal: AbortSignal.timeout(5000) });
      const result = await response.json();
      if (response.status !== 200 || result.status !== 'ACCEPTED') throw new Error('Legacy comparison unavailable');
      setLegacy('HTTP 200: Bearer-only endpoint accepted token without DPoP device proof. Attacker hijacked standard session.');
      const replay = await request<{ status: number; code: string }>('/demo/cookie-replay', {});
      setProtectedResult(`HTTP ${replay.status}: ${replay.code}. ${replay.status === 401 && replay.code === 'DPOP_PROOF_REQUIRED' ? 'Stolen bank cookie was cryptographically rejected: RFC 9449 DPoP device proof required.' : 'Expected cookie-only rejection was NOT confirmed.'}`);
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }
  return <section>
    <p className="eyebrow"><Monitor aria-hidden="true" />One laptop · separate security boundaries</p><h1>Live attack demonstration</h1>
    <p>Open the genuine bank, attacker site and SOC in separate windows. Every outcome below comes from a request; no attack is marked successful or blocked in advance.</p>
    {mockMode && <p className="banner">This is UI preview mode. Start npm run dev and open the bank origin for real demonstrations.</p>}
    {config.error && <p role="alert" className="error">{config.error} Start all services with <code>npm run dev</code>.</p>}
    {config.data && <>
      <div className="demo-windows">
        <section className="panel-container"><h2><ShieldCheck aria-hidden="true" />Genuine bank</h2><p className="identifier">{config.data.bankOrigin}</p><a className="button-link" href={`${config.data.bankOrigin}/`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Open citizen window</a><p>Register a passkey here and sign in. Keep this origin unchanged during the demonstration.</p></section>
        <section className="panel-container"><h2><ShieldX aria-hidden="true" />Attacker lab</h2><p className="identifier">{config.data.attackerOrigin}</p>{labReady ? <a className="button-link" href={`${config.data.attackerOrigin}/phishing`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Open phishing lab</a> : <p className="error" role="status">The attacker service is not reachable. Run <code>npm run dev</code> to start all three services. For configured HTTPS domains, also verify certificates and hosts entries.</p>}<button className="secondary" onClick={() => setRevision(value => value + 1)}><RefreshCw aria-hidden="true" />Check lab connection</button></section>
        <section className="panel-container"><h2><Monitor aria-hidden="true" />SOC observer</h2><p>Use a real administrator account. The live event feed shows captured dummy credentials, origin rejections and cookie-replay checks.</p>{session?.user.role === 'ADMIN' ? <a className="button-link" href={`${config.data.bankOrigin}/admin`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Open SOC window</a> : <p>After registration, the local operator can grant access with <code>npm run admin:grant -- your-username</code>. Refresh the bank afterward.</p>}</section>
      </div>
      <p className="hint">{config.data.mode === 'local-http' ? 'Local mode uses the browser’s loopback secure-context exception. localhost and 127.0.0.1 are deliberately separate hosts; no hosts-file edits are required.' : 'HTTPS mode uses the configured genuine and look-alike domains. Both domains must resolve to this machine and use trusted certificates.'}</p>
    </>}
    <section className="panel"><div className="section-heading"><div><h2>Cookie-only replay comparison</h2><p>First verify your signed request succeeds, then compare an insecure sandbox with your real bank session.</p></div><button disabled={busy || !session || !labReady || mockMode} onClick={compare}>{busy ? 'Measuring responses…' : 'Run cookie replay comparison'}</button></div>
      {!session && <button className="secondary" onClick={onSignIn}>Sign in to run the protected-session check</button>}
      {baseline && <p role="status">{baseline}</p>}
      <div className="comparison-grid"><section className="comparison-card legacy-card"><h3>Vulnerable sandbox</h3><p>{legacy || 'Not tested yet. Uses a published dummy token only.'}</p></section><section className="comparison-card trustx-card"><h3>Protected bank session</h3><p>{protectedResult || 'Not tested yet. The server forwards only your own cookie without its device proof. The cookie value is never exposed in the page.'}</p></section></div>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  </section>;
}
