// Safe Two-Phase Account Recovery View
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useState, type FormEvent } from 'react';
import { completeRecovery, friendlyError, verifyRecovery } from '../services/api';
import { expiryMilliseconds, type RecoveryTicket } from '../services/types';
import { useNow } from '../services/usePolling';
import { Dialog } from '../components/Dialog';
export function RecoveryPage({ onSignIn }: { onSignIn: () => void }) {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<RecoveryTicket>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const now = useNow();
  async function verify(event: FormEvent) {
    event.preventDefault(); if (busy || !username.trim() || !code.trim()) return;
    setBusy(true); setError('');
    try { setTicket(await verifyRecovery(username.trim(), code.trim())); setCode(''); }
    catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }
  async function replace() {
    if (!ticket || busy || expiryMilliseconds(ticket.expiresAt) <= now) return;
    setBusy(true); setError('');
    try { await completeRecovery(username.trim(), ticket); setComplete(true); setTicket(undefined); }
    catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }
  if (complete) return <section><p className="eyebrow">Recovery completed</p><h1>Your replacement passkey is ready</h1><p>The server confirmed replacement enrollment. Your recovery code was consumed and previous credentials and sessions were revoked.</p><button onClick={onSignIn}>Sign in with your replacement passkey</button></section>;
  return <section><p className="eyebrow">Two-phase account recovery</p><h1>Recover your access</h1><p>Verify one saved emergency code, then enroll a replacement passkey. Verification alone does not consume the code or revoke your devices.</p>
    <form onSubmit={verify}><label htmlFor="recovery-user">Username</label><input id="recovery-user" autoComplete="username" required maxLength={100} value={username} onChange={event => setUsername(event.target.value)} disabled={busy || !!ticket} />
      <label htmlFor="recovery-code">Emergency recovery code</label><input id="recovery-code" type="password" autoComplete="off" required value={code} onChange={event => setCode(event.target.value)} disabled={busy || !!ticket} />
      {!ticket && error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy || !!ticket}>{busy ? 'Verifying…' : 'Verify emergency code'}</button>
    </form>
    {ticket && <Dialog title="Enroll your replacement passkey" onClose={() => { setTicket(undefined); setError(''); }} busy={busy}>
      <p>Your code is verified but is not consumed yet. Only successful replacement enrollment finalizes recovery and revokes old access.</p>
      <p role="status">{expiryMilliseconds(ticket.expiresAt) <= now ? 'This recovery ticket expired. Cancel and verify your code again.' : `Ticket expires in ${Math.ceil((expiryMilliseconds(ticket.expiresAt) - now) / 1000)} seconds.`}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button onClick={replace} disabled={busy || expiryMilliseconds(ticket.expiresAt) <= now}>{busy ? 'Complete the passkey prompt…' : 'Enroll replacement passkey'}</button>
    </Dialog>}
  </section>;
}
