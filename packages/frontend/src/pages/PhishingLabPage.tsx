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
  const [username, setUsername] = useState('alice');
  const [password, setPassword] = useState('SecurePass123!');
  const [capture, setCapture] = useState('');
  const [browserResult, setBrowserResult] = useState('');
  const [serverResult, setServerResult] = useState('');
  const [error, setError] = useState('');

  async function run(name: string, action: () => Promise<void>) {
    if (busy) return; setBusy(name); setError('');
    try { await action(); feed.refresh(); } catch { setError('The lab request failed. Verify services are running.'); } finally { setBusy(''); }
  }

  async function browserProbe() {
    if (!config.data || !window.PublicKeyCredential || !window.isSecureContext) { 
      setBrowserResult('Unavailable: use a WebAuthn-capable browser in a secure context.'); 
      return; 
    }
    setBrowserResult('');
    try {
      await navigator.credentials.get({ 
        publicKey: { 
          challenge: crypto.getRandomValues(new Uint8Array(32)), 
          rpId: config.data.rpId, 
          timeout: 10_000, 
          userVerification: 'preferred' 
        } 
      });
      setBrowserResult('RP isolation was not confirmed. Check that the attacker domain is distinct.');
    } catch (err) {
      if (err instanceof Error && err.name === 'SecurityError') {
        setBrowserResult(`✓ FIDO2 Browser Hardware Isolation Active: Browser blocked RP ID '${config.data.rpId}' on untrusted origin '${window.location.hostname}' (SecurityError). No passkey private key or signature was released.`);
      } else {
        setBrowserResult('The biometric prompt was cancelled or timed out.');
      }
    }
  }

  return <section>
    <p className="eyebrow"><ShieldX aria-hidden="true" />Controlled Attacker Domain</p>
    <h1>Phishing & Session-Replay Lab</h1>
    <p>Current origin: <code>{window.location.origin}</code> (Simulated punycode phishing clone of <code>bank.local:3000</code>)</p>
    {config.data && <a className="button-link secondary" href={`${config.data.bankOrigin}/demo`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Open genuine bank and demo controls</a>}
    
    <div className="comparison-grid panel">
      {/* Legacy Password Form Interception */}
      <section className="comparison-card legacy-card">
        <h2><ShieldX aria-hidden="true" />Legacy Password Phishing (Vulnerable)</h2>
        <p>Passwords transmit a shared secret. Entering credentials on this attacker site exposes them in plaintext.</p>
        <label htmlFor="phish-user">Target username</label>
        <input id="phish-user" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" />
        <label htmlFor="phish-password">Password to harvest</label>
        <input id="phish-password" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
        
        <button disabled={!!busy} onClick={() => void run('capture', async () => { 
          setCapture(''); 
          const result = await labRequest('harvest', { username, password }); 
          if (result.status !== 200 || !result.data.success) throw new Error('Capture failed'); 
          setCapture(`HTTP 200: Attacker harvested credentials for '${result.data.username}' with password '${result.data.password}'. Transmitted in plaintext over HTTP!`); 
        })}>
          {busy === 'capture' ? 'Submitting…' : 'Submit password to attacker site'}
        </button>
        {capture && <p role="status" className="error">{capture}</p>}
      </section>

      {/* Passkey Boundaries: Layer 1 & Layer 2 */}
      <section className="comparison-card trustx-card">
        <h2><ShieldCheck aria-hidden="true" />FIDO2 Hardware Passkeys (Immune)</h2>
        <p>Passkeys are bound to origin domains. Even on this phishing site, credentials cannot be stolen or relayed.</p>
        
        <button disabled={!!busy || !config.data} onClick={() => void run('browser', browserProbe)}>
          <KeyRound aria-hidden="true" />Test 1: Browser RP ID Isolation
        </button>
        {browserResult && <p role="status" className="banner" style={{ textAlign: 'left' }}>{browserResult}</p>}

        <button className="secondary" disabled={!!busy} onClick={() => void run('origin', async () => { 
          setServerResult(''); 
          const result = await labRequest('origin-probe', {}); 
          if (result.status !== 401 || result.data.code !== 'ORIGIN_MISMATCH') throw new Error('Origin check inconclusive'); 
          setServerResult(`✓ FIDO2 Server Origin Verification Active: HTTP 401 ORIGIN_MISMATCH. Backend SimpleWebAuthn verified clientDataJSON.origin and rejected the relayed assertion (Expected: ${result.data.expectedOrigin}, Received: ${result.data.actualOrigin}).`); 
        })}>
          Test 2: Server-Side Reverse Proxy Origin Verifier
        </button>
        {serverResult && <p role="status" className="banner" style={{ textAlign: 'left' }}>{serverResult}</p>}
      </section>
    </div>

    {error && <p className="error" role="alert">{error}</p>}
    <section className="panel">
      <h2>Live Comparison Event Feed</h2>
      <p>Real-time security telemetry captured by the attacker server and forwarded to the Admin SOC.</p>
      {feed.error && <p role="alert" className="error">{feed.error}</p>}
      <div className="bounded-feed">
        <ol className="audit-feed">
          {feed.data?.events.map(event => (
            <li key={event.id}>
              <strong>{event.type.replaceAll('_', ' ')}</strong>
              <time dateTime={event.timestamp}>{event.timestamp}</time>
              <pre>{JSON.stringify(event.detail, null, 2)}</pre>
            </li>
          ))}
        </ol>
        {feed.data?.events.length === 0 && <p>No comparison requests have been recorded yet.</p>}
      </div>
    </section>
  </section>;
}
