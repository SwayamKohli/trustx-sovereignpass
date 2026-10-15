import { useEffect, useState } from 'react';
import { FlaskConical, Fingerprint, Play } from 'lucide-react';
import { friendlyError, login, mockMode, request } from '../services/api';
import type { User } from '../services/types';
type Metric = { algorithm: string; publicKeyBytes: number; signatureBytes: number; avgKeyGenMs: number; avgSignMs: number; avgVerifyMs: number };
type Benchmark = { timestamp: string; iterations: number; classical: Metric; postQuantum: Metric };
export function CryptoLabPage({ user }: { user?: User }) {
  const [data, setData] = useState<Benchmark>();
  const [platform, setPlatform] = useState<boolean>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [verification, setVerification] = useState('');
  useEffect(() => { let active = true; void window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.().then(value => { if (active) setPlatform(value); }).catch(() => { if (active) setPlatform(false); }); return () => { active = false; }; }, []);
  async function run(name: string, action: () => Promise<void>) {
    if (busy) return; setBusy(name); setError('');
    try { await action(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(''); }
  }
  return <section>
    <p className="eyebrow"><FlaskConical aria-hidden="true" />Cryptographic research</p><h1>Measure the algorithms. Verify the passkey.</h1>
    <p>PQC measurements are a standalone research experiment. They do not make this application’s passkey login quantum-safe.</p>
    <section className="panel"><div className="section-heading"><h2>ECDSA P-256 versus ML-DSA-44</h2><button disabled={!!busy || mockMode} onClick={() => void run('benchmark', async () => { setData(undefined); const result = await request<Benchmark>('/crypto/pqc-benchmark', undefined, false); if (!result.classical || !result.postQuantum || !Number.isInteger(result.iterations)) throw new Error('Invalid benchmark'); setData(result); })}><Play aria-hidden="true" />{busy === 'benchmark' ? 'Running measured trials…' : 'Run live benchmark'}</button></div>
      {mockMode && <p className="banner">Benchmark execution is available only against the live bank backend.</p>}
      {data ? <><p>{data.iterations} trials per algorithm · measured at {data.timestamp} on this server. ECDSA sizes use DER encoding.</p><div className="table-scroll"><table><caption>Observed cryptographic measurements</caption><thead><tr><th>Algorithm</th><th>Public key bytes</th><th>Signature bytes</th><th>Keygen ms</th><th>Sign ms</th><th>Verify ms</th></tr></thead><tbody>{[data.classical, data.postQuantum].map(row => <tr key={row.algorithm}><td>{row.algorithm}</td><td>{row.publicKeyBytes}</td><td>{row.signatureBytes}</td><td>{row.avgKeyGenMs}</td><td>{row.avgSignMs}</td><td>{row.avgVerifyMs}</td></tr>)}</tbody></table></div></> : <p>No measurements yet. Failed runs never substitute example numbers.</p>}
    </section>
    <section className="panel"><h2><Fingerprint aria-hidden="true" />Passkey verification</h2>
      <p>Browser WebAuthn support: {window.PublicKeyCredential ? 'available' : 'unavailable'}. Platform authenticator: {platform === undefined ? 'not determined' : platform ? 'reported available' : 'not reported available'}.</p>
      <p>Availability does not prove a physical USB key is connected. Verification below uses a real server challenge; cancellation is not a successful test.</p>
      {!user && <p>Sign in first to test an enrolled passkey.</p>}
      <button disabled={!!busy || !user || mockMode} onClick={() => void run('passkey', async () => { setVerification(''); await login(user!.username); setVerification('The server verified your passkey assertion.'); })}><Fingerprint aria-hidden="true" />{busy === 'passkey' ? 'Complete the passkey prompt…' : 'Verify my enrolled passkey'}</button>
      {verification && <p role="status">{verification}</p>}
    </section>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
