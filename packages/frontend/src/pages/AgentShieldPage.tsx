import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { Bot, KeyRound, ShieldCheck, ShieldX } from 'lucide-react';
import { ApiError, friendlyError, mockMode, request } from '../services/api';
import type { User } from '../services/types';

export function AgentShieldPage({ user }: { user: User }) {
  const [recipient, setRecipient] = useState('Electricity Board');
  const [limit, setLimit] = useState(500);
  const [target, setTarget] = useState('Attacker sandbox');
  const [amount, setAmount] = useState(1000);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [legacy, setLegacy] = useState('');
  const [protectedResult, setProtectedResult] = useState('');
  const [authorizedScope, setAuthorizedScope] = useState('');
  async function run(name: string, action: () => Promise<void>) {
    if (busy) return; setBusy(name); setError('');
    try { await action(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(''); }
  }
  async function authorize() {
    const challenge = await request<{ intentId: string; authenticationOptions: PublicKeyCredentialRequestOptionsJSON; binding: { recipient: string; maxAmount: number } }>('/agent/delegate-challenge', { action: 'POST /api/agent/execute-payment', recipient, maxAmount: limit });
    const assertionResponse = await startAuthentication({ optionsJSON: challenge.authenticationOptions });
    const result = await request<{ success: boolean; capabilityToken: string }>('/agent/delegate-verify', { intentId: challenge.intentId, assertionResponse });
    if (!result.success || !result.capabilityToken) throw new Error('Authorization not confirmed');
    setToken(result.capabilityToken); setProtectedResult(''); setAuthorizedScope(`${challenge.binding.recipient} · maximum INR ${challenge.binding.maxAmount}`);
  }
  return <section>
    <p className="eyebrow"><Bot aria-hidden="true" />Capability gateway</p><h1>Authorize once. Enforce the bounds.</h1>
    <p>Signed in as {user.username}. This is a sandbox transaction comparison: no funds are transferred and no external AI models are connected.</p>
    {mockMode && <p className="banner">This lab requires the live backend. Switch from preview to the bank application.</p>}
    <div className="panel">
      <h2>1. Approve a legitimate scope</h2>
      <div className="form-grid"><div><label htmlFor="approved-recipient">Approved recipient</label><input id="approved-recipient" value={recipient} maxLength={100} onChange={e => { setRecipient(e.target.value); setToken(''); }} /></div><div><label htmlFor="approved-limit">Maximum amount (INR)</label><input id="approved-limit" type="number" min="1" max="1000000000" value={limit} onChange={e => { setLimit(Number(e.target.value)); setToken(''); }} /></div></div>
      <button disabled={!!busy || mockMode || !recipient.trim() || !Number.isFinite(limit) || limit <= 0} onClick={() => void run('authorize', authorize)}><KeyRound aria-hidden="true" />{busy === 'authorize' ? 'Complete your passkey prompt…' : 'Authorize scope with a passkey'}</button>
      {token && <p role="status">Server verified the passkey. Authorized scope: {authorizedScope}. The capability is held only in this page’s memory.</p>}
    </div>
    <div className="panel"><h2>2. Submit the same parameters to both systems</h2><div className="form-grid"><div><label htmlFor="attempt-recipient">Requested recipient</label><input id="attempt-recipient" maxLength={100} value={target} onChange={e => { setTarget(e.target.value); setLegacy(''); setProtectedResult(''); }} /></div><div><label htmlFor="attempt-amount">Requested amount (INR)</label><input id="attempt-amount" type="number" min="1" value={amount} onChange={e => { setAmount(Number(e.target.value)); setLegacy(''); setProtectedResult(''); }} /></div></div></div>
    <div className="comparison-grid">
      <section className="comparison-card legacy-card"><h2><ShieldX aria-hidden="true" />Unconstrained comparison</h2><p>This intentionally vulnerable endpoint accepts parameters without a user-approved capability.</p>
        <button disabled={!!busy || mockMode || !target.trim() || amount <= 0 || !Number.isFinite(amount)} onClick={() => void run('legacy', async () => { setLegacy(''); const result = await request<{ status: string; recipient: string; amount: number }>('/agent/vulnerable-legacy-payment', { recipient: target, amount }, false); if (result.status !== 'UNCONSTRAINED_DEMO_ACCEPTED') throw new Error('Unexpected response'); setLegacy(`HTTP 200: sandbox accepted INR ${result.amount} to ${result.recipient} without scope validation.`); })}>{busy === 'legacy' ? 'Sending request…' : 'Submit to vulnerable sandbox'}</button>
        {legacy && <p role="status" className="error">{legacy}</p>}
      </section>
      <section className="comparison-card trustx-card"><h2><ShieldCheck aria-hidden="true" />TrustX capability enforcement</h2><p>The server checks the signed recipient, amount ceiling and single-use nonce.</p>
        <button disabled={!!busy || !token || !target.trim() || amount <= 0 || !Number.isFinite(amount)} onClick={() => void run('protected', async () => {
          setProtectedResult('');
          try { const result = await request<{ success: boolean; recipient: string; executedAmount: number }>('/agent/execute-payment', { capabilityToken: token, paymentDetails: { recipient: target, amount } }); if (!result.success) throw new Error('No server confirmation'); setProtectedResult(`HTTP 200: permitted INR ${result.executedAmount} to ${result.recipient}; capability consumed.`); setToken(''); }
          catch (err) { if (err instanceof ApiError && err.status === 403 && err.code === 'CAPABILITY_CONSTRAINT_VIOLATION') setProtectedResult('HTTP 403: the backend rejected this request under the capability constraints.'); else throw err; }
        })}>{busy === 'protected' ? 'Verifying constraints…' : 'Submit to protected gateway'}</button>
        {protectedResult && <p role="status" className="banner">{protectedResult}</p>}
      </section>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
