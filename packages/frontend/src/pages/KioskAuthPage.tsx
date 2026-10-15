import { useEffect, useState, type FormEvent } from 'react';
import { authorizeKiosk, friendlyError, phoneChallenge } from '../services/api';
import type { PhoneChallenge } from '../services/types';
export function KioskAuthPage() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const sid = params.get('sid') ?? ''; const token = params.get('token') ?? '';
  const [username, setUsername] = useState('');
  const [options, setOptions] = useState<PhoneChallenge>();
  const [confirmed, setConfirmed] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { window.history.replaceState(null, '', '/kiosk-auth'); }, []);
  async function challenge(event: FormEvent) {
    event.preventDefault(); if (busy || !username.trim()) return;
    setBusy(true); setError('');
    try { setOptions(await phoneChallenge(sid, token, username.trim())); }
    catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }
  async function approve() {
    if (!options || !confirmed || busy) return;
    setBusy(true); setError('');
    try { await authorizeKiosk(sid, token, username.trim(), options); setComplete(true); }
    catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }
  if (!sid || !token) return <section><h1>Invalid kiosk link</h1><p>Scan a fresh QR code on the terminal. This approval link cannot be restored after refreshing.</p></section>;
  if (complete) return <section><h1>Terminal approved</h1><p>Return to the terminal. Sign out there when finished.</p></section>;
  return <section><p className="eyebrow">Approve a public terminal</p><h1>Check before you approve</h1><p>Only approve a terminal you are currently using. A matching code helps avoid accidental approvals; it is not full relay protection.</p>
    {!options ? <form onSubmit={challenge}><label htmlFor="phone-user">Username</label><input id="phone-user" autoComplete="username" required maxLength={100} value={username} onChange={event => setUsername(event.target.value)} disabled={busy} /><button disabled={busy}>{busy ? 'Loading…' : 'Get confirmation code'}</button></form> : <>
      <p className="confirmation-code">{String(options.displayCode).padStart(2, '0')}</p>
      <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />This matches the code on the terminal I am using.</label>
      <button disabled={!confirmed || busy} onClick={approve}>{busy ? 'Complete your passkey prompt…' : 'Approve with a passkey'}</button>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
