import { useState } from 'react';
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { Bot, KeyRound, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { ApiError, friendlyError, mockMode, request } from '../services/api';
import { usePolling } from '../services/usePolling';
import { Dialog } from '../components/Dialog';
import type { User } from '../services/types';

type State = { balancePaise: number; payments: { id: string; intentId: string; recipient: string; amountPaise: number; source: string; timestamp: string }[]; events: { id: string; type: string; detail: string; timestamp: string }[] };
type Challenge = { intentId: string; authenticationOptions: PublicKeyCredentialRequestOptionsJSON; binding: { recipient: string; maxAmount: number; intentHash: string; action: string; expiresAt: number } };
const loadState = () => request<State>('/agent/state');
export function AgentShieldPage({ user }: { user: User }) {
  const [recipient, setRecipient] = useState('Electricity Board');
  const [limit, setLimit] = useState(5000);
  const [target, setTarget] = useState('Attacker sandbox');
  const [amount, setAmount] = useState(50000);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [legacy, setLegacy] = useState('');
  const [protectedResult, setProtectedResult] = useState('');
  const [approved, setApproved] = useState<Challenge | null>(null);
  const [review, setReview] = useState<Challenge | null>(null);
  const state = usePolling(loadState, 3000);
  async function run(name: string, action: () => Promise<void>) {
    if (busy) return; setBusy(name); setError('');
    try { await action(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(''); }
  }
  async function submit() {
    setProtectedResult('');
    try {
      const result = await request<{ success: boolean; recipient: string; executedAmount: number; txId: string; timestamp: string }>('/agent/execute-payment', { capabilityToken: token, paymentDetails: { recipient: target, amount } });
      if (!result.success) throw new Error('No server confirmation');
      setProtectedResult(`ALLOWED · HTTP 200: permitted INR ${result.executedAmount} to ${result.recipient}. Transaction ${result.txId} · ${result.timestamp}. Approval consumed; submit again to test replay.`);
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== 'CAPABILITY_CONSTRAINT_VIOLATION') throw err;
      setProtectedResult(`BLOCKED · HTTP ${err.status}: ${err.details.reason}. Event ${err.details.eventId} · ${err.details.timestamp}. No ledger entry was created.`);
    } finally { state.refresh(); }
  }
  return <section>
    <p className="eyebrow"><Bot aria-hidden="true" />IntentLock · identity-to-action firewall</p><h1>Approve an action. Not unlimited authority.</h1>
    <p>Signed in as {user.username}. An altered request reaches the real gateway below. Compare its decision with the persisted sandbox ledger and events in another window.</p>
    <p className="hint">No external AI model is connected. This is a real adversarial API-request demonstration, not a live prompt-injection claim. All balances are synthetic INR; no real funds move.</p>
    {mockMode && <p className="banner">IntentLock requires the live bank, not UI preview mode.</p>}
    <div className="comparison-grid">
      <section className="panel-container"><h2>1. Approve the exact operation</h2>
        <label htmlFor="approved-recipient">Approved recipient</label><input id="approved-recipient" maxLength={100} value={recipient} onChange={e => { setRecipient(e.target.value); setToken(''); setApproved(null); }} />
        <label htmlFor="approved-limit">Exact approved amount (INR)</label><input id="approved-limit" type="number" min="0.01" step="0.01" max="1000000000" value={limit} onChange={e => { setLimit(Number(e.target.value)); setToken(''); setApproved(null); }} />
        <button disabled={!!busy || mockMode || !recipient.trim() || !Number.isFinite(limit) || limit <= 0} onClick={() => void run('prepare', async () => setReview(await request<Challenge>('/agent/delegate-challenge', { action: 'POST /api/agent/execute-payment', recipient, maxAmount: limit })))}><KeyRound aria-hidden="true" />Review exact intent</button>
        {approved && <div className="intent-summary"><p role="status">Server verified the passkey. Approved: {approved.binding.recipient} · exactly INR {approved.binding.maxAmount}.</p><p>Expires {new Date(approved.binding.expiresAt).toLocaleTimeString()} · this session only · one execution.</p><details><summary>Server binding</summary><pre>{JSON.stringify({ intentId: approved.intentId, ...approved.binding }, null, 2)}</pre></details></div>}
      </section>
      <section className="panel-container"><h2>2. Attempt an operation</h2>
        <label htmlFor="attempt-recipient">Requested recipient</label><input id="attempt-recipient" maxLength={100} value={target} onChange={e => setTarget(e.target.value)} />
        <label htmlFor="attempt-amount">Requested amount (INR)</label><input id="attempt-amount" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        <div className="actions"><button className="secondary" disabled={!approved || !!busy} onClick={() => { setTarget(approved!.binding.recipient); setAmount(approved!.binding.maxAmount); }}>Use approved parameters</button><button className="secondary" disabled={!!busy} onClick={() => { setTarget('Attacker sandbox'); setAmount(50000); }}>Use altered parameters</button></div>
      </section>
    </div>
    <div className="comparison-grid">
      <section className="comparison-card legacy-card"><h2><ShieldX aria-hidden="true" />Unconstrained comparison</h2><p>Deliberately insecure API accepts the same request without approval. This comparison has no protected account ledger.</p><button disabled={!!busy || mockMode || !target.trim() || amount <= 0} onClick={() => void run('legacy', async () => { const result = await request<{ status: string; recipient: string; amount: number; timestamp: string }>('/agent/vulnerable-legacy-payment', { recipient: target, amount }, false); setLegacy(`ALLOWED · HTTP 200: sandbox accepted INR ${result.amount} to ${result.recipient} · ${result.timestamp}`); })}>Submit to vulnerable sandbox</button>{legacy && <p role="status">{legacy}</p>}</section>
      <section className="comparison-card trustx-card"><h2><ShieldCheck aria-hidden="true" />Protected execution</h2><p>Exact action, recipient and amount; actor and session; expiry; atomic single use. A denied attempt does not consume a valid approval.</p><button disabled={!!busy || !token || !target.trim() || amount <= 0} onClick={() => void run('execute', submit)}>Submit to protected gateway</button>{protectedResult && <p role="status" className="banner">{protectedResult}</p>}</section>
    </div>
    <div className="section-heading"><h2>3. Verify the actual state</h2><div className="actions"><a className="button-link" href="/agent" target="_blank" rel="noreferrer">Open ledger observer</a><button className="secondary" onClick={state.refresh}><RefreshCw aria-hidden="true" />Refresh ledger</button></div></div>
    {state.error && <p role="alert" className="error">{state.error}</p>}
    {state.data && <><p className="ledger-balance">Sandbox balance: INR {(state.data.balancePaise / 100).toLocaleString('en-IN')} · {state.data.payments.length ? 'Latest recorded payments below' : 'No recorded payments'}</p><div className="table-wrap"><table><caption>Persistent sandbox payments · latest 30</caption><thead><tr><th>Transaction / time</th><th>Recipient</th><th>INR</th><th>Source</th></tr></thead><tbody>{state.data.payments.map(p => <tr key={p.id}><td><code>{p.id}</code><br /><time>{p.timestamp}</time></td><td>{p.recipient}</td><td>{p.amountPaise / 100}</td><td>{p.source}</td></tr>)}</tbody></table></div><h3>Live authorization evidence</h3><ul className="audit-feed bounded-feed">{state.data.events.map(event => <li key={event.id}><strong>{event.type.replaceAll('_', ' ')}</strong><time>{event.timestamp} · {event.id}</time><pre>{event.detail}</pre></li>)}</ul></>}
    {error && <p role="alert" className="error">{error}</p>}
    {review && <Dialog title="Review this exact payment" busy={!!busy} onClose={() => setReview(null)}><p>Pay <strong>INR {review.binding.maxAmount}</strong> to <strong>{review.binding.recipient}</strong> in the sandbox.</p><p>This approval permits one payment from this session and expires in five minutes. This browser is not a separately trusted transaction display.</p><p className="identifier">Intent: {review.intentId}</p>{error && <p role="alert" className="error">{error}</p>}<button disabled={!!busy} onClick={() => void run('authorize', async () => { const assertionResponse = await startAuthentication({ optionsJSON: review.authenticationOptions }); const result = await request<{ success: boolean; capabilityToken: string }>('/agent/delegate-verify', { intentId: review.intentId, assertionResponse }); if (!result.success || !result.capabilityToken) throw new Error('Approval not confirmed'); setToken(result.capabilityToken); setApproved(review); setReview(null); setProtectedResult(''); state.refresh(); })}><KeyRound aria-hidden="true" />Confirm with a passkey</button></Dialog>}
  </section>;
}
