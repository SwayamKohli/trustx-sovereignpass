import { useState } from 'react';
import { ExternalLink, KeyRound, ShieldCheck, ShieldX } from 'lucide-react';
import { request } from '../services/api';
import { usePolling } from '../services/usePolling';
import type { DemoConfig } from './DemoArenaPage';
type LabEvent = { id: string; type: string; timestamp: string; detail: Record<string, unknown> };
const loadConfig = () => request<DemoConfig>('/demo/config', undefined, false);
async function labRequest(path: string, body?: unknown) {
  const response = await fetch(`/api/phish/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  const data = await response.json(); return { status: response.status, data };
}
const loadFeed = async () => { const result = await labRequest('feed'); if (result.status !== 200 || !Array.isArray(result.data.events)) throw new Error('Feed unavailable'); return result.data as { events: LabEvent[] }; };
export function PhishingLabPage() {
  const config = usePolling(loadConfig, 0);
  const feed = usePolling(loadFeed);
  const [busy, setBusy] = useState('');
  const [capture, setCapture] = useState('');
  const [browserResult, setBrowserResult] = useState('');
  const [serverResult, setServerResult] = useState('');
  const [error, setError] = useState('');
  async function run(name: string, action: () => Promise<void>) {
    if (busy) return; setBusy(name); setError('');
    try { await action(); feed.refresh(); } catch { setError('The lab request failed. Check all services are running; no successful outcome is claimed.'); } finally { setBusy(''); }
  }
  async function browserProbe() {
    if (!config.data || !window.PublicKeyCredential || !window.isSecureContext) { setBrowserResult('Unavailable: use a WebAuthn-capable browser in a secure context. No rejection is claimed.'); return; }
    setBrowserResult('');
    try {
      await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: config.data.rpId, timeout: 10_000, userVerification: 'preferred' } });
      setBrowserResult('RP isolation was not confirmed. This page may share the bank’s RP host; check the two URLs.');
    } catch (err) {
      setBrowserResult(err instanceof Error && err.name === 'SecurityError' ? `SecurityError: the browser rejected RP ID ${config.data.rpId} on ${window.location.hostname}. No passkey was disclosed.` : 'The request was cancelled or timed out. This is NOT proof of origin isolation; retry on the separate attacker host.');
    }
  }
  return <section>
    <p className="eyebrow"><ShieldX aria-hidden="true" />Controlled attacker site</p><h1>Phishing and session-replay lab</h1>
    <p>Current origin: <code>{window.location.origin}</code>. Only the published dummy credentials below are accepted. Never enter real passwords, OTPs or recovery codes.</p>
    {config.data && <a className="button-link secondary" href={`${config.data.bankOrigin}/demo`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Open genuine bank and demo controls</a>}
    <div className="comparison-grid panel">
      <section className="comparison-card legacy-card"><h2><ShieldX aria-hidden="true" />Password form on the wrong site</h2><p>A dummy form submission reaches this attacker server and appears in the shared event feed.</p><label htmlFor="dummy-user">Dummy username</label><input id="dummy-user" value="alice_dummy" readOnly /><label htmlFor="dummy-password">Dummy password</label><input id="dummy-password" value="DemoPassword123!" readOnly />
        <button disabled={!!busy} onClick={() => void run('capture', async () => { setCapture(''); const result = await labRequest('harvest', { username: 'alice_dummy', password: 'DemoPassword123!' }); if (result.status !== 200 || !result.data.success) throw new Error('Capture not confirmed'); setCapture(`HTTP 200: attacker received ${result.data.username} / ${result.data.password} at ${result.data.timestamp}. Dummy data only.`); })}>{busy === 'capture' ? 'Submitting…' : 'Submit dummy password'}</button>{capture && <p role="status" className="error">{capture}</p>}
      </section>
      <section className="comparison-card trustx-card"><h2><ShieldCheck aria-hidden="true" />Passkey boundaries</h2><p>These are two distinct tests. Only the exact observed result is displayed.</p><button disabled={!!busy || !config.data} onClick={() => void run('browser', browserProbe)}><KeyRound aria-hidden="true" />Test browser RP isolation</button>{browserResult && <p role="status" className="banner">{browserResult}</p>}
        <button className="secondary" disabled={!!busy} onClick={() => void run('origin', async () => { setServerResult(''); const result = await labRequest('origin-probe', {}); if (result.status !== 401 || result.data.code !== 'ORIGIN_MISMATCH') throw new Error('Origin check inconclusive'); setServerResult(`HTTP 401 ORIGIN_MISMATCH. ${result.data.scope}`); })}>Test server origin verifier</button>{serverResult && <p role="status" className="banner">{serverResult}</p>}
      </section>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="panel"><h2>Live comparison events</h2><p>Cookie replay checks started from the genuine bank appear here and in the SOC. No bank cookie is exposed to this site.</p>{feed.error && <p role="alert" className="error">{feed.error}</p>}
      <div className="bounded-feed"><ol className="audit-feed">{feed.data?.events.map(event => <li key={event.id}><strong>{event.type.replaceAll('_', ' ')}</strong><time dateTime={event.timestamp}>{event.timestamp}</time><pre>{JSON.stringify(event.detail, null, 2)}</pre></li>)}</ol>{feed.data?.events.length === 0 && <p>No comparison requests have been recorded yet.</p>}</div>
    </section>
  </section>;
}
