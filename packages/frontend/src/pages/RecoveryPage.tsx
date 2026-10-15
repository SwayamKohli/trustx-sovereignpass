import { tr } from '../services/i18n';
// Safe Two-Phase Account Recovery View
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useState, type FormEvent } from 'react';
import { completeRecovery, friendlyError, verifyRecovery } from '../services/api';
import { expiryMilliseconds, type RecoveryTicket } from '../services/types';
import { useNow } from '../services/usePolling';
import { Dialog } from '../components/Dialog';
import { AudioHelp } from '../components/AudioHelp';
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
  if (complete) return <section><p className="eyebrow">{tr("Recovery completed", "रिकवरी पूरी हुई")}</p><h1>{tr("Your replacement passkey is ready", "आपकी नई पासकी तैयार है")}</h1><p>{tr("The server confirmed replacement enrollment. Your recovery code was consumed and previous credentials and sessions were revoked.", "सर्वर ने नई पासकी बना दी है। इस्तेमाल किया कोड, पुरानी पासकी और पुराने सत्र अब अमान्य हैं।")}</p><button onClick={onSignIn}>{tr("Sign in with your replacement passkey", "नई पासकी से साइन इन करें")}</button></section>;
  return <section><p className="eyebrow">{tr("Two-phase account recovery", "दो चरण में खाता वापस पाएँ")}</p><h1>{tr("Recover your access", "अपना प्रवेश वापस पाएँ")}</h1><p>{tr("Verify one saved emergency code, then enroll a replacement passkey. Verification alone does not consume the code or revoke your devices.", "एक सुरक्षित आपातकालीन कोड जाँचें, फिर नई पासकी बनाएँ। केवल कोड जाँचने से कोड खर्च या डिवाइस रद्द नहीं होता।")}</p>
    <form onSubmit={verify}><label htmlFor="recovery-user">{tr("Username", "उपयोगकर्ता नाम")}</label><input id="recovery-user" autoComplete="username" required maxLength={100} value={username} onChange={event => setUsername(event.target.value)} disabled={busy || !!ticket} />
      <label htmlFor="recovery-code">{tr("Emergency recovery code", "आपातकालीन रिकवरी कोड")}</label><input id="recovery-code" type="password" autoComplete="off" required value={code} onChange={event => setCode(event.target.value)} disabled={busy || !!ticket} />
      {!ticket && error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy || !!ticket}>{busy ? tr("Verifying…", "जाँच हो रही है…") : tr("Verify emergency code", "आपातकालीन कोड जाँचें")}</button>
    </form>
    <details className="panel"><summary>{tr('No recovery code?', 'रिकवरी कोड नहीं है?')}</summary><p>{tr('If another enrolled passkey still works, sign in with it and replace your recovery codes under Security and recovery. If every passkey and code is lost, this app cannot safely reset the account. Contact your organization for an independently verified identity-proofing process. There is no password, SMS or administrator bypass.', 'दूसरी पंजीकृत पासकी चलती है तो उससे साइन इन करके सुरक्षा और रिकवरी में कोड बदलें। सभी पासकी और कोड खोने पर ऐप सुरक्षित रीसेट नहीं कर सकता। संस्था की अलग पहचान-जाँच प्रक्रिया से संपर्क करें। पासवर्ड, SMS या एडमिन बायपास नहीं है।')}</p></details>
    <AudioHelp instructions={tr('Use one recovery code you previously saved. Type the code yourself and do not read it aloud or share it with a helper. First verify the code, then create a replacement passkey. Cancelling before completion does not spend the code. Successful recovery revokes the old passkeys and sessions.', 'पहले सुरक्षित रखा एक रिकवरी कोड इस्तेमाल करें। कोड खुद भरें, बोलकर न बताएँ और मददगार से साझा न करें। पहले कोड जाँचें, फिर नई पासकी बनाएँ। पूरा होने से पहले रद्द करने पर कोड खर्च नहीं होता। सफल रिकवरी पुरानी पासकी और सत्र रद्द करती है।')} />
    {ticket && <Dialog title={tr("Enroll your replacement passkey", "नई पासकी पंजीकृत करें")} onClose={() => { setTicket(undefined); setError(''); }} busy={busy}>
      <p>{tr("Your code is verified but is not consumed yet. Only successful replacement enrollment finalizes recovery and revokes old access.", "कोड सही है, अभी खर्च नहीं हुआ। नई पासकी सफलतापूर्वक बनने पर ही रिकवरी पूरी और पुराना प्रवेश रद्द होगा।")}</p>
      <p role="status">{expiryMilliseconds(ticket.expiresAt) <= now ? tr("This recovery ticket expired. Cancel and verify your code again.", "रिकवरी टिकट समाप्त हो गया। रद्द करके कोड दोबारा जाँचें।") : `${tr("Ticket expires in", "टिकट की समय सीमा")} ${Math.ceil((expiryMilliseconds(ticket.expiresAt) - now) / 1000)} ${tr("seconds.", "सेकंड।")}`}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button onClick={replace} disabled={busy || expiryMilliseconds(ticket.expiresAt) <= now}>{busy ? tr("Complete the passkey prompt…", "पासकी संदेश पूरा करें…") : tr("Enroll replacement passkey", "नई पासकी बनाएँ")}</button>
    </Dialog>}
  </section>;
}
