import { tr } from '../services/i18n';
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
  if (!sid || !token) return <section><h1>{tr("Invalid kiosk link", "कियोस्क लिंक अमान्य है")}</h1><p>{tr("Scan a fresh QR code on the terminal. This approval link cannot be restored after refreshing.", "टर्मिनल पर नया QR स्कैन करें। इस लिंक को पेज दोबारा खोलने पर वापस नहीं लाया जा सकता।")}</p></section>;
  if (complete) return <section><h1>{tr("Terminal approved", "टर्मिनल मंज़ूर हुआ")}</h1><p>{tr("Return to the terminal. Sign out there when finished.", "टर्मिनल पर वापस जाएँ। काम पूरा होने पर साइन आउट करें।")}</p></section>;
  return <section><p className="eyebrow">{tr("Approve a public terminal", "सार्वजनिक टर्मिनल मंज़ूर करें")}</p><h1>{tr("Check before you approve", "मंज़ूरी से पहले जाँचें")}</h1><p>{tr("Only approve a terminal you are currently using. A matching code helps avoid accidental approvals; it is not full relay protection.", "केवल अपने इस्तेमाल किए जा रहे टर्मिनल को मंज़ूर करें। कोड मिलाना गलती रोकने में मदद करता है; यह हर रिले हमले से पूरी रक्षा नहीं है।")}</p>
    {!options ? <form onSubmit={challenge}><label htmlFor="phone-user">{tr("Username", "उपयोगकर्ता नाम")}</label><input id="phone-user" autoComplete="username" required maxLength={100} value={username} onChange={event => setUsername(event.target.value)} disabled={busy} /><button disabled={busy}>{busy ? tr("Loading…", "खुल रहा है…") : tr("Get confirmation code", "पुष्टि कोड देखें")}</button></form> : <>
      <p className="confirmation-code">{String(options.displayCode).padStart(2, '0')}</p>
      <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />{tr("This matches the code on the terminal I am using.", "यह कोड मेरे इस्तेमाल वाले टर्मिनल से मिलता है।")}</label>
      <button disabled={!confirmed || busy} onClick={approve}>{busy ? tr("Complete your passkey prompt…", "पासकी संदेश पूरा करें…") : tr("Approve with a passkey", "पासकी से मंज़ूर करें")}</button>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
