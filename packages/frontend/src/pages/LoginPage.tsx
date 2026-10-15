// Citizen Login View (Passwordless Passkey Ceremony)
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { AuthForm } from '../components/AuthForm';
import { useState } from 'react';
import { login, currentSession, finishLoginCheck, LoginCheckRequired, friendlyError, type LoginCheck } from '../services/api';
import type { Session } from '../services/types';
import { Dialog } from '../components/Dialog';
import { tr } from '../services/i18n';
export function LoginPage({ onLogin, securityKey }: { onLogin: (session: Session) => void; securityKey?: boolean }) {
  const [check, setCheck] = useState<LoginCheck>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <><AuthForm key={String(securityKey)} kind="login" securityKey={securityKey} onSubmit={async (username, useSecurityKey) => {
    try { await login(username, useSecurityKey); onLogin(await currentSession()); }
    catch (err) { if (err instanceof LoginCheckRequired) { setCheck(err.check); setError(''); } else throw err; }
  }} />
    {check && <Dialog title={tr('Check this sign-in', 'इस साइन इन की जाँच करें')} busy={busy} onClose={() => { setCheck(undefined); setError(''); }}>
      <p>{tr('Your passkey was valid, but this login differs from the last successful context. No new session has been issued. Continue only if you started this sign-in.', 'आपकी पासकी सही थी, लेकिन यह प्रवेश पिछली बार से अलग है। नया सत्र अभी नहीं बना है। आपने ही शुरुआत की हो तभी आगे बढ़ें।')}</p>
      <ul>{check.risk.reasons.map(reason => <li key={reason}>{reason === 'NETWORK_ADDRESS_CHANGED' ? tr('Network address changed', 'नेटवर्क पता बदला है') : reason === 'BROWSER_CONTEXT_CHANGED' ? tr('Browser context changed', 'ब्राउज़र बदला है') : tr('New authenticator context', 'नया प्रमाणक इस्तेमाल हुआ है')}</li>)}</ul>
      <p className="hint">{tr('A fresh passkey check confirms presence again; it is not a second independent factor or a geolocation check. This request expires after 60 seconds.', 'नई पासकी जाँच आपकी मौजूदगी दोबारा जाँचती है; यह दूसरा स्वतंत्र साधन या स्थान की जाँच नहीं है। अनुरोध 60 सेकंड में समाप्त होता है।')}</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await finishLoginCheck(check); onLogin(await currentSession()); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); } }}>{busy ? tr('Complete the passkey prompt…', 'पासकी संदेश पूरा करें…') : tr('Verify this sign-in with my passkey', 'पासकी से इस साइन इन की पुष्टि करें')}</button>
    </Dialog>}
  </>;
}
